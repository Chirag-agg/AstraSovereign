"""Local, persistent vector store.

``JsonVectorStore`` keeps each user's documents and chunk vectors in a JSON file
under the knowledge-base root (``<root>/<user>/store.json``). Search is an exact
cosine similarity over that user's chunks — fully local, no external database.
The ``VectorStore`` abstraction is the seam for swapping in a real vector DB
later without touching the knowledge-base service.
"""

import asyncio
import json
import logging
import math
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.schemas.document import ChunkRecord, DocumentRecord, SearchResult
from app.services.workspace import WorkspaceError, WorkspaceManager

logger = logging.getLogger("app.vector_store")


class VectorStore(ABC):
    @abstractmethod
    async def put_document(self, user_id: str, doc: DocumentRecord) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get_document(self, user_id: str, document_id: str) -> Optional[DocumentRecord]:
        raise NotImplementedError

    @abstractmethod
    async def list_documents(self, user_id: str) -> list[DocumentRecord]:
        raise NotImplementedError

    @abstractmethod
    async def upsert_chunks(self, user_id: str, chunks: list[ChunkRecord]) -> None:
        raise NotImplementedError

    @abstractmethod
    async def delete_document(self, user_id: str, document_id: str) -> int:
        raise NotImplementedError

    @abstractmethod
    async def search(self, user_id: str, query_vector: list[float], top_k: int) -> list[SearchResult]:
        raise NotImplementedError

    async def search_hybrid(
        self, user_id: str, query: str, query_vector: list[float], top_k: int
    ) -> list[SearchResult]:
        """Dense + keyword fusion. Default is dense-only for other stores."""
        return await self.search(user_id, query_vector, top_k)

    @abstractmethod
    def stats(self) -> dict:
        raise NotImplementedError


