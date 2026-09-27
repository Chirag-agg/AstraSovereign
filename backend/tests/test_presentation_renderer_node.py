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


NOTED_SLIDES = [
    pytest.param({"type": "title", "title": "T", "content": "c"}, id="title"),
    pytest.param({"type": "content", "title": "T", "content": "c"}, id="content"),
    pytest.param({"type": "bullets", "title": "T", "bullets": ["b"]}, id="bullets"),
    pytest.param({"type": "two-column", "title": "T", "columns": ["a", "b"]}, id="two-column"),
    pytest.param({"type": "table", "title": "T", "table": [["h1", "h2"], ["v1", "v2"]]}, id="table"),
    pytest.param(
        {
            "type": "chart",
            "title": "T",
            "chart": {
                "type": "bar",
                "categories": ["a", "b"],
                "series": [{"name": "s", "values": [1, 2]}],
            },
        },
        id="chart",
    ),
    pytest.param(
        {
            "type": "diagram",
            "title": "T",
            "diagram": {"nodes": [{"label": "a"}, {"label": "b"}]},
        },
        id="diagram",
    ),
    pytest.param({"type": "sources", "title": "T", "sources": ["s"]}, id="sources"),
]


@pytest.mark.parametrize("slide", NOTED_SLIDES)
@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_speaker_notes_are_written_for_every_slide_type(tmp_path, slide):
    """Notes must survive for every slide type, not just some renderers."""
    marker = f"Speaker note marker {slide['type']}"
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {"title": "Notes", "slides": [{**slide, "notes": marker}]}
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
    assert marker in notes_text


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_a_chart_slide_renders_a_real_chart_part(tmp_path):
    """A chart slide must produce an OOXML chart part carrying the data.

    This is the point of the slide type: a deck that only ever contained text
    and bullets could not show a trend or a comparison at all. The categories
    and series names prove the numbers reached PowerPoint, not just a title.
    """
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {
            "title": "Charts",
            "slides": [
                {"type": "title", "title": "Charts"},
                {
                    "type": "chart",
                    "title": "Growth",
                    "chart": {
                        "type": "line",
                        "categories": ["n=10", "n=100", "n=1000"],
                        "series": [
                            {"name": "O(n log n)", "values": [33, 664, 9966]},
                            {"name": "O(n^2)", "values": [100, 10000, 1000000]},
                        ],
                    },
                },
                {
                    "type": "chart",
                    "title": "Split",
                    "chart": {
                        "type": "pie",
                        "categories": ["Load", "Parse", "Sort"],
                        "series": [{"name": "ms", "values": [12, 30, 45]}],
                    },
                },
                {"type": "sources", "title": "Sources", "sources": ["CLRS"]},
            ],
        }
    )
    generated = renderer.generate(content, tmp_path, "charts.pptx")

    assert generated.slide_count == 4
    with zipfile.ZipFile(generated.path) as package:
        chart_parts = sorted(
            name
            for name in package.namelist()
            if re.match(r"ppt/charts/chart\d+\.xml$", name)
        )
        assert len(chart_parts) == 2, f"expected 2 chart parts, found {chart_parts}"
        blob = "".join(package.read(name).decode("utf-8") for name in chart_parts)
    assert "lineChart" in blob and "pieChart" in blob
    assert "O(n log n)" in blob and "n=1000" in blob and "Parse" in blob


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_a_diagram_slide_renders_boxes_and_arrows(tmp_path):
    """A process needs a figure, not another bullet list.

    The labels must reach the slide, and the joins must be real arrow shapes —
    without them it is a row of unconnected boxes, which shows no flow.
    """
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {
            "title": "Pipeline",
            "slides": [
                {
                    "type": "diagram",
                    "title": "The RLHF pipeline",
                    "diagram": {
                        "layout": "column",
                        "nodes": [
                            {"label": "Pretrained model", "detail": "start here"},
                            {"label": "Human feedback"},
                            {"label": "Reward model"},
                            {"label": "Policy optimisation"},
                            {"label": "Evaluation"},
                        ],
                    },
                }
            ],
        }
    )
    generated = renderer.generate(content, tmp_path, "diagram.pptx")

    with zipfile.ZipFile(generated.path) as package:
        slide_parts = [
            name
            for name in package.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        ]
        slide_xml = package.read(sorted(slide_parts)[0]).decode("utf-8")

    assert "roundRect" in slide_xml, "diagram drew no boxes"
    assert slide_xml.count("downArrow") == 4, "a five-step flow needs four arrows"
    for label in ("Pretrained model", "Reward model", "Evaluation"):
        assert label in slide_xml


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_real_renderer_is_byte_deterministic(tmp_path):
    """PptxGenJS stamps current time, so the deck must be normalized to be
    reproducible; this only fails when someone actually asserts it."""
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate({"title": "Determinism", "slides": SLIDES})
    first = renderer.generate(content, tmp_path, "first.pptx")
    second = renderer.generate(content, tmp_path, "second.pptx")
    assert first.path.read_bytes() == second.path.read_bytes()


