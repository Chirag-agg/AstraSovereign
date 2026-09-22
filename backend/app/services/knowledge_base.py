"""Local knowledge base: ingest -> extract -> chunk -> embed -> store -> search.

Ownership is explicit and per-user: every document and chunk is scoped to a
``user_id``, and searches only ever touch that user's store. Embeddings and the
vector store are behind interfaces so both can be swapped later.
"""

import asyncio
import hashlib
import logging
import re
import uuid
from pathlib import Path
from typing import Optional

from app.schemas.document import ChunkRecord, DocumentRecord, DocumentStatus, SearchResult
from app.schemas.extraction import ExtractionElement
from app.services.document_ingestion import (
    DocumentIngestionError,
    DocumentRequiresOCR,
    build_chunks,
    document_type_for,
    extract_document_pages,
)
from app.services.embedding import EmbeddingError, EmbeddingProvider
from app.services.extractor import DocumentExtractor
from app.services.vector_store import VectorStore

logger = logging.getLogger("app.knowledge_base")


def _hash_file(path: Path) -> str:
    """Content hash used to deduplicate identical uploads; '' on read failure."""
    try:
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()
    except OSError:
        return ""


_REV_RE = re.compile(r"rev[ _-]?(\d+)", re.IGNORECASE)


def _document_revision(filename: str) -> Optional[int]:
    match = _REV_RE.search(filename or "")
    return int(match.group(1)) if match else None


def _document_family(filename: str) -> str:
    """Normalized identity for grouping revisions of "the same" document
    (e.g. ``SOP-09_Rev2.pdf`` and ``SOP-09_Rev3.pdf`` share this key) so a
    newer upload can mark an older one as superseded."""
    stem = Path(filename or "").stem
    stem = _REV_RE.sub("", stem)
    return re.sub(r"[^a-z0-9]+", " ", stem.lower()).strip()


def _chunk_header(filename: str, page: Optional[int]) -> str:
    """Indexed-text prefix carrying source metadata (D3).

    Section headings are not tracked yet (structure-aware chunking is deferred),
    so the header is document + revision + page.
    """
    parts = [filename]
    revision = _REV_RE.search(filename or "")
    if revision:
        parts.append(f"Rev {revision.group(1)}")
    if page is not None:
        parts.append(f"p.{page}")
    return f"[{' | '.join(parts)}]"