class JsonVectorStore(VectorStore):
    """Per-user JSON-file-backed vector store with cosine search."""

    def __init__(self, root: str) -> None:
        self._root = Path(root).resolve()
        self._root.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._cache: dict[str, dict] = {}

    # ----------------------------------------------------------- storage

    def _user_dir(self, user_id: str) -> Path:
        try:
            safe = WorkspaceManager.safe_component(user_id)
        except WorkspaceError:
            safe = "_"
        return self._root / safe

    def _path(self, user_id: str) -> Path:
        return self._user_dir(user_id) / "store.json"

    def _empty(self) -> dict:
        return {"documents": {}, "chunks": []}

    async def _load(self, user_id: str) -> dict:
        if user_id in self._cache:
            return self._cache[user_id]
        path = self._path(user_id)
        data = self._empty()
        if path.exists():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                data = {
                    "documents": raw.get("documents", {}),
                    "chunks": raw.get("chunks", []),
                }
            except (json.JSONDecodeError, OSError):
                logger.warning(
                    "vector_store_corrupt",
                    extra={"event": "vector_store_corrupt", "user_id": user_id},
                )
                data = self._empty()
        self._cache[user_id] = data
        return data

    async def _save(self, user_id: str) -> None:
        data = self._cache.get(user_id)
        if data is None:
            return
        path = self._path(user_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, default=str), encoding="utf-8")

    # ------------------------------------------------------------- ops

    async def put_document(self, user_id: str, doc: DocumentRecord) -> None:
        async with self._lock:
            data = await self._load(user_id)
            data["documents"][doc.document_id] = doc.model_dump()
            await self._save(user_id)

    async def get_document(self, user_id: str, document_id: str) -> Optional[DocumentRecord]:
        async with self._lock:
            data = await self._load(user_id)
            raw = data["documents"].get(document_id)
            return DocumentRecord(**raw) if raw else None

    async def list_documents(self, user_id: str) -> list[DocumentRecord]:
        async with self._lock:
            data = await self._load(user_id)
            return [DocumentRecord(**raw) for raw in data["documents"].values()]

    async def upsert_chunks(self, user_id: str, chunks: list[ChunkRecord]) -> None:
        async with self._lock:
            data = await self._load(user_id)
            existing = {c["chunk_id"] for c in data["chunks"]}
            for chunk in chunks:
                if chunk.chunk_id in existing:
                    data["chunks"] = [c for c in data["chunks"] if c["chunk_id"] != chunk.chunk_id]
                data["chunks"].append(chunk.model_dump())
            await self._save(user_id)

    async def delete_document(self, user_id: str, document_id: str) -> int:
        async with self._lock:
            data = await self._load(user_id)
            removed = data["documents"].pop(document_id, None)
            before = len(data["chunks"])
            data["chunks"] = [
                c for c in data["chunks"] if c["document_id"] != document_id
            ]
            count = before - len(data["chunks"])
            await self._save(user_id)
            return count if removed else 0

    async def search(self, user_id: str, query_vector: list[float], top_k: int) -> list[SearchResult]:
        async with self._lock:
            data = await self._load(user_id)
        scored = []
        for chunk in data["chunks"]:
            score = _cosine(query_vector, chunk.get("vector") or [])
            scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            SearchResult(
                chunk_id=c["chunk_id"],
                document_id=c["document_id"],
                filename=c["filename"],
                page=c.get("page"),
                text=c["text"],
                score=round(score, 6),
            )
            for score, c in scored[:top_k]
        ]

    async def search_hybrid(
        self,
        user_id: str,
        query: str,
        query_vector: list[float],
        top_k: int,
        per_page_cap: int = 2,
        duplicate_threshold: float = 0.95,
    ) -> list[SearchResult]:
        """Dense + BM25 fused with Reciprocal Rank Fusion, then diversified.

        - at most ``per_page_cap`` chunks from any one ``(doc_id, page)``
        - drop near-duplicates (cosine to an already-selected chunk > threshold)
        - RRF score = sum over rankings of ``1 / (60 + rank)`` (no tuning needed)
        """
        async with self._lock:
            data = await self._load(user_id)
        chunks = data["chunks"]
        if not chunks:
            return []

        dense_rank = {
            chunk["chunk_id"]: index + 1
            for index, chunk in enumerate(
                sorted(
                    chunks,
                    key=lambda c: _cosine(query_vector, c.get("vector") or []),
                    reverse=True,
                )
            )
        }
        bm25_rank = {
            chunk["chunk_id"]: index + 1
            for index, (score, chunk) in enumerate(_bm25_rank(query, chunks))
            if score > 0
        }

        fused: list[tuple[float, dict]] = []
        for chunk in chunks:
            chunk_id = chunk["chunk_id"]
            score = 0.0
            if chunk_id in dense_rank:
                score += 1.0 / (60 + dense_rank[chunk_id])
            if chunk_id in bm25_rank:
                score += 1.0 / (60 + bm25_rank[chunk_id])
            if score > 0:
                fused.append((score, chunk))
        fused.sort(key=lambda item: item[0], reverse=True)

        selected: list[tuple[float, dict]] = []
        per_page: dict[tuple, int] = {}
        for score, chunk in fused:
            key = (chunk["document_id"], chunk.get("page"))
            if per_page.get(key, 0) >= per_page_cap:
                continue
            vector = chunk.get("vector") or []
            if any(
                _cosine(vector, other.get("vector") or []) > duplicate_threshold
                for _, other in selected
            ):
                continue
            selected.append((score, chunk))
            per_page[key] = per_page.get(key, 0) + 1
            if len(selected) >= top_k:
                break

        return [
            SearchResult(
                chunk_id=chunk["chunk_id"],
                document_id=chunk["document_id"],
                filename=chunk["filename"],
                page=chunk.get("page"),
                text=chunk["text"],
                score=round(score, 6),
            )
            for score, chunk in selected
        ]

    def stats(self) -> dict:
        documents = 0
        chunks = 0
        for user_dir in self._root.iterdir():
            path = user_dir / "store.json"
            if not path.is_file():
                continue
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            documents += len(raw.get("documents", {}))
            chunks += len(raw.get("chunks", []))
        return {"documents": documents, "chunks": chunks}


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


_TOKEN_RE = re.compile(r"[a-z0-9]+(?:[.\-/][a-z0-9]+)*")


def _tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokens, keeping exact codes like sop-09 / 0.455."""
    return _TOKEN_RE.findall((text or "").lower())


def _bm25_rank(query: str, chunks: list[dict], k1: float = 1.5, b: float = 0.75):
    """BM25 over the chunks; returns ``[(score, chunk)]`` sorted by score desc."""
    if not chunks:
        return []
    docs = [_tokenize(chunk.get("text", "")) for chunk in chunks]
    count = len(docs)
    avgdl = (sum(len(doc) for doc in docs) / count) or 1.0
    df: dict[str, int] = {}
    for doc in docs:
        for token in set(doc):
            df[token] = df.get(token, 0) + 1
    query_tokens = _tokenize(query)
    scored = []
    for chunk, doc in zip(chunks, docs):
        length = len(doc) or 1
        tf: dict[str, int] = {}
        for token in doc:
            tf[token] = tf.get(token, 0) + 1
        score = 0.0
        for token in query_tokens:
            if token not in tf:
                continue
            idf = math.log(1.0 + (count - df.get(token, 0) + 0.5) / (df.get(token, 0) + 0.5))
            score += idf * (tf[token] * (k1 + 1)) / (
                tf[token] + k1 * (1 - b + b * length / avgdl)
            )
        scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored
