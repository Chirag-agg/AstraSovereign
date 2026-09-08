"""Local knowledge base: ingest -> extract -> chunk -> embed -> store -> search.

Ownership is explicit and per-user: every document and chunk is scoped to a
``user_id``, and searches only ever touch that user's store. Embeddings and the
vector store are behind interfaces so both can be swapped later.
"""

import logging
import uuid
from pathlib import Path
from typing import Optional

from app.schemas.document import ChunkRecord, DocumentRecord, DocumentStatus, SearchResult
from app.services.document_ingestion import (
    DocumentIngestionError,
    DocumentRequiresOCR,
    build_chunks,
    document_type_for,
    extract_document_pages,
)
from app.services.embedding import EmbeddingError, EmbeddingProvider
from app.services.vector_store import VectorStore

logger = logging.getLogger("app.knowledge_base")


class KnowledgeBase:
    def __init__(
        self,
        vector_store: VectorStore,
        embedding_provider: EmbeddingProvider,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
    ) -> None:
        self._store = vector_store
        self._embedder = embedding_provider
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap

    # ---------------------------------------------------------- ingestion

    async def ingest_document(self, user_id: str, path: Path, filename: str) -> DocumentRecord:
        """Ingest a text-based document (txt/md/text-PDF). Unchanged Phase 7 path."""
        document_type = document_type_for(filename)
        doc = await self._new_document(user_id, filename, document_type)
        try:
            pages = extract_document_pages(path, document_type)
            return await self._ingest_pages(
                user_id, doc, pages, {}, "No extractable text found"
            )
        except DocumentRequiresOCR:
            return await self._fail_document(user_id, doc, "Document requires OCR")
        except (DocumentIngestionError, EmbeddingError) as exc:
            return await self._fail_document(user_id, doc, str(exc))
        except Exception as exc:  # unexpected ingestion failure
            logger.exception(
                "document_ingestion_failed",
                extra={
                    "event": "document_ingestion_failed",
                    "user_id": user_id,
                    "document_id": doc.document_id,
                    "file_name": filename,
                },
            )
            return await self._fail_document(
                user_id, doc, f"internal_error: {exc.__class__.__name__}"
            )

    async def ingest_pages(
        self,
        user_id: str,
        path: Path,
        filename: str,
        pages: list[tuple[Optional[int], str]],
        metadata: Optional[dict] = None,
        empty_text_error: str = "No extractable text found",
    ) -> DocumentRecord:
        """Ingest already-extracted ``(page, text)`` pairs (multimodal path).

        Used by the OCR pipeline for scanned PDFs and image files. When no text
        is produced, the document fails cleanly with ``empty_text_error``.
        """
        document_type = document_type_for(filename)
        doc = await self._new_document(user_id, filename, document_type)
        try:
            return await self._ingest_pages(
                user_id, doc, pages, metadata or {}, empty_text_error
            )
        except EmbeddingError as exc:
            return await self._fail_document(user_id, doc, str(exc))
        except Exception as exc:  # unexpected ingestion failure
            logger.exception(
                "document_ingestion_failed",
                extra={
                    "event": "document_ingestion_failed",
                    "user_id": user_id,
                    "document_id": doc.document_id,
                    "file_name": filename,
                },
            )
            return await self._fail_document(
                user_id, doc, f"internal_error: {exc.__class__.__name__}"
            )

    async def _new_document(
        self, user_id: str, filename: str, document_type: str
    ) -> DocumentRecord:
        document_id = f"doc-{uuid.uuid4().hex[:12]}"
        doc = DocumentRecord(
            document_id=document_id,
            user_id=user_id,
            filename=filename,
            document_type=document_type,
            status=DocumentStatus.PROCESSING,
            source_relpath=f"{user_id}/{filename}",
        )
        await self._store.put_document(user_id, doc)
        logger.info(
            "document_ingestion_started",
            extra={
                "event": "document_ingestion_started",
                "user_id": user_id,
                "document_id": document_id,
                "file_name": filename,
            },
        )
        return doc

    async def _ingest_pages(
        self,
        user_id: str,
        doc: DocumentRecord,
        pages: list[tuple[Optional[int], str]],
        metadata: dict,
        empty_text_error: str,
    ) -> DocumentRecord:
        pieces = build_chunks(pages, self._chunk_size, self._chunk_overlap)
        if not pieces:
            return await self._fail_document(user_id, doc, empty_text_error)
        texts = [piece["text"] for piece in pieces]
        vectors = await self._embedder.embed_many(texts)

        chunks = []
        for index, (piece, vector) in enumerate(zip(pieces, vectors)):
            chunks.append(
                ChunkRecord(
                    chunk_id=f"{doc.document_id}:{index}",
                    document_id=doc.document_id,
                    user_id=user_id,
                    filename=doc.filename,
                    page=piece.get("page"),
                    text=piece["text"],
                    vector=vector,
                )
            )
        await self._store.upsert_chunks(user_id, chunks)

        doc.status = DocumentStatus.READY
        doc.chunk_count = len(chunks)
        doc.metadata = metadata
        await self._store.put_document(user_id, doc)
        logger.info(
            "document_ingestion_completed",
            extra={
                "event": "document_ingestion_completed",
                "user_id": user_id,
                "document_id": doc.document_id,
                "file_name": doc.filename,
                "chunk_count": len(chunks),
                "status": DocumentStatus.READY,
            },
        )
        return doc

    async def _fail_document(self, user_id: str, doc: DocumentRecord, error: str) -> DocumentRecord:
        doc.status = DocumentStatus.FAILED
        doc.error = error[:500]
        await self._store.put_document(user_id, doc)
        logger.error(
            "document_ingestion_failed",
            extra={
                "event": "document_ingestion_failed",
                "user_id": user_id,
                "document_id": doc.document_id,
                "file_name": doc.filename,
                "status": DocumentStatus.FAILED,
                "error": error,
            },
        )
        return doc

    # ------------------------------------------------------------- search

    async def search(self, user_id: str, query: str, top_k: int = 5) -> list[SearchResult]:
        logger.info(
            "document_search_started",
            extra={
                "event": "document_search_started",
                "user_id": user_id,
                "top_k": top_k,
            },
        )
        try:
            query_vector = await self._embedder.embed(query)
            results = await self._store.search(user_id, query_vector, top_k)
        except EmbeddingError as exc:
            logger.error(
                "document_search_failed",
                extra={
                    "event": "document_search_failed",
                    "user_id": user_id,
                    "error": str(exc),
                },
            )
            raise
        logger.info(
            "document_search_completed",
            extra={
                "event": "document_search_completed",
                "user_id": user_id,
                "result_count": len(results),
            },
        )
        return results

    # ------------------------------------------------------------ admin

    async def delete_document(self, user_id: str, document_id: str) -> bool:
        removed = await self._store.delete_document(user_id, document_id)
        if removed:
            logger.info(
                "document_deleted",
                extra={
                    "event": "document_deleted",
                    "user_id": user_id,
                    "document_id": document_id,
                },
            )
        return removed > 0

    async def list_documents(self, user_id: str) -> list[DocumentRecord]:
        return await self._store.list_documents(user_id)

    async def get_document(self, user_id: str, document_id: str) -> Optional[DocumentRecord]:
        return await self._store.get_document(user_id, document_id)

    def stats(self) -> dict:
        return self._store.stats()

    def describe_embedding(self) -> dict:
        return self._embedder.describe()
