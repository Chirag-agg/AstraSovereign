"""HTTP API: document upload, listing, and deletion.

All operations are scoped to the authenticated user's own knowledge base. There
is deliberately no public search endpoint here — the agent reaches the knowledge
base only through the ``document_search`` tool. Image files and scanned
(image-only) PDFs are routed through the local OCR pipeline; text-based
documents keep the existing Phase 7 ingestion path.
"""

import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_user_id
from app.services.attachments import media_type_for
from app.services.document_ingestion import (
    CONTAINER_DOCUMENT_TYPES,
    IMAGE_DOCUMENT_TYPES,
    PLAIN_DOCUMENT_TYPES,
    DocumentIngestionError,
    document_type_for,
    extract_pdf_page_layouts,
    page_requires_ocr,
)
from app.services.multimodal import MultimodalError
from app.services.workspace import WorkspaceManager

logger = logging.getLogger("app.api.documents")

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _safe_filename(name: str) -> str:
    basename = Path(name or "document").name
    cleaned = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in basename)
    return cleaned or "document"


def _metadata(doc) -> dict:
    return {
        "document_id": doc.document_id,
        "filename": doc.filename,
        "document_type": doc.document_type,
        "status": doc.status,
        "chunk_count": doc.chunk_count,
        "created_at": doc.created_at.isoformat(),
        "error": doc.error,
        # Pages the pipeline could not read. Surfaced at the API so a caller
        # sees an incomplete document as incomplete without having to know to
        # inspect metadata.
        "unreadable_pages": list((doc.metadata or {}).get("unreadable_pages") or []),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    request: Request,
    document_kind: Optional[str] = Form(None),
    user_id: str = Depends(get_user_id),
) -> dict:

    """Upload and ingest a document into the user's KB.

    Accepts the document families in ``SUPPORTED_DOCUMENT_TYPES`` (pdf and the
    raster image formats, Office and OpenDocument files, data, markup, and
    source code). Images and image-only PDFs route through the local OCR
    pipeline; an Office/OpenDocument file is ingested with the pictures inside
    it; everything else goes through the knowledge base's extractor.
    """
    knowledge_base = request.app.state.knowledge_base
    multimodal = request.app.state.multimodal_service
    uploads_root = Path(request.app.state.settings.uploads_root)

    filename = _safe_filename(file.filename or "")
    try:
        document_type = document_type_for(filename)
    except DocumentIngestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "unsupported_document_type", "message": str(exc)},
        )

    user_dir = uploads_root / WorkspaceManager.safe_component(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    destination = user_dir / filename
    destination.write_bytes(await file.read())

    effective_kind = (
        (document_kind or "").strip().lower()
        or request.query_params.get("document_kind", "").strip().lower()
        or "general"
    )

    if effective_kind == "pid":
        try:
            doc = await multimodal.ingest_pid(user_id, destination, filename)
        except MultimodalError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "pid_extraction_failed", "message": str(exc)},
            )
        return _metadata(doc)

    if document_type in IMAGE_DOCUMENT_TYPES:
        try:
            doc = await multimodal.ingest_scanned(user_id, destination, filename)
        except MultimodalError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "ocr_unavailable", "message": str(exc)},
            )
        return _metadata(doc)

    if document_type in CONTAINER_DOCUMENT_TYPES:
        # An Office/OpenDocument file is ingested with the pictures it carries:
        # each becomes its own image document, and its recognised text joins the
        # page it sits on. A container with no pictures takes the plain path.
        try:
            doc = await multimodal.ingest_container(user_id, destination, filename)
        except MultimodalError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "container_ingestion_failed", "message": str(exc)},
            )
        return _metadata(doc)

    if document_type == "pdf":
        try:
            layouts = extract_pdf_page_layouts(destination)
        except DocumentIngestionError:
            layouts = None  # malformed PDF — let KnowledgeBase fail it cleanly
        if layouts is not None and not any(layout.text for layout in layouts):
            # No text layer anywhere: an image-only scan.
            try:
                doc = await multimodal.ingest_scanned(user_id, destination, filename)
            except MultimodalError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error": "ocr_unavailable", "message": str(exc)},
                )
            return _metadata(doc)
        if layouts is not None:
            # A page that needs recognising — a page-scale raster carrying only
            # a stamp, say — is the case the whole-document paths cannot
            # express: keep the typed pages' text layers and OCR only the pages
            # that need it.
            settings = request.app.state.settings
            if multimodal.ocr_available and any(
                page_requires_ocr(
                    layout.text, layout.raster_dominant, settings.ocr_page_min_text_chars
                )
                for layout in layouts
            ):
                try:
                    doc = await multimodal.ingest_pdf(user_id, destination, filename)
                except MultimodalError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"error": "ocr_unavailable", "message": str(exc)},
                    )
                return _metadata(doc)

    doc = await knowledge_base.ingest_document(user_id, destination, filename)
    return _metadata(doc)


