"""Tests for local PowerPoint generation (presentation_generation tool).

Covers content validation, the intermediate model, PPTX package validation,
renderer behaviour (fake + real node renderer when available), artifact
creation/ownership/download, workspace containment, resource release, and an
end-to-end Agent -> tool run. The existing Word pipeline is untouched.
"""

import json

import pytest
from pydantic import ValidationError

from app.schemas.presentation import PresentationContent, SlideContent
from app.services.presentation_renderer import (
    FakePresentationRenderer,
    NodePresentationRenderer,
    PresentationRenderError,
    validate_pptx,
)

from tests.conftest import FakeSandboxRunner, make_scripted_handler, ok_result, wait_for_job

HDR = {"X-User-ID": "user-001"}
HDR2 = {"X-User-ID": "user-002"}


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


# ------------------------------------------------------------ node renderer

NODE_PRESENT = pytest.mark.skipif(
    not __import__("shutil").which("node"),
    reason="node not available",
)


@NODE_PRESENT
def test_node_renderer_real_pptx(tmp_path):
    import shutil
    from pathlib import Path

    script = Path(__file__).resolve().parents[2] / "presentation" / "src" / "render.cjs"
    if not script.is_file() or not (script.parent.parent / "node_modules" / "pptxgenjs").is_dir():
        pytest.skip("pptxgenjs not installed in presentation/")
    renderer = NodePresentationRenderer(script_path=str(script))
    content = PresentationContent.model_validate({"title": "X", "slides": SLIDES})
    generated = renderer.generate(content, tmp_path, "real.pptx")
    assert generated.slide_count == 4
    assert generated.path.stat().st_size > 0
    with __import__("zipfile").ZipFile(generated.path) as zf:
        names = zf.namelist()
        assert "[Content_Types].xml" in names and "ppt/presentation.xml" in names
        slide_parts = [n for n in names if n.startswith("ppt/slides/slide") and n.endswith(".xml")]
        assert len(slide_parts) == 4


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
