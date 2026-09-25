"""Resolution of image references passed to the deliverable tools.

An image is named one of two ways:

- ``path``: relative to the current job workspace, for a file the job itself
  produced (reuses :func:`resolve_within_workspace`).
- ``doc_id``: an ingested document from the attachment manifest. Uploads live
  under ``<uploads_root>/<user>/``, a sibling of the workspace tree, so a
  workspace-relative path can never name one. An image document resolves to its
  file; a PDF document resolves — with ``page`` — to that page rendered as PNG
  bytes, so a page of a report can be embedded as a figure.

Either way the caller gets something the local generator can read and nothing
can escape its root. No host-absolute path is ever an argument the model
supplies — a generator embeds the image bytes, so a resolved path stays
server-side.
"""

import logging
from pathlib import Path
from typing import Any, Optional, Union

from app.services.workspace import WorkspaceError, WorkspaceManager, resolve_within_workspace

logger = logging.getLogger("app.image_resolution")

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".tif", ".webp"}
_IMAGE_DOCUMENT_TYPES = {"png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp"}
IMAGE_FIELDS = {"path", "doc_id", "page", "caption", "width_inches"}
IMAGE_TYPE_LABEL = "png/jpg/jpeg/bmp/gif/tiff/webp"
# A PDF page number. Generous but bounded: enough for a long report, small
# enough that a hallucinated page is rejected before any render is attempted.
MAX_IMAGE_PAGE = 500


class ImageResolutionError(Exception):
    """An image reference was malformed or could not be resolved to a file."""


def _validate_image(raw: Any) -> tuple[str, str, Optional[int]]:
    """Validate one raw image object; return ``(path, doc_id, page)``.

    Exactly one of the two reference forms must be set: a reference that names
    no source, or two sources at once, is ambiguous and rejected rather than
    silently preferring one.
    """
    if not isinstance(raw, dict):
        raise ImageResolutionError("each image must be an object")
    unknown = set(raw) - IMAGE_FIELDS
    if unknown:
        raise ImageResolutionError(f"unknown image field(s): {', '.join(sorted(unknown))}")
    for field in ("path", "doc_id"):
        value = raw.get(field)
        if value is not None and not isinstance(value, str):
            raise ImageResolutionError(f"image '{field}' must be a string")
    path = (raw.get("path") or "").strip()
    doc_id = (raw.get("doc_id") or "").strip()
    if bool(path) == bool(doc_id):
        raise ImageResolutionError("image must set exactly one of 'path' or 'doc_id'")
    page = raw.get("page")
    if page is not None and (
        isinstance(page, bool)
        or not isinstance(page, int)
        or page < 1
        or page > MAX_IMAGE_PAGE
    ):
        raise ImageResolutionError(
            f"image 'page' must be an integer between 1 and {MAX_IMAGE_PAGE}"
        )
    caption = raw.get("caption", "")
    if not isinstance(caption, str):
        raise ImageResolutionError("image 'caption' must be a string")
    width = raw.get("width_inches")
    if width is not None and (
        isinstance(width, bool)
        or not isinstance(width, (int, float))
        or width <= 0
        or width > 10
    ):
        raise ImageResolutionError("image 'width_inches' must be a number between 0 and 10")
    return path, doc_id, page


def parse_image_reference(raw: Any) -> tuple[str, str, Optional[int]]:
    """Validate one raw image object; return ``(path, doc_id, page)``.

    A page only makes sense for a document that has pages, so it is only
    accepted alongside ``doc_id`` — a workspace path names a single file.
    """
    path, doc_id, page = _validate_image(raw)
    if page is not None and not doc_id:
        raise ImageResolutionError("image 'page' applies only to a 'doc_id'")
    return path, doc_id, page


def resolve_workspace_image(workspace: Path, path: str) -> Path:
    """Resolve a workspace-relative image path, rejecting any escape."""
    if Path(path).suffix.lower() not in IMAGE_SUFFIXES:
        raise ImageResolutionError(
            f"unsupported image type in '{path}' ({IMAGE_TYPE_LABEL} only)"
        )
    try:
        resolved = resolve_within_workspace(workspace, path)
    except WorkspaceError as exc:
        raise ImageResolutionError(str(exc)) from exc
    if not resolved.is_file():
        raise ImageResolutionError(f"image not found in the job workspace: {path}")
    return resolved


def _document_file(document: Any, doc_id: str, uploads_root: Union[str, Path]) -> Path:
    """The document's file under the uploads root, with containment enforced."""
    root = Path(uploads_root).resolve()
    target = (
        root / WorkspaceManager.safe_component(document.user_id) / Path(document.filename).name
    ).resolve()
    if not target.is_relative_to(root):
        raise ImageResolutionError("image document path escapes the uploads root")
    if not target.is_file():
        raise ImageResolutionError(f"image file for document '{doc_id}' is missing")
    return target


async def resolve_image_source(
    *,
    path: str,
    doc_id: str,
    page: Optional[int] = None,
    workspace: Path,
    user_id: str,
    knowledge_base: Any = None,
    uploads_root: Optional[Union[str, Path]] = None,
) -> Union[Path, bytes]:
    """Resolve whichever reference form is set to a readable file or PNG bytes.

    ``bytes`` is returned when the source is a PDF page: the page is rendered
    in memory, so nothing is written to the job workspace (which may hold only
    ``artifacts/``).
    """
    if path:
        return resolve_workspace_image(workspace, path)
    if knowledge_base is None or uploads_root is None:
        raise ImageResolutionError(
            "image documents are not available in this deployment"
        )
    document = await knowledge_base.get_document(user_id, doc_id)
    if document is None:
        raise ImageResolutionError(
            f"image document '{doc_id}' was not found for this user"
        )
    document_type = str(document.document_type).lower()
    target = _document_file(document, doc_id, uploads_root)
    if document_type == "pdf":
        if page is None:
            raise ImageResolutionError(
                f"document '{doc_id}' is not an image ({IMAGE_TYPE_LABEL} only); "
                f"set 'page' to embed a page of this PDF as a figure"
            )
        return _render_pdf_page(target, doc_id, page)
    if page is not None:
        raise ImageResolutionError(
            f"document '{doc_id}' is not a PDF; 'page' applies only to a PDF"
        )
    if document_type not in _IMAGE_DOCUMENT_TYPES:
        raise ImageResolutionError(
            f"document '{doc_id}' is not an image ({IMAGE_TYPE_LABEL} only)"
        )
    return target


def _render_pdf_page(target: Path, doc_id: str, page: int) -> bytes:
    from app.services.document_preparer import DocumentPreparationError, DocumentPreparer

    try:
        return DocumentPreparer().render_page_png(target, page)
    except DocumentPreparationError as exc:
        raise ImageResolutionError(f"document '{doc_id}': {exc}") from exc