class KnowledgeBase:
    def __init__(
        self,
        vector_store: VectorStore,
        embedding_provider: EmbeddingProvider,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
        extraction_store=None,
        extractor: Optional[DocumentExtractor] = None,
    ) -> None:
        self._store = vector_store
        self._embedder = embedding_provider
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap
        self._extraction_store = extraction_store
        self._extractor = extractor or DocumentExtractor()

    # ---------------------------------------------------------- ingestion

    async def ingest_document(self, user_id: str, path: Path, filename: str) -> DocumentRecord:
        """Ingest a text-based document (txt/md/text-PDF). Unchanged Phase 7 path."""
        document_type = document_type_for(filename)
        content_hash = _hash_file(path)
        existing = await self._find_by_content_hash(user_id, content_hash)
        if existing is not None:
            self._log_reused(user_id, filename, existing.document_id)
            return existing
        doc = await self._new_document(
            user_id, filename, document_type, {"content_hash": content_hash}
        )
        try:
            pages = extract_document_pages(path, document_type)
            return await self._ingest_pages(
                user_id,
                doc,
                pages,
                {"content_hash": content_hash},
                "No extractable text found",
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
        elements: Optional[list[ExtractionElement]] = None,
    ) -> DocumentRecord:
        """Ingest already-extracted ``(page, text)`` pairs (multimodal path).

        Used by the OCR pipeline for scanned PDFs and image files. When no text
        is produced, the document fails cleanly with ``empty_text_error``.

        ``pages`` still drives chunking; ``elements`` — when a caller has real
        provenance (an OCR region's bbox and confidence, a page that came from a
        text layer) — drives the extraction artifact instead of the lossy
        ``(page, text)`` shape.
        """
        document_type = document_type_for(filename)
        content_hash = _hash_file(path)
        existing = await self._find_by_content_hash(user_id, content_hash)
        if existing is not None:
            self._log_reused(user_id, filename, existing.document_id)
            return existing
        merged_metadata = dict(metadata or {})
        merged_metadata["content_hash"] = content_hash
        doc = await self._new_document(
            user_id, filename, document_type, {"content_hash": content_hash}
        )
        try:
            return await self._ingest_pages(
                user_id, doc, pages, merged_metadata, empty_text_error, elements=elements
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
        self,
        user_id: str,
        filename: str,
        document_type: str,
        metadata: Optional[dict] = None,
    ) -> DocumentRecord:
        document_id = f"doc-{uuid.uuid4().hex[:12]}"
        doc = DocumentRecord(
            document_id=document_id,
            user_id=user_id,
            filename=filename,
            document_type=document_type,
            status=DocumentStatus.PROCESSING,
            metadata=metadata or {},
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
        elements: Optional[list[ExtractionElement]] = None,
    ) -> DocumentRecord:
        pieces = build_chunks(pages, self._chunk_size, self._chunk_overlap)
        if not pieces:
            return await self._fail_document(user_id, doc, empty_text_error)
        for piece in pieces:
            piece["text"] = f"{_chunk_header(doc.filename, piece.get('page'))} {piece['text']}"
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

        # Persist the per-document extraction artifact (elements + markdown) that
        # ``read_document`` serves. Failure here must not fail ingestion.
        if self._extraction_store is not None:
            try:
                document_sha256 = (metadata or {}).get("content_hash", "")
                if elements is not None:
                    extraction = self._extractor.from_elements(
                        doc.document_id,
                        doc.filename,
                        doc.document_type,
                        elements,
                        document_sha256=document_sha256,
                    )
                else:
                    extraction = self._extractor.from_pages(
                        doc.document_id,
                        doc.filename,
                        doc.document_type,
                        pages,
                        document_sha256=document_sha256,
                    )
                await asyncio.to_thread(self._extraction_store.put, user_id, extraction)
            except Exception:
                logger.exception(
                    "extraction_build_failed",
                    extra={
                        "event": "extraction_build_failed",
                        "user_id": user_id,
                        "document_id": doc.document_id,
                    },
                )

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
        await self._apply_supersession(user_id, doc)
        return doc

    async def _apply_supersession(self, user_id: str, doc: DocumentRecord) -> None:
        """Mark older revisions of the same document family as superseded.

        Triggered at ingestion, not guessed at query time: filenames carrying
        a "Rev N" token (SOP-09_Rev2.pdf, SOP-09_Rev3.pdf, ...) that otherwise
        match are "the same document"; retrieval (search_hybrid) deprioritizes
        a superseded revision's chunks so the current one never loses to it by
        chance, without discarding the older text (still needed to compute
        e.g. a corrosion rate between two revisions).
        """
        revision = _document_revision(doc.filename)
        if revision is None:
            return
        family = _document_family(doc.filename)
        if not family:
            return
        siblings = [
            other
            for other in await self._store.list_documents(user_id)
            if other.document_id != doc.document_id
            and other.status == DocumentStatus.READY
            and _document_family(other.filename) == family
        ]
        if not siblings:
            return
        current_max = revision
        for sibling in siblings:
            sibling_revision = _document_revision(sibling.filename)
            if sibling_revision is not None:
                current_max = max(current_max, sibling_revision)
        for candidate in (doc, *siblings):
            candidate_revision = _document_revision(candidate.filename)
            if candidate_revision is None:
                continue
            superseded = candidate_revision < current_max
            if (
                candidate.metadata.get("superseded") == superseded
                and candidate.metadata.get("revision") == candidate_revision
            ):
                continue
            candidate.metadata = {
                **candidate.metadata,
                "revision": candidate_revision,
                "superseded": superseded,
            }
            await self._store.put_document(user_id, candidate)

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

    async def _find_by_content_hash(
        self, user_id: str, content_hash: str
    ) -> Optional[DocumentRecord]:
        """Reuse a READY document with identical bytes for the same user."""
        if not content_hash:
            return None
        for document in await self._store.list_documents(user_id):
            if (
                document.status == DocumentStatus.READY
                and (document.metadata or {}).get("content_hash") == content_hash
            ):
                return document
        return None

    @staticmethod
    def _log_reused(user_id: str, filename: str, document_id: str) -> None:
        logger.info(
            "document_reused",
            extra={
                "event": "document_reused",
                "user_id": user_id,
                "document_id": document_id,
                "file_name": filename,
            },
        )

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
            results = await self._store.search_hybrid(user_id, query, query_vector, top_k)
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
        if removed and self._extraction_store is not None:
            await asyncio.to_thread(self._extraction_store.delete, user_id, document_id)
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

    def get_extraction(self, user_id: str, document_id: str):
        """The caller's extraction artifact for a document, or ``None``."""
        if self._extraction_store is None:
            return None
        return self._extraction_store.get(user_id, document_id)

    def stats(self) -> dict:
        return self._store.stats()

    def describe_embedding(self) -> dict:
        return self._embedder.describe()
