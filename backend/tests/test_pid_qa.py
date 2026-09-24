"""Unit and integration tests for P&ID question-answering with cropped citations."""

from pathlib import Path
import pytest
from PIL import Image

from app.schemas.extraction import DocumentExtraction, ExtractionElement
from app.services.pid_classifier import PIDTagClassifier
from app.services.pid_extractor import PIDSettings
from app.services.pid_qa import PIDQuestionAnswerer


@pytest.fixture
def sample_pid_extraction(tmp_path: Path) -> DocumentExtraction:
    """Fixture providing a mock P&ID document extraction with realistic tags."""
    # Create fake crop files so image_path checks succeed
    crop_dir = tmp_path / "crops"
    crop_dir.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGB", (100, 50), "white")
    crop_tank = crop_dir / "crop_tank204.png"
    crop_pt = crop_dir / "crop_pt204a.png"
    crop_lt = crop_dir / "crop_lt204.png"
    crop_line = crop_dir / "crop_line.png"
    crop_rev = crop_dir / "crop_rev.png"
    for p in (crop_tank, crop_pt, crop_lt, crop_line, crop_rev):
        img.save(p)

    elements = [
        ExtractionElement(
            type="pid_tag",
            subtype="equipment_tag",
            text="TANK-204",
            page=1,
            bbox=[60.0, 120.0, 360.0, 500.0],
            confidence=0.98,
            element_id="elem_tank_204",
            image_path=str(crop_tank),
            neighbor_tag_ids=["elem_pt_204a", "elem_lt_204"],
        ),
        ExtractionElement(
            type="pid_tag",
            subtype="instrument_tag",
            text="PT-204A",
            page=1,
            bbox=[700.0, 90.0, 760.0, 150.0],
            confidence=0.95,
            element_id="elem_pt_204a",
            image_path=str(crop_pt),
            neighbor_tag_ids=["elem_tank_204"],
        ),
        ExtractionElement(
            type="pid_tag",
            subtype="instrument_tag",
            text="LT-204",
            page=1,
            bbox=[770.0, 100.0, 830.0, 140.0],
            confidence=0.62,  # Low confidence (< 0.70)
            element_id="elem_lt_204",
            image_path=str(crop_lt),
            neighbor_tag_ids=["elem_tank_204"],
        ),
        ExtractionElement(
            type="pid_tag",
            subtype="line_number",
            text='6"-P-1203-A1A',
            page=1,
            bbox=[360.0, 260.0, 720.0, 270.0],
            confidence=0.99,
            element_id="elem_line_1203",
            image_path=str(crop_line),
            neighbor_tag_ids=["elem_tank_204"],
        ),
        ExtractionElement(
            type="pid_tag",
            subtype="revision",
            text="REV B",
            page=1,
            bbox=[850.0, 550.0, 950.0, 580.0],
            confidence=0.97,
            element_id="elem_rev_b",
            image_path=str(crop_rev),
            neighbor_tag_ids=[],
        ),
    ]

    return DocumentExtraction(
        document_id="doc_pid_001",
        filename="pid_sheet_01.pdf",
        document_type="pdf",
        backend="pid_tiled_ocr",
        page_count=1,
        elements=elements,
        markdown="P&ID Sheet 01 Tags",
    )


def test_answer_revision_query(sample_pid_extraction):
    """Verify drawing revision question answering."""
    qa = PIDQuestionAnswerer()
    result = qa.answer_question("What is the revision number of this P&ID?", sample_pid_extraction)

    assert result.total_tags_found == 1
    assert "REV B" in result.answer
    assert len(result.citations) == 1
    cit = result.citations[0]
    assert cit.tag == "REV B"
    assert cit.subtype == "revision"
    assert not cit.is_low_confidence
    assert Path(cit.image_path).is_file()


def test_answer_topology_neighbor_query(sample_pid_extraction):
    """Verify topological neighbor traversal for connected equipment."""
    qa = PIDQuestionAnswerer()
    result = qa.answer_question("What instruments are connected to TANK-204?", sample_pid_extraction)

    assert result.total_tags_found >= 2
    # Anchor tag and neighbors should be mentioned
    assert "TANK-204" in result.answer
    assert "PT-204A" in result.answer
    assert "LT-204" in result.answer

    # Verify LT-204 is marked low confidence in citation
    lt_cit = next(c for c in result.citations if c.tag == "LT-204")
    assert lt_cit.is_low_confidence
    assert lt_cit.confidence == 0.62
    assert Path(lt_cit.image_path).is_file()

    # Verify PT-204A is NOT low confidence
    pt_cit = next(c for c in result.citations if c.tag == "PT-204A")
    assert not pt_cit.is_low_confidence


def test_answer_direct_tag_query(sample_pid_extraction):
    """Verify looking up specific tag details."""
    qa = PIDQuestionAnswerer()
    result = qa.answer_question("Show details for line 6\"-P-1203-A1A", sample_pid_extraction)

    assert result.total_tags_found >= 1
    assert '6"-P-1203-A1A' in result.answer
    cit = next(c for c in result.citations if c.tag == '6"-P-1203-A1A')
    assert cit.subtype == "line_number"
    assert cit.confidence == 0.99
    assert not cit.is_low_confidence
    assert Path(cit.image_path).is_file()


def test_answer_category_query(sample_pid_extraction):
    """Verify querying all instruments on the drawing."""
    qa = PIDQuestionAnswerer()
    result = qa.answer_question("List all instruments in this drawing", sample_pid_extraction)

    tags = {c.tag for c in result.citations}
    assert "PT-204A" in tags
    assert "LT-204" in tags
    assert all(c.subtype == "instrument_tag" for c in result.citations)


def test_dynamic_low_confidence_threshold_override(sample_pid_extraction):
    """Verify low-confidence flag dynamically adjusts with config without re-ingesting."""
    # With threshold 0.60: LT-204 (conf 0.62) is NOT low confidence
    qa_low = PIDQuestionAnswerer(settings=PIDSettings(low_confidence_threshold=0.60))
    res_low = qa_low.answer_question("Check LT-204", sample_pid_extraction)
    lt_cit_low = next(c for c in res_low.citations if c.tag == "LT-204")
    assert not lt_cit_low.is_low_confidence

    # With threshold 0.70: LT-204 (conf 0.62) IS low confidence
    qa_high = PIDQuestionAnswerer(settings=PIDSettings(low_confidence_threshold=0.70))
    res_high = qa_high.answer_question("Check LT-204", sample_pid_extraction)
    lt_cit_high = next(c for c in res_high.citations if c.tag == "LT-204")
    assert lt_cit_high.is_low_confidence


def test_cross_page_continuity_citation(sample_pid_extraction):
    """Verify that multi-page continuations are reflected in citations and answers."""
    # Add continues_on_pages to the line element
    for e in sample_pid_extraction.elements:
        if e.text == '6"-P-1203-A1A':
            e.continues_on_pages = [2, 3]

    qa = PIDQuestionAnswerer()
    result = qa.answer_question('What is line 6"-P-1203-A1A?', sample_pid_extraction)
    cit = next(c for c in result.citations if c.tag == '6"-P-1203-A1A')
    assert cit.continues_on_pages == [2, 3]
    assert "continues on page(s): 2, 3" in result.answer