@router.get("")
async def list_documents(
    request: Request,
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    knowledge_base = request.app.state.knowledge_base
    docs = await knowledge_base.list_documents(user_id)
    docs.sort(key=lambda d: d.created_at, reverse=True)
    return [_metadata(doc) for doc in docs]


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    knowledge_base = request.app.state.knowledge_base
    doc = await knowledge_base.get_document(user_id, document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "document_not_found", "message": "Document not found."},
        )
    return _metadata(doc)


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    """Retrieve the full text content and metadata of a knowledge base document."""
    knowledge_base = request.app.state.knowledge_base
    doc = await knowledge_base.get_document(user_id, document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "document_not_found", "message": "Document not found."},
        )

    uploads_root = Path(request.app.state.settings.uploads_root)
    user_dir = uploads_root / WorkspaceManager.safe_component(user_id)
    file_path = user_dir / doc.filename

    # Retrieve all indexed chunks for this document to reconstruct full text
    store = knowledge_base._store
    raw_data = await store._load(user_id)
    chunks = [c for c in raw_data.get("chunks", []) if c.get("document_id") == document_id]
    chunks.sort(key=lambda c: (c.get("page") or 0, c.get("chunk_id", "")))
    extracted_text = "\n\n".join(c.get("text", "").strip() for c in chunks if c.get("text"))

    # If raw file exists and is already plain text, read directly for pristine
    # formatting — the extracted chunks are the same bytes, just re-wrapped.
    raw_text = None
    if file_path.exists() and doc.document_type in PLAIN_DOCUMENT_TYPES:
        try:
            raw_text = file_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            raw_text = None

    return {
        "document_id": doc.document_id,
        "filename": doc.filename,
        "document_type": doc.document_type,
        "status": doc.status,
        "chunk_count": doc.chunk_count,
        "has_file": file_path.exists(),
        "text": raw_text or extracted_text or "",
        "size_bytes": file_path.stat().st_size if file_path.exists() else 0,
    }


@router.get("/{document_id}/file")
async def get_document_raw_file(
    document_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> FileResponse:
    """Serve the raw uploaded document file for in-browser PDF, image, and document preview."""
    knowledge_base = request.app.state.knowledge_base
    doc = await knowledge_base.get_document(user_id, document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "document_not_found", "message": "Document not found."},
        )

    uploads_root = Path(request.app.state.settings.uploads_root)
    user_dir = uploads_root / WorkspaceManager.safe_component(user_id)
    file_path = user_dir / doc.filename
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "file_not_found", "message": "Raw file not found on disk."},
        )

    ext = doc.filename.split(".")[-1].lower() if "." in doc.filename else doc.document_type
    media_type = media_type_for(ext)

    return FileResponse(
        file_path,
        filename=doc.filename,
        media_type=media_type,
        content_disposition_type="inline",
    )


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    knowledge_base = request.app.state.knowledge_base
    removed = await knowledge_base.delete_document(user_id, document_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "document_not_found", "message": "Document not found."},
        )
    return {"document_id": document_id, "deleted": True}

