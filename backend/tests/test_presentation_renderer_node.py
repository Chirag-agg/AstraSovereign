"""Integration test for the real, vendored PptxGenJS renderer.

Marked ``node``: skipped (with a visible reason) only when the Node.js runtime
is unavailable, mirroring the ``docker`` marker. The full PptxGenJS dependency
closure is committed under ``presentation/node_modules``, so this exercises the
actual ``render.cjs`` in CI — a dead deck generator can no longer stay green
behind a fake renderer.
"""

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
