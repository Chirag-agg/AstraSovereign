"""AstraSovereign-owned intermediate representation for presentations.

The Agent only ever produces this structure (never PptxGenJS or Presenton
objects). The renderer consumes its serialized form.
"""

import math
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

SlideType = Literal[
    "title", "content", "bullets", "two-column", "table", "sources"
]

SLIDE_TYPES: tuple[str, ...] = (
    "title",
    "content",
    "bullets",
    "two-column",
    "table",
    "sources",
)

_THEMES = ("executive", "technical", "report", "general")


class SlideImage(BaseModel):
    """An image on a slide.

    Exactly one of the three source forms is set (checked here after the tool
    resolves a model reference). The model may only name ``path`` or ``doc_id``
    (enforced by the tool before this point); ``data`` is the base64 PNG the
    backend substitutes when the resolved source format is not web-safe, since
    the renderer cannot decode a bmp/gif/tiff/webp. ``width_inches`` bounds how
    much of the slide the image may fill.
    """

    path: str = ""
    doc_id: str = ""
    data: str = ""
    caption: str = ""
    width_inches: Optional[float] = None


class SlideContent(BaseModel):
    """One slide of structured content."""

    id: str = ""
    type: SlideType = "content"
    title: str = ""
    content: str = ""
    bullets: list[str] = Field(default_factory=list, max_length=80)
    columns: list[str] = Field(default_factory=list, max_length=2)
    column_ratios: Optional[list[float]] = None
    table: list[list[str]] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list, max_length=80)
    notes: str = ""
    image: Optional[SlideImage] = None

    @field_validator("title")
    @classmethod
    def _title_len(cls, value: str) -> str:
        if len(value) > 200:
            raise ValueError("slide title is too long")
        return value

    @field_validator("content")
    @classmethod
    def _content_len(cls, value: str) -> str:
        if len(value) > 8000:
            raise ValueError("slide content is too long")
        return value

    @field_validator("notes")
    @classmethod
    def _notes_len(cls, value: str) -> str:
        if len(value) > 4000:
            raise ValueError("slide notes are too long")
        return value

    @field_validator("column_ratios")
    @classmethod
    def _ratios_valid(cls, value: Optional[list[float]]) -> Optional[list[float]]:
        """Two positive widths, so a column can never be zero or negative.

        A zero ratio renders a column of zero width (silently invisible) and a
        negative one makes the renderer fail with an opaque error; both are
        rejected here where the message can reach the model.
        """
        if value is None:
            return None
        if len(value) != 2:
            raise ValueError("column_ratios must have exactly two entries")
        for ratio in value:
            if not math.isfinite(ratio):
                raise ValueError("column_ratios entries must be finite")
            if ratio <= 0:
                raise ValueError("column_ratios entries must be greater than zero")
        return value

    @field_validator("image")
    @classmethod
    def _image_valid(cls, value: Optional[SlideImage]) -> Optional[SlideImage]:
        if value is None:
            return None
        sources = sum(
            1 for field in ("path", "doc_id", "data") if (getattr(value, field) or "").strip()
        )
        if sources != 1:
            raise ValueError(
                "slide image must set exactly one of 'path', 'doc_id' or 'data'"
            )
        if value.width_inches is not None and not 0 < value.width_inches <= 10:
            raise ValueError("slide image 'width_inches' must be between 0 and 10")
        return value


class PresentationContent(BaseModel):
    """A full deck: title, optional subtitle/theme, and ordered slides."""

    title: str = Field(..., max_length=300)
    subtitle: str = ""
    theme: str = "general"
    author: str = ""
    subject: str = ""
    slides: list[SlideContent] = Field(..., min_length=1, max_length=80)

    @field_validator("theme")
    @classmethod
    def _theme_valid(cls, value: str) -> str:
        theme = (value or "general").strip().lower()
        if theme not in _THEMES:
            raise ValueError(
                f"unsupported theme '{value}'; supported: {', '.join(_THEMES)}"
            )
        return theme

    @field_validator("subtitle")
    @classmethod
    def _subtitle_len(cls, value: str) -> str:
        if len(value) > 300:
            raise ValueError("subtitle is too long")
        return value
