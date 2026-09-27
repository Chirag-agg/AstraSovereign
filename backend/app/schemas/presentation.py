"""AstraSovereign-owned intermediate representation for presentations.

The Agent only ever produces this structure (never PptxGenJS or Presenton
objects). The renderer consumes its serialized form.
"""

import math
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

SlideType = Literal[
    "title",
    "content",
    "bullets",
    "two-column",
    "table",
    "sources",
    "chart",
    "diagram",
]

SLIDE_TYPES: tuple[str, ...] = (
    "title",
    "content",
    "bullets",
    "two-column",
    "table",
    "sources",
    "chart",
    "diagram",
)

_THEMES = ("executive", "technical", "report", "general")

# The chart families the renderer can draw from the (categories, series) shape.
# Deliberately excludes scatter and bubble: those need an (x, y) pair per point,
# a different data shape than every other family here, so accepting them under
# this model would let the model emit data the renderer misreads.
CHART_TYPES: tuple[str, ...] = (
    "bar",
    "line",
    "area",
    "pie",
    "doughnut",
    "radar",
)  # fmt: skip

_PIE_TYPES = ("pie", "doughnut")

# Names a model reasonably reaches for that mean a family we draw. Normalised
# before validation rather than rejected, because both render identically and a
# rejection would cost the model a whole turn to correct a synonym.
_CHART_ALIASES = {"donut": "doughnut", "column": "bar", "columnbar": "bar"}


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


class SlideChartSeries(BaseModel):
    """One named series of a chart: one value per category."""

    name: str = ""
    values: list[float] = Field(default_factory=list, max_length=60)

    @field_validator("name")
    @classmethod
    def _name_len(cls, value: str) -> str:
        if len(value) > 120:
            raise ValueError("chart series name is too long")
        return value

    @field_validator("values")
    @classmethod
    def _values_finite(cls, value: list[float]) -> list[float]:
        for number in value:
            if not math.isfinite(number):
                raise ValueError("chart values must be finite numbers")
        return value


class SlideChart(BaseModel):
    """A data chart for a slide: a type, category labels, and one or more series.

    The shape is uniform across the families the renderer supports, so a chart
    is always "categories × series" even when it is drawn as a pie. ``show_*``
    options default to what reads well (legend on when there is more than one
    series or the chart is a pie, value labels off).
    """

    type: str = "bar"
    title: str = ""
    categories: list[str] = Field(default_factory=list, max_length=30)
    series: list[SlideChartSeries] = Field(default_factory=list, max_length=8)
    show_legend: Optional[bool] = None
    show_values: bool = False
    stacked: bool = False

    @field_validator("type")
    @classmethod
    def _type_valid(cls, value: str) -> str:
        chart_type = (value or "bar").strip().lower()
        chart_type = _CHART_ALIASES.get(chart_type, chart_type)
        if chart_type not in CHART_TYPES:
            raise ValueError(
                f"unsupported chart type '{value}'; supported: {', '.join(CHART_TYPES)}"
            )
        return chart_type

    @field_validator("title")
    @classmethod
    def _title_len(cls, value: str) -> str:
        if len(value) > 200:
            raise ValueError("chart title is too long")
        return value

    @field_validator("categories")
    @classmethod
    def _categories_valid(cls, value: list[str]) -> list[str]:
        labels = [str(item) for item in value]
        for label in labels:
            if len(label) > 120:
                raise ValueError("chart category label is too long")
        return labels

    @model_validator(mode="after")
    def _shape_valid(self) -> "SlideChart":
        """Reject data that would render as a chart that lies.

        A series shorter than the categories silently drops the trailing bars,
        and a pie drawn from several series stacks them into one ring — both
        look like a finished chart while showing the wrong thing, so they are
        rejected here where the message can reach the model.
        """
        if not self.categories:
            raise ValueError("chart needs at least one category")
        if not self.series:
            raise ValueError("chart needs at least one series")
        for entry in self.series:
            if len(entry.values) != len(self.categories):
                raise ValueError(
                    "each chart series must have exactly one value per category"
                )
        if self.type in _PIE_TYPES and len(self.series) != 1:
            raise ValueError(f"a '{self.type}' chart must have exactly one series")
        return self


class SlideDiagramNode(BaseModel):
    """One box in a flow diagram: a short label and an optional detail line."""

    label: str = ""
    detail: str = ""

    @field_validator("label")
    @classmethod
    def _label_len(cls, value: str) -> str:
        if len(value) > 120:
            raise ValueError("diagram node label is too long")
        return value

    @field_validator("detail")
    @classmethod
    def _detail_len(cls, value: str) -> str:
        if len(value) > 300:
            raise ValueError("diagram node detail is too long")
        return value


class SlideDiagram(BaseModel):
    """An ordered set of steps drawn as boxes joined by arrows.

    This is the visual for a process — a training pipeline, a workflow, a
    method's stages — where a chart (which needs numbers) and a bullet list
    (which is just text again) both fail to show the shape of the thing.
    """

    layout: str = "row"
    nodes: list[SlideDiagramNode] = Field(default_factory=list, max_length=8)

    @field_validator("layout")
    @classmethod
    def _layout_valid(cls, value: str) -> str:
        layout = (value or "row").strip().lower()
        if layout not in ("row", "column"):
            raise ValueError("diagram layout must be 'row' or 'column'")
        return layout

    @model_validator(mode="after")
    def _nodes_valid(self) -> "SlideDiagram":
        """A flow needs at least two labelled steps to be a flow at all."""
        if len(self.nodes) < 2:
            raise ValueError("a diagram needs at least two nodes")
        for index, node in enumerate(self.nodes):
            if not node.label.strip():
                raise ValueError(f"diagram node {index + 1} needs a label")
        return self


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
    chart: Optional[SlideChart] = None
    diagram: Optional[SlideDiagram] = None

    @model_validator(mode="after")
    def _typed_slide_carries_its_body(self) -> "SlideContent":
        """A typed slide must carry the payload its type names.

        A 'chart' slide with no chart, or a 'diagram' slide with no diagram,
        renders as a bare title — the exact "empty slide" the deck was
        complained about — so it is rejected where the model can correct it.
        """
        if self.type == "chart" and self.chart is None:
            raise ValueError("a 'chart' slide must include a 'chart' object")
        if self.type == "diagram" and self.diagram is None:
            raise ValueError("a 'diagram' slide must include a 'diagram' object")
        return self

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
