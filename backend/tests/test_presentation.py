"""Tests for local PowerPoint generation (presentation_generation tool).

Covers content validation, the intermediate model, PPTX package validation,
the fake renderer, artifact creation/ownership/download, workspace containment,
resource release, and an end-to-end Agent -> tool run. The real vendored Node
renderer is exercised in ``test_presentation_renderer_node.py``. The existing
Word pipeline is untouched.
"""

import asyncio
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.presentation import PresentationContent, SlideContent
from app.services.presentation_renderer import (
    FakePresentationRenderer,
    PresentationRenderError,
    validate_pptx,
)
from app.services.tools import PresentationGenerationTool, ToolError

from tests.conftest import (
    FakeSandboxRunner,
    default_capacity,
    make_bmp,
    make_png,
    make_scripted_handler,
    ok_result,
    wait_for_job,
)

HDR = {"X-User-ID": "user-001"}
HDR2 = {"X-User-ID": "user-002"}


def run(coro):
    return asyncio.run(coro)


class CapturingRenderer(FakePresentationRenderer):
    """Fake renderer that also records the content it was handed."""

    def __init__(self):
        super().__init__()
        self.contents = []

    def generate(self, content, output_dir, filename):
        self.contents.append(content)
        return super().generate(content, output_dir, filename)


def make_presentation_tool(tmp_path, renderer=None, knowledge_base=None, uploads_root=None):
    from app.services.artifact_store import InMemoryArtifactStore
    from app.services.resource_provider import InMemoryResourceProvider
    from app.services.resource_scheduler import InMemoryResourceScheduler

    return PresentationGenerationTool(
        renderer=renderer or FakePresentationRenderer(),
        artifact_store=InMemoryArtifactStore(),
        scheduler=InMemoryResourceScheduler(InMemoryResourceProvider(default_capacity())),
        knowledge_base=knowledge_base,
        uploads_root=uploads_root,
    )


class StubKnowledgeBase:
    def __init__(self, record=None):
        self._record = record

    async def get_document(self, user_id, document_id):
        record = self._record
        if record is None or record.document_id != document_id:
            return None
        return record if record.user_id == user_id else None


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


SLIDES = [
    {"type": "title", "title": "Inspection Review", "content": "Tank 204 findings"},
    {"type": "bullets", "title": "Key Findings", "bullets": ["Course 2 below limit", "Pitting near weld seam"]},
    {"type": "table", "title": "Comparison", "table": [["Item", "Value"], ["Course 2", "10.9 mm"]]},
    {"type": "sources", "title": "Sources", "sources": ["SOP-09, p.12"]},
]


def presentation_args(filename="inspection_review.pptx", slides=None):
    return {
        "type": "pptx",
        "filename": filename,
        "title": "Inspection Review",
        "theme": "executive",
        "slides": slides if slides is not None else SLIDES,
    }


# ------------------------------------------------------------- content model


def test_presentation_content_valid():
    content = PresentationContent.model_validate({"title": "X", "slides": SLIDES})
    assert len(content.slides) == 4
    assert content.theme == "general"


def test_presentation_content_carries_speaker_notes():
    content = PresentationContent.model_validate(
        {"title": "X", "slides": [{"type": "content", "title": "t", "notes": "hello"}]}
    )
    assert content.slides[0].notes == "hello"
    with pytest.raises(ValidationError):
        SlideContent(type="content", notes="x" * 4001)


def test_presentation_content_rejects_bad_theme_and_types():
    with pytest.raises(ValidationError):
        PresentationContent.model_validate({"title": "X", "theme": "neon", "slides": SLIDES})
    with pytest.raises(ValidationError):
        PresentationContent.model_validate(
            {"title": "X", "slides": [{"type": "movie", "title": "bad"}]}
        )
    with pytest.raises(ValidationError):
        PresentationContent.model_validate({"title": "X", "slides": []})
    SlideContent(type="two-column", columns=["a"])  # ok (lenient model check)


