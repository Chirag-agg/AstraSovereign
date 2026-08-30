"""Document knowledge-base models."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DocumentStatus:
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentRecord(BaseModel):
    """A normalized ingested document (metadata only, never the extracted text)."""

    document_id: str
    user_id: str
    filename: str
    document_type: str  # pdf | txt | md
    status: str = DocumentStatus.QUEUED
    chunk_count: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    metadata: dict = Field(default_factory=dict)
    error: Optional[str] = None
    source_relpath: Optional[str] = None


class ChunkRecord(BaseModel):
    """One indexed chunk with its embedding vector."""

    chunk_id: str
    document_id: str
    user_id: str
    filename: str
    page: Optional[int] = None
    text: str
    metadata: dict = Field(default_factory=dict)
    vector: list[float] = Field(default_factory=list)


class SearchResult(BaseModel):
    """A single retrieval hit with source metadata."""

    chunk_id: str
    document_id: str
    filename: str
    page: Optional[int] = None
    text: str
    score: float
