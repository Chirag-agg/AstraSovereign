"""Per-document extraction artifact.

One structured record per ingested document: ordered elements (text/page/bbox/
type/confidence) plus a markdown rendering the agent reads whole via
``read_document``. ``confidence`` is ``None`` when the backend does not expose
it (pypdf, and Docling as measured) — the escalation gate must handle a missing
signal rather than assume one.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExtractionElement(BaseModel):
    type: str = "text"  # text | table | section_header | image | ...
    page: Optional[int] = None
    bbox: Optional[list[float]] = None  # [left, top, right, bottom], page units
    text: str = ""
    confidence: Optional[float] = None


class DocumentExtraction(BaseModel):
    document_id: str
    filename: str
    document_type: str
    backend: str = "pypdf"
    page_count: int = 0
    elements: list[ExtractionElement] = Field(default_factory=list)
    markdown: str = ""
    created_at: datetime = Field(default_factory=utcnow)