def test_presentation_content_rejects_bad_column_ratios():
    """A zero ratio renders a zero-width column and a negative one makes
    PptxGenJS throw an opaque error; both are rejected at the model."""
    with pytest.raises(ValidationError):
        SlideContent(type="two-column", columns=["a", "b"], column_ratios=[-1, 2])
    with pytest.raises(ValidationError):
        SlideContent(type="two-column", columns=["a", "b"], column_ratios=[0, 1])
    with pytest.raises(ValidationError):
        SlideContent(type="two-column", columns=["a", "b"], column_ratios=[1])
    SlideContent(type="two-column", columns=["a", "b"], column_ratios=[2, 1])  # ok


def _chart_slide(**chart):
    return SlideContent(type="chart", title="Growth", chart=chart)


def test_chart_slide_carries_categories_and_series():
    slide = _chart_slide(
        type="line",
        title="Complexity",
        categories=["n=10", "n=100"],
        series=[{"name": "O(n log n)", "values": [33, 664]}],
    )
    assert slide.chart.type == "line"
    assert slide.chart.categories == ["n=10", "n=100"]
    assert slide.chart.series[0].values == [33.0, 664.0]
    # Numerical strings are accepted — a model may write values as text.
    assert _chart_slide(
        type="bar", categories=["a"], series=[{"name": "s", "values": ["12"]}]
    ).chart.series[0].values == [12.0]


def test_chart_type_synonyms_normalise():
    """A model reaches for "column" and "donut"; both draw the same chart, so
    they are normalised rather than costing a validation round-trip."""
    assert _chart_slide(type="COLUMN", categories=["a"], series=[{"name": "s", "values": [1]}]).chart.type == "bar"
    assert _chart_slide(type="donut", categories=["a"], series=[{"name": "s", "values": [1]}]).chart.type == "doughnut"


def test_chart_rejects_data_that_would_draw_a_wrong_chart():
    """A short series silently drops trailing bars and a pie with two series
    stacks one ring — both look finished while showing the wrong thing."""
    with pytest.raises(ValidationError):
        _chart_slide(type="bar", categories=["a", "b"], series=[{"name": "s", "values": [1]}])
    with pytest.raises(ValidationError):
        _chart_slide(
            type="pie",
            categories=["a", "b"],
            series=[{"name": "s", "values": [1, 2]}, {"name": "t", "values": [3, 4]}],
        )
    with pytest.raises(ValidationError):
        _chart_slide(type="bar", categories=[], series=[{"name": "s", "values": []}])
    with pytest.raises(ValidationError):
        _chart_slide(type="bar", categories=["a"], series=[])
    with pytest.raises(ValidationError):
        _chart_slide(type="pie", categories=["a"], series=[{"name": "s", "values": ["not a number"]}])


def test_an_unknown_chart_type_is_rejected():
    with pytest.raises(ValidationError):
        _chart_slide(type="hologram", categories=["a"], series=[{"name": "s", "values": [1]}])
    # scatter needs an (x, y) pair per point, not this model's shape.
    with pytest.raises(ValidationError):
        _chart_slide(type="scatter", categories=["a"], series=[{"name": "s", "values": [1]}])


def test_a_chart_slide_without_chart_data_is_rejected():
    """A 'chart' slide with no chart would render headlined but empty."""
    with pytest.raises(ValidationError):
        SlideContent(type="chart", title="empty")
    SlideContent(type="content", title="fine")  # a chart is optional elsewhere


def _diagram(**overrides):
    payload = {"nodes": [{"label": "a"}, {"label": "b"}]}
    payload.update(overrides)
    return SlideContent(type="diagram", title="Flow", diagram=payload)


def test_diagram_slide_carries_labelled_nodes():
    slide = SlideContent(
        type="diagram",
        title="Pipeline",
        diagram={
            "layout": "column",
            "nodes": [
                {"label": "Pretrained model", "detail": "start here"},
                {"label": "Reward model"},
                {"label": "Policy optimisation"},
            ],
        },
    )
    assert slide.diagram.layout == "column"
    assert [n.label for n in slide.diagram.nodes] == [
        "Pretrained model",
        "Reward model",
        "Policy optimisation",
    ]