def _slide_xml(package: zipfile.ZipFile, index: int = 1) -> str:
    return package.read(f"ppt/slides/slide{index}.xml").decode("utf-8")


def _slide_height_emu(package: zipfile.ZipFile) -> int:
    presentation = package.read("ppt/presentation.xml").decode("utf-8")
    match = re.search(r'<p:sldSz[^>]*\bcy="(\d+)"', presentation)
    assert match, "presentation.xml has no slide size"
    return int(match.group(1))


def _text_shape_bottoms(slide_xml: str) -> list[int]:
    """Bottom edge (EMU) of every shape that actually carries text."""
    bottoms: list[int] = []
    for shape in re.findall(r"<p:sp>.*?</p:sp>", slide_xml, flags=re.S):
        if "<p:txBody>" not in shape:
            continue
        off = re.search(r'<a:off [^>]*\by="(-?\d+)"', shape)
        ext = re.search(r'<a:ext [^>]*\bcy="(\d+)"', shape)
        if off and ext:
            bottoms.append(int(off.group(1)) + int(ext.group(1)))
    return bottoms


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_pptx_slide_image_renders(tmp_path):
    from tests.conftest import make_png

    picture = make_png(tmp_path / "crop.png", ["P&ID detail"])
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {
            "title": "Imaged",
            "slides": [
                {
                    "type": "content",
                    "title": "Evidence",
                    "content": "Pump detail.",
                    "image": {"path": str(picture), "caption": "P&ID detail"},
                }
            ],
        }
    )
    generated = renderer.generate(content, tmp_path, "imaged.pptx")

    with zipfile.ZipFile(generated.path) as package:
        names = package.namelist()
        assert any(name.startswith("ppt/media/") for name in names), (
            "deck carried no image part"
        )
        rels = "".join(
            package.read(name).decode("utf-8")
            for name in names
            if name.startswith("ppt/slides/_rels/") and name.endswith(".rels")
        )
    assert "media/" in rels, "no slide relationship points at the image part"


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_pptx_image_is_byte_deterministic(tmp_path):
    from tests.conftest import make_png

    picture = make_png(tmp_path / "crop.png", ["P&ID detail"])
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {
            "title": "Determinism",
            "slides": [
                {
                    "type": "content",
                    "title": "Evidence",
                    "content": "Pump detail.",
                    "image": {"path": str(picture)},
                }
            ],
        }
    )
    first = renderer.generate(content, tmp_path, "first.pptx")
    second = renderer.generate(content, tmp_path, "second.pptx")
    assert first.path.read_bytes() == second.path.read_bytes()


