"""Multimodal (OCR + vision) schemas for Phase 8.

These models carry structured OCR and vision results with source metadata so the
agent can distinguish OCR evidence from vision observations and from text
knowledge-base evidence. Image contents and extracted text are never logged.
"""

from typing import Optional

from pydantic import BaseModel, Field


class OCRRegion(BaseModel):
    """One recognized text region with optional geometry/confidence."""

    text: str
    bbox: list[int] = Field(default_factory=list)  # [x1, y1, x2, y2]
    confidence: Optional[float] = None


class OCRPageResult(BaseModel):
    """Structured OCR output for a single page."""

    page: int
    text: str = ""
    regions: list[OCRRegion] = Field(default_factory=list)


class VisionPageResult(BaseModel):
    """Structured vision output for a single page."""

    page: int
    text: str = ""
    observations: list[str] = Field(default_factory=list)
    model: str = ""


class PageEvidence(BaseModel):
    """Combined OCR + vision evidence for one page of a document."""

    page: int
    ocr_text: str = ""
    ocr_regions: list[OCRRegion] = Field(default_factory=list)
    vision_text: str = ""
    observations: list[str] = Field(default_factory=list)
    vision_model: str = ""


class VisionAnalysisResult(BaseModel):
    """Aggregated evidence from analyzing one or more pages of a document."""

    document_id: str
    filename: str
    document_type: str
    pages: list[PageEvidence] = Field(default_factory=list)