def test_diagram_rejects_a_flow_that_is_not_a_flow():
    """Fewer than two steps, a blank label, or an unknown layout would draw an
    empty or meaningless figure, so each is rejected where the model can fix it."""
    with pytest.raises(ValidationError):  # one node is not a flow
        _diagram(nodes=[{"label": "only"}])
    with pytest.raises(ValidationError):  # an unlabelled box says nothing
        _diagram(nodes=[{"label": ""}, {"label": "b"}])
    with pytest.raises(ValidationError):  # unknown layout
        _diagram(layout="spiral", nodes=[{"label": "a"}, {"label": "b"}])
    with pytest.raises(ValidationError):  # missing diagram on a diagram slide
        SlideContent(type="diagram", title="empty")
    _diagram(nodes=[{"label": "a"}, {"label": "b"}])  # ok


def test_slide_image_requires_exactly_one_source():
    with pytest.raises(ValidationError):
        SlideContent(type="content", image={"caption": "no source"})
    with pytest.raises(ValidationError):
        SlideContent(type="content", image={"path": "a.png", "doc_id": "d1"})
    with pytest.raises(ValidationError):
        SlideContent(type="content", image={"path": "a.png", "width_inches": 42})
    SlideContent(type="content", image={"doc_id": "d1", "caption": "ok"})  # ok


def test_slide_image_accepts_data_source():
    """``data`` is the backend's substitute for a format the renderer cannot
    decode; it is a third source form and must stand alone."""
    slide = SlideContent(
        type="content", image={"data": "image/png;base64,AA", "caption": "ok"}
    )
    assert slide.image.data == "image/png;base64,AA"


def test_slide_image_rejects_two_sources():
    with pytest.raises(ValidationError, match="exactly one"):
        SlideContent(type="content", image={"data": "image/png;base64,AA", "path": "a.png"})
    with pytest.raises(ValidationError, match="exactly one"):
        SlideContent(
            type="content", image={"data": "image/png;base64,AA", "doc_id": "d1"}
        )


# ----------------------------------------------------------- fake renderer


def test_fake_renderer_writes_valid_pptx(tmp_path):
    renderer = FakePresentationRenderer()
    content = PresentationContent.model_validate({"title": "X", "slides": SLIDES})
    generated = renderer.generate(content, tmp_path, "deck.pptx")
    assert generated.slide_count == 4
    assert generated.path.exists()
    assert generated.size_bytes > 0
    slides = validate_pptx(generated.path, 4)
    assert slides == 4


def test_validate_pptx_rejects_invalid(tmp_path):
    bogus = tmp_path / "not.pptx"
    bogus.write_text("not a zip", encoding="utf-8")
    with pytest.raises(PresentationRenderError):
        validate_pptx(bogus, 2)


# --------------------------------------------------------- validation rules


def test_validate_pptx_accepts_at_least_expected_slides(tmp_path):
    renderer = FakePresentationRenderer()
    content = PresentationContent.model_validate({"title": "X", "slides": SLIDES})
    generated = renderer.generate(content, tmp_path, "deck.pptx")
    # extra layout/divider/template slides are allowed; dropped content is not
    assert validate_pptx(generated.path, 3) == 4
    with pytest.raises(PresentationRenderError):
        validate_pptx(generated.path, 5)


# -------------------------------------------------------------- agent -> tool


def test_agent_calls_presentation_generation_and_artifact(client_factory, tmp_path):
    script = [
        tool_call("presentation_generation", presentation_args(), "Build the deck"),
        final("Presentation generated.", "done"),
    ]
    renderer = FakePresentationRenderer()
    with client_factory(
        make_scripted_handler(script),
        presentation_renderer=renderer,
        project_root=tmp_path / "projects",
    ) as c:
        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Create a PowerPoint inspection review deck covering findings, "
                    "the comparison with the procedure, required actions and sources."
                )
            },
            headers=HDR,
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=15)

    assert job["status"] == "completed", job.get("error")
    assert len(renderer.calls) == 1
    tools = [t["tool"] for t in job["execution_trace"] if t["type"] == "tool_call"]
    assert "presentation_generation" in tools
    assert job["artifacts"] and job["artifacts"][0]["status"] == "completed"
    artifact = job["artifacts"][0]
    assert artifact["type"] == "pptx"
    assert artifact["filename"] == "inspection_review.pptx"
    assert artifact["job_id"] == job["job_id"]
    assert artifact["size_bytes"] > 0


