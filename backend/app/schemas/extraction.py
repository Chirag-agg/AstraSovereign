"""Per-document extraction artifact.

One structured record per ingested document: ordered elements (text/page/bbox/
type/confidence) plus a markdown rendering the agent reads whole via
``read_document``. ``confidence`` is ``None`` when the backend does not expose
it (pypdf, and Docling as measured) — the escalation gate must handle a missing
signal rather than assume one.

Schema v2 adds provenance. Every added field is optional, so a v1 artifact
(written before these fields existed) still loads unchanged: ``element_id``,
``order``, ``subtype``, ``source``, ``heading_path``, ``image_path`` and
``table`` simply come back as their defaults. ``source`` records where an
element came from — a PDF text layer, local OCR, geometric table
reconstruction, Docling, or vision — so a downstream consumer can always tell a
typed value from a recognised (and possibly misread) one.

Provenance is never invented: if a backend does not supply a bbox or a
confidence, the field stays ``None`` rather than being filled with a guess.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TableCell(BaseModel):
    """One cell of a reconstructed table.

    ``candidates`` holds every value recognised in this cell, in original
    reading order. A cell with a struck-through printed value and a handwritten
    correction legitimately has two candidates; they are never merged and never
    chosen between here — choosing is a downstream (assessment) decision that
    must remain visible in the audit trail.
    """

    row: int
    col: int
    candidates: list[str] = Field(default_factory=list)
    bbox: Optional[list[float]] = None
    confidence: Optional[float] = None


class TableData(BaseModel):
    header: list[str] = Field(default_factory=list)
    rows: list[list[TableCell]] = Field(default_factory=list)


class ExtractionElement(BaseModel):
    type: str = "text"  # text | table | section_header | image | ...
    page: Optional[int] = None
    bbox: Optional[list[float]] = None  # [left, top, right, bottom], page units
    text: str = ""
    confidence: Optional[float] = None

    # --- schema v2: provenance (all optional, v1 artifacts load unchanged) ---
    element_id: Optional[str] = None  # stable content-addressed id (see extractor)
    order: Optional[int] = None  # document-order position
    subtype: Optional[str] = None  # finer type hint (e.g. "table_row")
    # Where the element came from. None means "unknown backend" (a v1 artifact).
    source: Optional[str] = None  # text_layer | ocr | table_reconstruction | docling | vision
    heading_path: list[str] = Field(default_factory=list)
    image_path: Optional[str] = None
    table: Optional[TableData] = None


class DocumentExtraction(BaseModel):
    document_id: str
    filename: str
    document_type: str
    backend: str = "pypdf"
    page_count: int = 0
    elements: list[ExtractionElement] = Field(default_factory=list)
    markdown: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    schema_version: int = 2
