"""AstraSovereign-owned intermediate representation for presentations.

The Agent only ever produces this structure (never PptxGenJS or Presenton
objects). The renderer consumes its serialized form.
"""

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