def test_presentation_artifact_download_and_ownership(client_factory, tmp_path):
    script = [
        tool_call("presentation_generation", presentation_args(), "Build the deck"),
        final("Presentation generated.", "done"),
    ]
    with client_factory(
        make_scripted_handler(script),
        presentation_renderer=FakePresentationRenderer(),
        project_root=tmp_path / "projects",
    ) as c:
        resp = c.post(
            "/api/chat",
            json={"message": "Please build a PowerPoint deck for me now."},
            headers=HDR,
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=15)
        artifact = job["artifacts"][0]

        # owner can download; other users cannot (ownership enforced by jobs API)
        ok = c.get(
            f"/api/jobs/{job['job_id']}/artifacts/{artifact['artifact_id']}",
            headers=HDR,
        )
        assert ok.status_code == 200
        assert ok.content[:2] == b"PK"
        denied = c.get(
            f"/api/jobs/{job['job_id']}/artifacts/{artifact['artifact_id']}",
            headers=HDR2,
        )
        assert denied.status_code in (403, 404)


def test_presentation_rejects_traversal_filename(client_factory, tmp_path):
    script = [
        tool_call(
            "presentation_generation",
            presentation_args(filename="../../escape.pptx"),
            "Bad name",
        ),
        final("should have failed", "done"),
    ]
    with client_factory(
        make_scripted_handler(script),
        presentation_renderer=FakePresentationRenderer(),
        project_root=tmp_path / "projects",
    ) as c:
        resp = c.post("/api/chat", json={"message": "make slides please"}, headers=HDR)
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=15)
    # the tool call failed (invalid filename) and no artifact was registered
    results = [t for t in job["execution_trace"] if t["type"] == "tool_result"]
    assert results and results[-1]["ok"] is False
    assert not job["artifacts"]


def test_malformed_slides_fails_without_artifact(client_factory, tmp_path):
    bad = presentation_args(slides=[{"type": "movie", "title": "bad"}])
    script = [
        tool_call("presentation_generation", bad, "Bad content"),
        final("should have failed", "done"),
    ]
    with client_factory(
        make_scripted_handler(script),
        presentation_renderer=FakePresentationRenderer(),
        project_root=tmp_path / "projects",
    ) as c:
        resp = c.post("/api/chat", json={"message": "make a deck"}, headers=HDR)
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=15)
    results = [t for t in job["execution_trace"] if t["type"] == "tool_result"]
    assert results and results[-1]["ok"] is False
    assert not job["artifacts"]


# --------------------------------------------------- slide images (no Node)


def _pptx_args(**overrides):
    args = {
        "type": "pptx",
        "filename": "deck.pptx",
        "title": "Deck",
        "slides": [{"type": "content", "title": "One", "content": "body"}],
    }
    args.update(overrides)
    return args


def test_presentation_tool_accepts_and_renders_a_chart_slide(tmp_path):
    """A chart slide reaches the renderer as a chart slide — the tool must not
    drop a slide type the deck is meant to carry."""
    from app.services.log_context import set_job_context

    renderer = CapturingRenderer()
    tool = make_presentation_tool(tmp_path, renderer=renderer)
    set_job_context(user_id="user-001", job_id="job-chart")
    args = _pptx_args(
        slides=[
            {
                "type": "chart",
                "title": "Growth",
                "chart": {
                    "type": "line",
                    "categories": ["n=10", "n=100"],
                    "series": [{"name": "O(n log n)", "values": [33, 664]}],
                    "show_values": True,
                },
            }
        ]
    )
    result = run(tool.execute(tmp_path, args))
    assert result.ok

    slide = renderer.contents[0].slides[0]
    assert slide.type == "chart"
    assert slide.chart is not None
    assert slide.chart.series[0].values == [33.0, 664.0]
    assert slide.chart.show_values is True