def _data_slide(tmp_path, picture):
    """The payload the presentation tool hands the renderer for a non-web-safe
    source: a ``data:`` URI, never a path."""
    from app.services.image_normalization import render_data_uri

    data_uri = render_data_uri(picture)
    assert data_uri and data_uri.startswith("image/png;base64,")
    return PresentationContent.model_validate(
        {
            "title": "Converted",
            "slides": [
                {
                    "type": "content",
                    "title": "Evidence",
                    "content": "Pump detail.",
                    "image": {"data": data_uri, "caption": "P&ID detail"},
                }
            ],
        }
    )


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_pptx_converted_image_renders_from_data(tmp_path):
    """A bmp source travels as base64 PNG data. PptxGenJS silently drops a
    malformed ``data`` value, so the media part and slide rel are the proof the
    ``image/png;base64,`` prefix is right."""
    from tests.conftest import make_bmp

    picture = make_bmp(tmp_path / "crop.bmp")
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    generated = renderer.generate(_data_slide(tmp_path, picture), tmp_path, "data.pptx")

    with zipfile.ZipFile(generated.path) as package:
        names = package.namelist()
        assert any(
            name.startswith("ppt/media/") and name.endswith(".png") for name in names
        ), "deck carried no PNG image part"
        rels = "".join(
            package.read(name).decode("utf-8")
            for name in names
            if name.startswith("ppt/slides/_rels/") and name.endswith(".rels")
        )
    assert "media/" in rels, "no slide relationship points at the image part"


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_pptx_converted_image_is_byte_deterministic(tmp_path):
    from tests.conftest import make_bmp

    picture = make_bmp(tmp_path / "crop.bmp")
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = _data_slide(tmp_path, picture)
    first = renderer.generate(content, tmp_path, "first.pptx")
    second = renderer.generate(content, tmp_path, "second.pptx")
    assert first.path.read_bytes() == second.path.read_bytes()


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_pptx_ragged_table_keeps_all_cells(tmp_path):
    """Sizing the grid from the first row alone dropped every later cell."""
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))
    content = PresentationContent.model_validate(
        {
            "title": "Ragged",
            "slides": [
                {
                    "type": "table",
                    "title": "Comparison",
                    "table": [["Item"], ["Course 2", "10.9 mm"], ["Weld seam", "ok", "note"]],
                }
            ],
        }
    )
    generated = renderer.generate(content, tmp_path, "ragged.pptx")

    with zipfile.ZipFile(generated.path) as package:
        slide = _slide_xml(package)
    for cell in ("Item", "Course 2", "10.9 mm", "Weld seam", "ok", "note"):
        assert cell in slide, f"cell {cell!r} was dropped from the table"


@pytest.mark.node
@pytest.mark.skipif(not node_ready(), reason="Node.js runtime not available")
def test_pptx_long_content_stays_inside_the_slide(tmp_path):
    """A body far longer than the box must shrink its font, not run off the
    slide; PptxGenJS cannot recalculate autofit on its own."""
    renderer = NodePresentationRenderer(script_path=str(SCRIPT))

    def sizes_for(body):
        content = PresentationContent.model_validate(
            {"title": "Overflow", "slides": [{"type": "content", "title": "Body", "content": body}]}
        )
        generated = renderer.generate(content, tmp_path, f"{len(body)}.pptx")
        with zipfile.ZipFile(generated.path) as package:
            slide = _slide_xml(package)
            height = _slide_height_emu(package)
            bottoms = _text_shape_bottoms(slide)
        sizes = [int(value) for value in re.findall(r'\bsz="(\d+)"', slide)]
        return sizes, bottoms, height

    short_sizes, _bottoms, _height = sizes_for("A short paragraph.")
    long_sizes, bottoms, height = sizes_for("Aggregate findings. " * 300)

    assert 1500 in short_sizes, "baseline content size changed unexpectedly"
    assert min(long_sizes) < 1500, "a long body did not shrink its font"
    assert max(bottoms, default=0) <= height, "body text ran past the slide height"
