"""Structured document content model for the document generator (Phase 9).

The Agent produces this structured intermediate representation; the concrete
generator (Word, later Excel/PPT) converts it into a file. This separates
content generation from document formatting.
"""

from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class DocumentImage(BaseModel):
    """An image referenced by a section.

    ``path`` is relative to the job workspace; the document_generation tool
    resolves it and rejects any escape before the generator ever sees it.
    """

    path: str
    caption: str = ""
    width_inches: Optional[float] = None


class ApprovalSignature(BaseModel):
    """One signature row on a formal approval note."""

    name: str = ""
    designation: str = ""
    date: str = ""


class ApprovalNote(BaseModel):
    """Formal approval-note fields (the MRPL-style deliverable)."""

    reference_number: str = ""
    date: str = ""
    originator: str = ""
    department: str = ""
    subject: str = ""
    background: str = ""
    recommendation: str = ""
    signatures: list[ApprovalSignature] = Field(default_factory=list)


class DocumentSection(BaseModel):
    """One section of a document. All content fields are optional but at least
    one must be populated (enforced by the tool, not the schema)."""

    heading: str = ""
    paragraphs: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)
    numbered: list[str] = Field(default_factory=list)
    table: list[list[str]] = Field(default_factory=list)
    images: list[DocumentImage] = Field(default_factory=list)


class DocumentContent(BaseModel):
    """The full structured content of a document to generate."""

    document_type: str = "document"
    title: str = ""
    subtitle: str = ""
    sections: list[DocumentSection] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    approval: Optional[ApprovalNote] = None

    def char_count(self) -> int:
        """Approximate total text length (used to bound content size)."""
        count = len(self.title) + len(self.subtitle)
        for section in self.sections:
            count += len(section.heading)
            count += sum(len(item) for item in section.paragraphs)
            count += sum(len(item) for item in section.bullets)
            count += sum(len(item) for item in section.numbered)
            count += sum(len(cell) for row in section.table for cell in row)
            count += sum(len(image.caption) for image in section.images)
        count += sum(len(source) for source in self.sources)
        if self.approval is not None:
            approval = self.approval
            count += sum(
                len(value)
                for value in (
                    approval.reference_number,
                    approval.date,
                    approval.originator,
                    approval.department,
                    approval.subject,
                    approval.background,
                    approval.recommendation,
                )
            )
            count += sum(
                len(signature.name) + len(signature.designation) + len(signature.date)
                for signature in approval.signatures
            )
        return count


class GeneratedDocument(BaseModel):
    """Result of a successful generation."""

    filename: str
    path: Path
    size_bytes: int
    type: str