def test_presentation_tool_renders_a_diagram_slide(tmp_path):
    """A diagram slide reaches the renderer as a diagram slide."""
    from app.services.log_context import set_job_context

    renderer = CapturingRenderer()
    tool = make_presentation_tool(tmp_path, renderer=renderer)
    set_job_context(user_id="user-001", job_id="job-diagram")
    args = _pptx_args(
        slides=[
            {
                "type": "diagram",
                "title": "Pipeline",
                "diagram": {
                    "layout": "column",
                    "nodes": [
                        {"label": "Base model"},
                        {"label": "Reward model", "detail": "learned from rankings"},
                        {"label": "PPO"},
                    ],
                },
            }
        ]
    )
    result = run(tool.execute(tmp_path, args))
    assert result.ok

    slide = renderer.contents[0].slides[0]
    assert slide.type == "diagram"
    assert [n.label for n in slide.diagram.nodes] == ["Base model", "Reward model", "PPO"]


def test_presentation_rejects_a_malformed_chart_slide(tmp_path):
    """A series with the wrong number of values must fail before rendering."""
    from app.services.log_context import set_job_context

    tool = make_presentation_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-chart-bad")
    args = _pptx_args(
        slides=[
            {
                "type": "chart",
                "title": "Bad",
                "chart": {
                    "type": "bar",
                    "categories": ["a", "b"],
                    "series": [{"name": "s", "values": [1]}],
                },
            }
        ]
    )
    with pytest.raises(ToolError):
        run(tool.execute(tmp_path, args))


def test_presentation_tool_embeds_workspace_image(tmp_path):
    from app.services.log_context import set_job_context

    make_png(tmp_path / "crop.png", ["P&ID detail"])
    renderer = CapturingRenderer()
    tool = make_presentation_tool(tmp_path, renderer=renderer)
    set_job_context(user_id="user-001", job_id="job-p1")
    args = _pptx_args(
        slides=[
            {
                "type": "content",
                "title": "One",
                "content": "body",
                "image": {"path": "crop.png", "caption": "P&ID detail"},
            }
        ]
    )
    result = run(tool.execute(tmp_path, args))
    assert result.ok

    image = renderer.contents[0].slides[0].image
    assert image is not None and image.caption == "P&ID detail"
    assert image.data and image.data.startswith("image/png;base64,")


def test_presentation_tool_resolves_doc_id_image(tmp_path):
    from app.schemas.document import DocumentRecord
    from app.services.log_context import set_job_context

    root = tmp_path / "uploads"
    user_dir = root / "user-001"
    user_dir.mkdir(parents=True)
    make_png(user_dir / "crop.png", ["P&ID detail"])
    record = DocumentRecord(
        document_id="doc-img-1",
        user_id="user-001",
        filename="crop.png",
        document_type="png",
        status="ready",
    )
    renderer = CapturingRenderer()
    tool = make_presentation_tool(
        tmp_path, renderer=renderer, knowledge_base=StubKnowledgeBase(record), uploads_root=root
    )
    set_job_context(user_id="user-001", job_id="job-p2")
    args = _pptx_args(
        slides=[
            {
                "type": "content",
                "title": "One",
                "content": "body",
                "image": {"doc_id": "doc-img-1"},
            }
        ]
    )
    assert run(tool.execute(tmp_path, args)).ok
    image = renderer.contents[0].slides[0].image
    assert image is not None
    assert image.data and image.data.startswith("image/png;base64,")


def test_presentation_tool_converts_non_web_safe_image_to_data(tmp_path):
    """A bmp cannot be decoded by the renderer, so the tool substitutes base64
    PNG data instead of a path — and never leaks the resolved host path."""
    from app.services.log_context import set_job_context

    make_bmp(tmp_path / "crop.bmp")
    renderer = CapturingRenderer()
    tool = make_presentation_tool(tmp_path, renderer=renderer)
    set_job_context(user_id="user-001", job_id="job-p5")
    args = _pptx_args(
        slides=[
            {
                "type": "content",
                "title": "One",
                "content": "body",
                "image": {"path": "crop.bmp", "caption": "P&ID detail"},
            }
        ]
    )
    assert run(tool.execute(tmp_path, args)).ok

    image = renderer.contents[0].slides[0].image
    assert image.data.startswith("image/png;base64,")
    assert image.path == ""


