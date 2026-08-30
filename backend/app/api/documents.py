"""HTTP API: document upload, listing, and deletion.

All operations are scoped to the authenticated user's own knowledge base. There
is deliberately no public search endpoint here — the agent reaches the knowledge
base only through the ``document_search`` tool. Image files and scanned
(image-only) PDFs are routed through the local OCR pipeline; text-based
documents keep the existing Phase 7 ingestion path.
"""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status

from app.api.deps import get_user_id
from app.services.document_ingestion import (
    IMAGE_DOCUMENT_TYPES,
    DocumentIngestionError,
    DocumentRequiresOCR,
    document_type_for,
    extract_document_pages,
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
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    """Upload and ingest a document (pdf/txt/md/png/jpg/jpeg) into the user's KB."""
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

    if document_type in IMAGE_DOCUMENT_TYPES:
        try:
            doc = await multimodal.ingest_scanned(user_id, destination, filename)
        except MultimodalError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "ocr_unavailable", "message": str(exc)},
            )
        return _metadata(doc)

    if document_type == "pdf":
        try:
            extract_document_pages(destination, "pdf")
        except DocumentRequiresOCR:
            try:
                doc = await multimodal.ingest_scanned(user_id, destination, filename)
            except MultimodalError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error": "ocr_unavailable", "message": str(exc)},
                )
            return _metadata(doc)
        except DocumentIngestionError:
            pass  # malformed PDF — let KnowledgeBase fail it cleanly

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
