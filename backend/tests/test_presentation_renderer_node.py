"""Integration test for the real, vendored PptxGenJS renderer.

Marked ``node``: skipped (with a visible reason) only when the Node.js runtime
is unavailable, mirroring the ``docker`` marker. The full PptxGenJS dependency
closure is committed under ``presentation/node_modules``, so this exercises the
actual ``render.cjs`` in CI — a dead deck generator can no longer stay green
behind a fake renderer.
"""

import re
import zipfile
from pathlib import Path

import pytest

from app.schemas.presentation import PresentationContent
from app.services.presentation_renderer import NodePresentationRenderer

from tests.conftest import node_ready

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "presentation" / "src" / "render.cjs"
VENDORED_PPTXGENJS = REPO_ROOT / "presentation" / "node_modules" / "pptxgenjs"

SLIDES = [
    {"type": "title", "title": "Inspection Review", "content": "Tank 204 findings"},
    {
        "type": "bullets",
        "title": "Key Findings",
        "bullets": ["Course 2 below limit", "Pitting near weld seam"],
    },
    {"type": "table", "title": "Comparison", "table": [["Item", "Value"], ["Course 2", "10.9 mm"]]},
    {"type": "sources", "title": "Sources", "sources": ["SOP-09, p.12"]},
]


def test_vendored_pptxgenjs_is_committed():
    """The offline deck generator must travel with the repo, not with npm."""
    assert VENDORED_PPTXGENJS.is_dir(), (
        "presentation/node_modules/pptxgenjs is missing; a fresh air-gapped "
        "clone cannot render decks. Re-vendor the offline Node dependencies."
    )
    assert SCRIPT.is_file()


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_real_renderer_opens_with_expected_slides_and_text(tmp_path):
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {"title": "Inspection Review", "slides": SLIDES}
    )
    generated = renderer.generate(content, tmp_path, "real.pptx")

    assert generated.slide_count == 4
    assert generated.size_bytes > 0
    with zipfile.ZipFile(generated.path) as package:
        names = package.namelist()
        assert "[Content_Types].xml" in names
        assert "ppt/presentation.xml" in names
        slide_text = "".join(
            package.read(name).decode("utf-8")
            for name in names
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        )
    # the deck opens with the expected content, not just the expected count
    assert "Inspection Review" in slide_text
    assert "Course 2 below limit" in slide_text
    # the render payload (document content) must not be left in the artifact dir
    assert not list(tmp_path.glob(".render-*.json"))
    assert list(tmp_path.glob("*.pptx"))


def _slide_width_emu(package: zipfile.ZipFile) -> int:
    presentation = package.read("ppt/presentation.xml").decode("utf-8")
    match = re.search(r'<p:sldSz[^>]*\bcx="(\d+)"', presentation)
    assert match, "presentation.xml has no slide size"
    return int(match.group(1))


def _text_shape_right_edges(slide_xml: str) -> list[int]:
    """Right edge (EMU) of every shape that actually carries text."""
    edges: list[int] = []
    for shape in re.findall(r"<p:sp>.*?</p:sp>", slide_xml, flags=re.S):
        if "<p:txBody>" not in shape:
            continue
        off = re.search(r'<a:off x="(-?\d+)"', shape)
        ext = re.search(r'<a:ext cx="(\d+)"', shape)
        if off and ext:
            edges.append(int(off.group(1)) + int(ext.group(1)))
    return edges


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_content_text_fills_the_wide_slide(tmp_path):
    """Guard the LAYOUT_WIDE (13.33in) geometry against a narrower template."""
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {
            "title": "Geometry",
            "slides": [
                {
                    "type": "content",
                    "title": "Wide Content",
                    "content": "A paragraph that should span the content area.",
                }
            ],
        }
    )
    generated = renderer.generate(content, tmp_path, "geometry.pptx")

    with zipfile.ZipFile(generated.path) as package:
        slide_width = _slide_width_emu(package)
        slide_parts = sorted(
            name
            for name in package.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        )
        slide_xml = package.read(slide_parts[0]).decode("utf-8")

    widest = max(_text_shape_right_edges(slide_xml), default=0)
    assert widest >= 0.85 * slide_width, (
        f"content text stops at {widest / slide_width:.0%} of the slide width; "
        "renderer geometry is hardcoded to a narrower template"
    )


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_speaker_notes_are_written(tmp_path):
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {
            "title": "Notes",
            "slides": [
                {
                    "type": "content",
                    "title": "With notes",
                    "content": "Body",
                    "notes": "Speaker note marker XYZ",
                }
            ],
        }
    )
    generated = renderer.generate(content, tmp_path, "notes.pptx")

    with zipfile.ZipFile(generated.path) as package:
        notes_parts = [
            name
            for name in package.namelist()
            if name.startswith("ppt/notesSlides/notesSlide") and name.endswith(".xml")
        ]
        assert notes_parts, "renderer produced no notes slide for a slide with notes"
        notes_text = "".join(package.read(name).decode("utf-8") for name in notes_parts)
    assert "Speaker note marker XYZ" in notes_text
