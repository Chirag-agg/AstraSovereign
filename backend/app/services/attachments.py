"""Structured attachment manifest for the extract / retrieve nodes.

The extract node cannot discover uploaded artifacts by listing its workspace:
uploads live under ``uploads/<user>`` and the knowledge base, not the job
workspace, and a nameplate image has no indexable text. So the documents attached
to a job are enumerated into the node input as structured data.

``doc_id`` is the knowledge-base document id — the same identifier
``document_vision`` accepts (verified against the tool's argument handling).
"""

from app.schemas.document import DocumentRecord

_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "txt": "text/plain",
    "md": "text/markdown",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
}


def media_type_for(document_type: str) -> str:
    return _MEDIA_TYPES.get(document_type, "application/octet-stream")


def kind_for(document: DocumentRecord) -> str:
    """Classify a document for the manifest.

    ``scanned_pdf`` vs ``text_pdf`` is taken from the ingestion metadata the
    multimodal path records (``ocr: true``); the plain PDF path stores none.
    """
    document_type = document.document_type
    if document_type in ("png", "jpg", "jpeg"):
        return "image"
    if document_type == "pdf":
        return "scanned_pdf" if (document.metadata or {}).get("ocr") else "text_pdf"
    if document_type in ("xlsx", "csv"):
        return "spreadsheet"
    return "other"


def build_attachment_manifest(documents: list[DocumentRecord]) -> list[dict]:
    manifest = []
    for document in documents:
        manifest.append(
            {
                "doc_id": document.document_id,
                "filename": document.filename,
                "media_type": media_type_for(document.document_type),
                "kind": kind_for(document),
                "pages": (document.metadata or {}).get("page_count"),
            }
        )
    return manifest


def render_attachment_block(manifest: list[dict]) -> str:
    """Compact structured block rendered into a node's *user* message."""
    if not manifest:
        return ""
    lines = ["attachments:"]
    for item in manifest:
        pages = item.get("pages")
        lines.append(f"  - doc_id: {item['doc_id']}")
        lines.append(f"    filename: {item['filename']}")
        lines.append(f"    media_type: {item['media_type']}")
        lines.append(f"    kind: {item['kind']}")
        lines.append(f"    pages: {pages if pages is not None else 'unknown'}")
    return "\n".join(lines)