def test_presentation_tool_renders_a_pdf_page_as_data(tmp_path):
    """A PDF page used as a slide figure is rendered in memory and handed to
    the renderer as base64 PNG — the job workspace may hold only artifacts/."""
    from app.schemas.document import DocumentRecord
    from app.services.log_context import set_job_context
    from tests.conftest import make_text_pdf

    root = tmp_path / "uploads"
    user_dir = root / "user-001"
    user_dir.mkdir(parents=True)
    make_text_pdf(user_dir / "report.pdf", ["Pump maintenance", "Seal inspection"])
    record = DocumentRecord(
        document_id="doc-pdf-1",
        user_id="user-001",
        filename="report.pdf",
        document_type="pdf",
        status="ready",
    )
    renderer = CapturingRenderer()
    tool = make_presentation_tool(
        tmp_path,
        renderer=renderer,
        knowledge_base=StubKnowledgeBase(record),
        uploads_root=root,
    )
    set_job_context(user_id="user-001", job_id="job-p6")
    args = _pptx_args(
        slides=[
            {
                "type": "content",
                "title": "One",
                "content": "body",
                "image": {"doc_id": "doc-pdf-1", "page": 1, "caption": "Report page 1"},
            }
        ]
    )
    assert run(tool.execute(tmp_path, args)).ok

    image = renderer.contents[0].slides[0].image
    assert image.data.startswith("image/png;base64,")
    assert image.path == ""
    assert image.caption == "Report page 1"


def test_presentation_tool_rejects_a_pdf_page_out_of_range(tmp_path):
    from app.schemas.document import DocumentRecord
    from app.services.log_context import set_job_context
    from tests.conftest import make_text_pdf

    root = tmp_path / "uploads"
    user_dir = root / "user-001"
    user_dir.mkdir(parents=True)
    make_text_pdf(user_dir / "report.pdf", ["one page only"])
    record = DocumentRecord(
        document_id="doc-pdf-1",
        user_id="user-001",
        filename="report.pdf",
        document_type="pdf",
        status="ready",
    )
    tool = make_presentation_tool(
        tmp_path,
        renderer=CapturingRenderer(),
        knowledge_base=StubKnowledgeBase(record),
        uploads_root=root,
    )
    set_job_context(user_id="user-001", job_id="job-p7")
    args = _pptx_args(
        slides=[{"type": "content", "title": "One", "image": {"doc_id": "doc-pdf-1", "page": 4}}]
    )
    with pytest.raises(ToolError, match="does not exist"):
        run(tool.execute(tmp_path, args))


def test_presentation_tool_rejects_ambiguous_slide_image(tmp_path):
    from app.services.log_context import set_job_context

    tool = make_presentation_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-p3")
    args = _pptx_args(
        slides=[{"type": "content", "title": "One", "image": {"path": "a.png", "doc_id": "d1"}}]
    )
    with pytest.raises(ToolError, match="exactly one of"):
        run(tool.execute(tmp_path, args))


def test_presentation_tool_keeps_author_and_subject(tmp_path):
    """These were silently dropped before the validate dict was built."""
    from app.services.log_context import set_job_context

    renderer = CapturingRenderer()
    tool = make_presentation_tool(tmp_path, renderer=renderer)
    set_job_context(user_id="user-001", job_id="job-p4")
    args = _pptx_args(author="MRPL", subject="Inspection review")
    assert run(tool.execute(tmp_path, args)).ok
    assert renderer.contents[0].author == "MRPL"
    assert renderer.contents[0].subject == "Inspection review"


def test_presentation_tool_sanitizes_dict_columns(tmp_path):
    """LLMs sometimes pass dict objects instead of plain strings inside slide columns."""
    from app.services.log_context import set_job_context

    renderer = CapturingRenderer()
    tool = make_presentation_tool(tmp_path, renderer=renderer)
    set_job_context(user_id="user-001", job_id="job-p5")
    args = _pptx_args(
        slides=[
            {
                "type": "two-column",
                "title": "Dict Columns",
                "columns": [
                    {"heading": "Column A", "body": "Body content A", "bullets": ["Bullet 1", "Bullet 2"]},
                    "Plain string column B",
                ],
            }
        ]
    )
    assert run(tool.execute(tmp_path, args)).ok
    cols = renderer.contents[0].slides[0].columns
    assert len(cols) == 2
    assert "Column A" in cols[0]
    assert "Body content A" in cols[0]
    assert "• Bullet 1" in cols[0]
    assert cols[1] == "Plain string column B"

