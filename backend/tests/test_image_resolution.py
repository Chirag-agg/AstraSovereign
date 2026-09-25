"""Image reference parsing and resolution for the deliverable tools.

Covers the two reference forms (a workspace-relative ``path`` and an uploaded
document's ``doc_id``), the ``page`` a PDF needs to be embeddable as a figure,
and every way a reference is refused.
"""

import asyncio
from pathlib import Path

import pytest

from app.services.image_resolution import (
    ImageResolutionError,
    parse_image_reference,
    resolve_image_source,
)
from tests.conftest import make_png, make_text_pdf

_IMAGE_TYPES = {"png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp"}


def run(coro):
    return asyncio.run(coro)


class StubKnowledgeBase:
    """Returns one record, scoped to its own user."""

    def __init__(self, record=None):
        self._record = record

    async def get_document(self, user_id, document_id):
        record = self._record
        if record is None or record.document_id != document_id:
            return None
        return record if record.user_id == user_id else None


def make_record(record_id="doc-img-1", filename="crop.png", document_type="png",
                user_id="user-001"):
    from app.schemas.document import DocumentRecord

    return DocumentRecord(
        document_id=record_id,
        user_id=user_id,
        filename=filename,
        document_type=document_type,
        status="ready",
    )


def make_upload(tmp_path, filename, document_type, lines=None):
    """Write an upload under ``<uploads_root>/<user>/`` and return (root, record)."""
    root = tmp_path / "uploads"
    user_dir = root / "user-001"
    user_dir.mkdir(parents=True, exist_ok=True)
    target = user_dir / filename
    if document_type == "pdf":
        make_text_pdf(target, lines or ["Pump maintenance", "Seal inspection"])
    elif document_type in _IMAGE_TYPES:
        make_png(target, lines or ["P&ID detail"])
    else:
        target.write_text(lines and lines[0] or "not an image", encoding="utf-8")
    return root, make_record(filename=filename, document_type=document_type)


def make_multipage_pdf(path, page_count=2):
    from reportlab.pdfgen import canvas

    pdf = canvas.Canvas(str(path))
    for index in range(1, page_count + 1):
        pdf.drawString(72, 760, f"Page {index} content")
        pdf.showPage()
    pdf.save()


# ----------------------------------------------------------- parse

def test_parse_accepts_a_doc_id_with_a_page():
    path, doc_id, page = parse_image_reference({"doc_id": "d1", "page": 3})
    assert (path, doc_id, page) == ("", "d1", 3)


def test_parse_accepts_a_path_without_a_page():
    assert parse_image_reference({"path": "crop.png"}) == ("crop.png", "", None)


def test_parse_rejects_a_page_without_a_doc_id():
    with pytest.raises(ImageResolutionError, match="applies only to a 'doc_id'"):
        parse_image_reference({"path": "crop.png", "page": 2})


@pytest.mark.parametrize("page", [0, 501, "2", True])
def test_parse_rejects_a_page_out_of_range_or_not_an_integer(page):
    with pytest.raises(ImageResolutionError, match="between 1 and 500"):
        parse_image_reference({"doc_id": "d1", "page": page})


# -------------------------------------------------------- resolve

def test_resolve_a_workspace_image_returns_its_path(tmp_path):
    make_png(tmp_path / "crop.png", ["detail"])
    resolved = run(
        resolve_image_source(
            path="crop.png", doc_id="", workspace=tmp_path, user_id="user-001"
        )
    )
    assert isinstance(resolved, Path)
    assert resolved.is_file()


def test_resolve_rejects_a_workspace_path_that_escapes(tmp_path):
    with pytest.raises(ImageResolutionError, match="escapes"):
        run(
            resolve_image_source(
                path="../outside.png", doc_id="", workspace=tmp_path, user_id="user-001"
            )
        )


def test_resolve_rejects_a_non_image_workspace_path(tmp_path):
    (tmp_path / "notes.txt").write_text("x", encoding="utf-8")
    with pytest.raises(ImageResolutionError, match="unsupported image type"):
        run(
            resolve_image_source(
                path="notes.txt", doc_id="", workspace=tmp_path, user_id="user-001"
            )
        )


def test_resolve_an_uploaded_image_document(tmp_path):
    root, record = make_upload(tmp_path, "crop.png", "png")
    resolved = run(
        resolve_image_source(
            path="",
            doc_id="doc-img-1",
            workspace=tmp_path,
            user_id="user-001",
            knowledge_base=StubKnowledgeBase(record),
            uploads_root=root,
        )
    )
    assert isinstance(resolved, Path)
    assert resolved.name == "crop.png"


def test_resolve_a_pdf_page_returns_png_bytes(tmp_path):
    """A page embedded as a figure is rendered in memory — the job workspace
    may hold only ``artifacts/``."""
    root, record = make_upload(tmp_path, "report.pdf", "pdf")
    upload = root / "user-001" / "report.pdf"
    make_multipage_pdf(upload, page_count=2)
    resolved = run(
        resolve_image_source(
            path="",
            doc_id="doc-img-1",
            page=2,
            workspace=tmp_path,
            user_id="user-001",
            knowledge_base=StubKnowledgeBase(record),
            uploads_root=root,
        )
    )
    assert isinstance(resolved, bytes)
    assert resolved.startswith(b"\x89PNG")


def test_resolve_a_pdf_without_a_page_names_the_fix(tmp_path):
    root, record = make_upload(tmp_path, "report.pdf", "pdf")
    with pytest.raises(ImageResolutionError) as excinfo:
        run(
            resolve_image_source(
                path="",
                doc_id="doc-img-1",
                workspace=tmp_path,
                user_id="user-001",
                knowledge_base=StubKnowledgeBase(record),
                uploads_root=root,
            )
        )
    assert "is not an image" in str(excinfo.value)
    assert "set 'page'" in str(excinfo.value)


def test_resolve_rejects_a_page_on_a_non_pdf(tmp_path):
    root, record = make_upload(tmp_path, "crop.png", "png")
    with pytest.raises(ImageResolutionError, match="applies only to a PDF"):
        run(
            resolve_image_source(
                path="",
                doc_id="doc-img-1",
                page=1,
                workspace=tmp_path,
                user_id="user-001",
                knowledge_base=StubKnowledgeBase(record),
                uploads_root=root,
            )
        )


def test_resolve_rejects_a_non_image_document(tmp_path):
    root, record = make_upload(tmp_path, "notes.txt", "txt")
    with pytest.raises(ImageResolutionError, match="is not an image"):
        run(
            resolve_image_source(
                path="",
                doc_id="doc-img-1",
                workspace=tmp_path,
                user_id="user-001",
                knowledge_base=StubKnowledgeBase(record),
                uploads_root=root,
            )
        )


def test_resolve_rejects_another_users_document(tmp_path):
    root, record = make_upload(tmp_path, "crop.png", "png")
    with pytest.raises(ImageResolutionError, match="was not found for this user"):
        run(
            resolve_image_source(
                path="",
                doc_id="doc-img-1",
                workspace=tmp_path,
                user_id="user-002",
                knowledge_base=StubKnowledgeBase(record),
                uploads_root=root,
            )
        )


def test_resolve_without_wiring_is_refused(tmp_path):
    with pytest.raises(ImageResolutionError, match="not available in this deployment"):
        run(
            resolve_image_source(
                path="", doc_id="doc-img-1", workspace=tmp_path, user_id="user-001"
            )
        )
