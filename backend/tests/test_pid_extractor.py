"""Unit tests for P&ID tag extraction, classification, tiling, and coordinate projection."""

import math
from pathlib import Path
import pytest
from PIL import Image

from app.schemas.extraction import ExtractionElement
from app.services.ocr_provider import FakeOCRProvider, OCRProvider, OCRRegion, RapidOCREngine
from app.services.pid_classifier import PIDTagClassifier, TagClassificationResult
from app.services.pid_extractor import (
    PIDExtractionError,
    PIDExtractor,
    PIDSettings,
    RawTagDetection,
    TileBox,
    compute_iou,
    compute_tile_grid,
    deduplicate_detections,
    project_tile_bbox_to_global,
)


class MockScriptedOCR(OCRProvider):
    """Deterministic OCR provider returning predefined regions for testing."""

    def __init__(self, regions: list[OCRRegion]) -> None:
        self.regions = regions

    async def recognize(self, image_path: Path) -> list[OCRRegion]:
        return self.regions


# ==============================================================================
# Step 1 Tests: Patterns, Precedence, and Classification
# ==============================================================================


def test_classifier_pattern_examples():
    """Verify that every regex pattern matches all of its documented examples."""
    classifier = PIDTagClassifier()

    expected_matches = {
        "6\"-P-1203-A1A": ("line_number", '6"-P-1203-A1A'),
        "2-W-101-CS": ("line_number", '2"-W-101-CS'),
        "3\"-HC-1001-B11": ("line_number", '3"-HC-1001-B11'),
        "TANK-204": ("equipment_tag", "TANK-204"),
        "TK-200": ("equipment_tag", "TK-200"),
        "P-101A": ("equipment_tag", "P-101A"),
        "E-102": ("equipment_tag", "E-102"),
        "V-301": ("equipment_tag", "V-301"),
        "PT-204A": ("instrument_tag", "PT-204A"),
        "FT-101": ("instrument_tag", "FT-101"),
        "TT-302": ("instrument_tag", "TT-302"),
        "LT-204": ("instrument_tag", "LT-204"),
        "PSV-501": ("instrument_tag", "PSV-501"),
        "REV 0": ("revision", "REV 0"),
        "REV B": ("revision", "REV B"),
        "REVISION 3": ("revision", "REV 3"),
        "REV. A": ("revision", "REV A"),
        "REV: 2": ("revision", "REV 2"),
    }

    for text, (expected_subtype, expected_norm) in expected_matches.items():
        res = classifier.classify(text)
        assert res is not None, f"Failed to match: {text}"
        assert res.subtype == expected_subtype, f"Wrong subtype for {text}: {res.subtype} != {expected_subtype}"
        assert res.normalized_tag == expected_norm, f"Wrong normalization for {text}: {res.normalized_tag} != {expected_norm}"


def test_classifier_precedence_resolution():
    """Verify that ambiguous matches respect the documented precedence order."""
    classifier = PIDTagClassifier()
    assert classifier.precedence[:4] == ["line_number", "equipment_tag", "instrument_tag", "revision"]

    # 1. Line number containing equipment prefix must resolve to line_number, not equipment_tag
    line_res = classifier.classify('6"-P-1203-A1A')
    assert line_res is not None
    assert line_res.subtype == "line_number"

    # 2. TK-200 could match equipment (TK) or instrument ([A-Z]{2}-num); equipment_tag takes precedence
    tank_res = classifier.classify("TK-200")
    assert tank_res is not None
    assert tank_res.subtype == "equipment_tag"

    # 3. P-101A could be Pump (equipment) or single-letter; matches equipment_tag
    pump_res = classifier.classify("P-101A")
    assert pump_res is not None
    assert pump_res.subtype == "equipment_tag"

    # 4. Standard ISA-5.1 tag (PT-204A) matches instrument_tag
    inst_res = classifier.classify("PT-204A")
    assert inst_res is not None
    assert inst_res.subtype == "instrument_tag"


def test_non_instrument_acronym_exclusion():
    """Verify that document/drawing metadata acronyms (PID, DWG, REV, etc.) never classify as instrument tags."""
    classifier = PIDTagClassifier()

    excluded_inputs = [
        "PID",
        "PID-2026",
        "DWG: PID-2026-AREA100",
        "DWG-1001",
        "P&ID-2026",
        "ISO-4001",
        "AREA-100",
        "SHT-01",
        "PROJ-99",
        "SPEC-204",
    ]
    for text in excluded_inputs:
        res = classifier.classify(text)
        assert res is None or res.subtype != "instrument_tag", f"Expected '{text}' to NOT classify as instrument_tag, got {res}"



def test_classifier_normalization_and_case_insensitivity():
    """Verify normalization standardizes lowercase and variant formatting."""
    classifier = PIDTagClassifier()

    res1 = classifier.classify("pt-204a")
    assert res1 is not None
    assert res1.normalized_tag == "PT-204A"

    res2 = classifier.classify("ft101")
    assert res2 is not None
    assert res2.normalized_tag == "FT-101"

    res3 = classifier.classify("tank-204")
    assert res3 is not None
    assert res3.normalized_tag == "TANK-204"

    res4 = classifier.classify("revision 4b")
    assert res4 is not None
    assert res4.normalized_tag == "REV 4B"


def test_classify_all_multiple_tags():
    """Verify scanning text with multiple embedded tags."""
    classifier = PIDTagClassifier()
    text = "Connected between TANK-204 and line 6\"-P-1203-A1A with transmitter PT-204A"
    all_tags = classifier.classify_all(text)

    subtypes = [t.subtype for t in all_tags]
    tags = [t.normalized_tag for t in all_tags]
    assert "equipment_tag" in subtypes
    assert "line_number" in subtypes
    assert "instrument_tag" in subtypes
    assert "TANK-204" in tags
    assert '6"-P-1203-A1A' in tags
    assert "PT-204A" in tags


# ==============================================================================
# Step 2 Tests: Tiling, Coordinate Projection, and Deduplication
# ==============================================================================


def test_tile_grid_complete_coverage():
    """Verify that compute_tile_grid covers 100% of the image without gaps."""
    w, h = 1200, 800
    rows, cols = 2, 3
    overlap = 0.15

    tiles = compute_tile_grid(image_width=w, image_height=h, rows=rows, cols=cols, overlap_ratio=overlap)
    assert len(tiles) == rows * cols

    # Check boundaries of each tile
    for t in tiles:
        assert 0 <= t.x0 < t.x1 <= w
        assert 0 <= t.y0 < t.y1 <= h

    # Check complete coverage by sampling points across the grid
    for y in range(0, h, 20):
        for x in range(0, w, 20):
            covered = any(t.x0 <= x < t.x1 and t.y0 <= y < t.y1 for t in tiles)
            assert covered, f"Pixel ({x}, {y}) is not covered by any tile!"

    # Check edges
    assert min(t.x0 for t in tiles) == 0
    assert min(t.y0 for t in tiles) == 0
    assert max(t.x1 for t in tiles) == w
    assert max(t.y1 for t in tiles) == h


def test_tile_grid_single_row_col_edge_cases():
    """Verify tiling with 1x1, 1xN, and Nx1 configurations."""
    # 1x1
    t1 = compute_tile_grid(500, 400, 1, 1, 0.15)
    assert len(t1) == 1
    assert (t1[0].x0, t1[0].y0, t1[0].x1, t1[0].y1) == (0, 0, 500, 400)

    # 1x3
    t_horiz = compute_tile_grid(900, 300, 1, 3, 0.15)
    assert len(t_horiz) == 3
    assert all(t.y0 == 0 and t.y1 == 300 for t in t_horiz)
    assert t_horiz[0].x0 == 0 and t_horiz[-1].x1 == 900


def test_coordinate_projection_math():
    """Verify local-to-global bounding box coordinate projection."""
    tile = TileBox(row=0, col=1, x0=350, y0=200, x1=750, y1=600)
    local_box = [20, 30, 120, 80]

    global_box = project_tile_bbox_to_global(tile, local_box)
    assert global_box == [370, 230, 470, 280]


def test_compute_iou():
    """Verify bounding box IoU calculation."""
    # Identical boxes
    box1 = [100, 100, 200, 200]
    assert compute_iou(box1, box1) == 1.0

    # Non-overlapping boxes
    box2 = [300, 300, 400, 400]
    assert compute_iou(box1, box2) == 0.0

    # Half overlap
    box3 = [100, 100, 200, 150]  # area = 100 * 50 = 5000
    box4 = [100, 100, 200, 200]  # area = 100 * 100 = 10000
    # intersection = 5000, union = 10000 -> 0.50
    assert compute_iou(box3, box4) == pytest.approx(0.50, abs=1e-4)


def test_seam_deduplication():
    """Verify that detections in the seam overlap region are deduplicated."""
    cls_tag = TagClassificationResult(
        subtype="instrument_tag",
        normalized_tag="PT-204A",
        matched_text="PT-204A",
    )

    # Two overlapping detections of the same tag from adjacent tiles
    det_a = RawTagDetection(
        text="PT-204A",
        tile_bbox=[100, 50, 200, 80],
        global_bbox=[400, 250, 500, 280],
        page_bbox=[100.0, 62.5, 125.0, 70.0],
        confidence=0.88,
        classification=cls_tag,
    )
    det_b = RawTagDetection(
        text="PT-204A",
        tile_bbox=[20, 52, 118, 81],
        global_bbox=[402, 251, 501, 282],
        page_bbox=[100.5, 62.7, 125.2, 70.5],
        confidence=0.96,
        classification=cls_tag,
    )

    deduped = deduplicate_detections([det_a, det_b], iou_threshold=0.50)
    assert len(deduped) == 1
    # Keeps maximum confidence
    assert deduped[0].confidence == 0.96
    # Encloses union bbox
    assert deduped[0].global_bbox == [400, 250, 501, 282]


def test_neighbor_tag_linking(tmp_path):
    """Verify that neighbor tag IDs store stable element_ids, not raw text."""
    settings = PIDSettings(neighbor_distance_threshold=150.0)
    extractor = PIDExtractor(settings=settings)

    elem1 = ExtractionElement(
        type="pid_tag",
        subtype="instrument_tag",
        element_id="elem_hash_0001",
        text="PT-204A",
        bbox=[100.0, 100.0, 150.0, 120.0],
    )
    elem2 = ExtractionElement(
        type="pid_tag",
        subtype="instrument_tag",
        element_id="elem_hash_0002",
        text="LT-204",
        bbox=[140.0, 110.0, 190.0, 130.0],  # Close to elem1
    )
    elem3 = ExtractionElement(
        type="pid_tag",
        subtype="equipment_tag",
        element_id="elem_hash_0003",
        text="TANK-204",
        bbox=[900.0, 800.0, 950.0, 850.0],  # Far from elem1
    )

    elements = [elem1, elem2, elem3]
    extractor._link_neighbor_tags(elements)

    # elem1 and elem2 should be neighbors
    assert "elem_hash_0002" in elem1.neighbor_tag_ids
    assert "elem_hash_0001" in elem2.neighbor_tag_ids
    # elem3 is too far
    assert "elem_hash_0003" not in elem1.neighbor_tag_ids
    assert "elem_hash_0001" not in elem3.neighbor_tag_ids


@pytest.mark.asyncio
async def test_pid_extractor_pipeline_synthetic(tmp_path):
    """End-to-end integration test of extract_page with a synthetic drawing image."""
    # Create synthetic test image
    img = Image.new("RGB", (600, 400), "white")
    img_path = tmp_path / "test_pid_drawing.png"
    img.save(img_path)

    # Mock OCR returning two regions
    mock_regions = [
        OCRRegion(text="PT-204A", bbox=[50, 50, 150, 80], confidence=0.95),
        OCRRegion(text="TANK-204", bbox=[300, 200, 450, 250], confidence=0.98),
    ]
    mock_ocr = MockScriptedOCR(mock_regions)
    settings = PIDSettings(tile_grid_rows=1, tile_grid_cols=1, crop_margin_pixels=10)
    extractor = PIDExtractor(settings=settings, ocr_provider=mock_ocr)

    out_dir = tmp_path / "crops"
    elements = await extractor.extract_page(
        image_or_pdf_path=img_path,
        page_number=1,
        output_dir=out_dir,
        document_sha256="fake_sha256",
    )

    assert len(elements) == 2
    tags = {e.text: e for e in elements}
    assert "PT-204A" in tags
    assert "TANK-204" in tags

    pt = tags["PT-204A"]
    assert pt.type == "pid_tag"
    assert pt.subtype == "instrument_tag"
    assert pt.confidence == 0.95
    assert pt.element_id is not None
    assert pt.image_path is not None
    # Verify crop image file was created on disk
    assert Path(pt.image_path).is_file()

    tank = tags["TANK-204"]
    assert tank.type == "pid_tag"
    assert tank.subtype == "equipment_tag"
    assert tank.confidence == 0.98
    assert Path(tank.image_path).is_file()


def test_structural_validation_line_number():
    """Verify structural validation on complete vs incomplete line numbers."""
    classifier = PIDTagClassifier()

    # Complete line number: size, service, sequence, piping class
    res_complete = classifier.classify('6"-P-1203-A1A')
    assert res_complete is not None
    assert res_complete.subtype == "line_number"
    assert res_complete.is_structurally_valid is True
    assert res_complete.validation_reason is None

    # Incomplete line number: missing piping class suffix
    res_incomplete = classifier.classify('6"-P-1203')
    assert res_incomplete is not None
    assert res_incomplete.subtype == "line_number"
    assert res_incomplete.is_structurally_valid is False
    assert "missing required segments: piping spec class" in res_incomplete.validation_reason


def test_structural_validation_instrument_isa51():
    """Verify ANSI/ISA-5.1 prefix validation for instrument tags."""
    classifier = PIDTagClassifier()

    # Valid ISA-5.1 tags
    for valid_tag in ("PT-204A", "FT-101", "PSV-501", "TIC-302", "PDIC-401"):
        res = classifier.classify(valid_tag)
        assert res is not None, f"Expected match for {valid_tag}"
        assert res.subtype == "instrument_tag"
        assert res.is_structurally_valid is True
        assert res.validation_reason is None

    # Pattern-matched but invalid ISA-5.1 tags
    for invalid_tag in ("ZZ-101", "ABCD-123", "QQ-500"):
        res = classifier.classify(invalid_tag)
        assert res is not None, f"Expected pattern match for {invalid_tag}"
        assert res.subtype == "instrument_tag"
        assert res.is_structurally_valid is False
        assert "ANSI/ISA-5.1" in res.validation_reason


@pytest.mark.asyncio
async def test_pid_extractor_structural_invalid_retained_with_lowered_confidence(tmp_path):
    """Confirm structurally invalid tags are NOT dropped, but flagged and confidence attenuated."""
    img = Image.new("RGB", (600, 400), "white")
    img_path = tmp_path / "test_invalid_tags.png"
    img.save(img_path)

    # 3 mock regions that pass regex but fail structural validation
    mock_regions = [
        OCRRegion(text='6"-P-1203', bbox=[30, 30, 120, 60], confidence=0.90),
        OCRRegion(text="ZZ-101", bbox=[150, 30, 220, 60], confidence=0.90),
        OCRRegion(text="ABCD-123", bbox=[250, 30, 340, 60], confidence=0.90),
    ]
    mock_ocr = MockScriptedOCR(mock_regions)
    settings = PIDSettings(
        tile_grid_rows=1,
        tile_grid_cols=1,
        structural_invalid_confidence_multiplier=0.50,
    )
    extractor = PIDExtractor(settings=settings, ocr_provider=mock_ocr)

    out_dir = tmp_path / "crops"
    elements = await extractor.extract_page(
        image_or_pdf_path=img_path,
        page_number=1,
        output_dir=out_dir,
        document_sha256="test_sha256",
    )

    # Must NOT drop any of the 3 tags
    assert len(elements) == 3
    elem_by_tag = {e.text: e for e in elements}

    for tag_name in ('6"-P-1203', "ZZ-101", "ABCD-123"):
        assert tag_name in elem_by_tag
        elem = elem_by_tag[tag_name]
        # Structural validation must be False
        assert elem.is_structurally_valid is False
        # Confidence must be lowered (0.90 * 0.50 = 0.45), not silent discard
        assert elem.confidence == 0.45
        # Visual evidence crop must still be generated
        assert elem.image_path is not None
        assert Path(elem.image_path).is_file()


def test_structural_validation_equipment_tag():
    """Verify structural validation for equipment tags against documented meanings."""
    classifier = PIDTagClassifier()

    # Valid equipment tags with documented engineering meanings
    valid_equipment = [
        ("TANK-204", "Storage Tank"),
        ("TK-200", "Storage Tank"),
        ("P-101A", "Pump"),
        ("E-102", "Heat Exchanger"),
        ("HX-501", "Heat Exchanger"),
        ("V-301", "Vessel / Drum"),
        ("C-201", "Compressor / Column"),
        ("R-101", "Chemical Reactor"),
        ("K-102", "Compressor / Blower"),
        ("B-101", "Boiler / Blower"),
    ]
    for tag_str, _expected_meaning in valid_equipment:
        res = classifier.classify(tag_str)
        assert res is not None, f"Expected match for {tag_str}"
        assert res.subtype == "equipment_tag"
        assert res.is_structurally_valid is True
        assert res.validation_reason is None

    # Pattern-matched but invalid equipment tags (undocumented prefixes)
    for invalid_tag in ("Z-101", "Q-204", "M-301"):
        res = classifier.classify(invalid_tag)
        assert res is not None, f"Expected pattern match for {invalid_tag}"
        assert res.subtype == "equipment_tag"
        assert res.is_structurally_valid is False
        assert "not a recognized process equipment category" in res.validation_reason


@pytest.mark.asyncio
async def test_rotated_text_handling(tmp_path):
    """Verify that rotated 90/270 degree text on vertical piping/instruments is extracted."""
    from PIL import ImageDraw

    w, h = 1000, 800
    canvas = Image.new("RGB", (w, h), "white")
    draw = ImageDraw.Draw(canvas)

    # 1. Horizontal tag
    draw.text((100, 100), "PT-204A", fill="black")

    # 2. 90-degree rotated line number (vertical reading up)
    txt_img_90 = Image.new("RGBA", (300, 60), (255, 255, 255, 0))
    d90 = ImageDraw.Draw(txt_img_90)
    d90.text((10, 10), '2"-W-101-CS', fill="black")
    rot_90 = txt_img_90.rotate(90, expand=True)
    canvas.paste(rot_90, (300, 200), rot_90)

    # 3. 270-degree rotated instrument tag (vertical reading down)
    txt_img_270 = Image.new("RGBA", (300, 60), (255, 255, 255, 0))
    d270 = ImageDraw.Draw(txt_img_270)
    d270.text((10, 10), "LT-102", fill="black")
    rot_270 = txt_img_270.rotate(270, expand=True)
    canvas.paste(rot_270, (600, 200), rot_270)

    test_img = tmp_path / "rotated_pid.png"
    canvas.save(test_img, format="PNG")

    extractor = PIDExtractor(ocr_provider=RapidOCREngine())
    out_dir = tmp_path / "crops"
    elements = await extractor.extract_page(
        image_or_pdf_path=test_img,
        page_number=1,
        output_dir=out_dir,
        document_sha256="rot_hash",
    )

    tag_map = {e.text: e for e in elements}
    assert "PT-204A" in tag_map, "Horizontal tag must be detected"
    assert "LT-102" in tag_map, "270-degree rotated tag must be detected"
    assert '2"-W-101-CS' in tag_map, "90-degree rotated tag must be detected"

    # Verify vertical aspect ratio on rotated tags
    lt = tag_map["LT-102"]
    lt_bbox = lt.bbox  # [x0, y0, x1, y1]
    assert (lt_bbox[3] - lt_bbox[1]) > (lt_bbox[2] - lt_bbox[0]), "Rotated tag bbox must be taller than wide"


def test_cross_page_tag_linkage():
    """Verify that identical normalized tags spanning multiple pages are linked via continues_on_pages."""
    elem_p1_line = ExtractionElement(
        type="pid_tag",
        subtype="line_number",
        text='6"-P-1203-A1A',
        page=1,
        element_id="elem_p1_line",
    )
    elem_p1_tank = ExtractionElement(
        type="pid_tag",
        subtype="equipment_tag",
        text="TANK-204",
        page=1,
        element_id="elem_p1_tank",
    )
    elem_p1_pt = ExtractionElement(
        type="pid_tag",
        subtype="instrument_tag",
        text="PT-204A",
        page=1,
        element_id="elem_p1_pt",
    )
    elem_p2_line = ExtractionElement(
        type="pid_tag",
        subtype="line_number",
        text='6"-P-1203-A1A',
        page=2,
        element_id="elem_p2_line",
    )
    elem_p3_line = ExtractionElement(
        type="pid_tag",
        subtype="line_number",
        text='6"-P-1203-A1A',
        page=3,
        element_id="elem_p3_line",
    )
    elem_p3_tank = ExtractionElement(
        type="pid_tag",
        subtype="equipment_tag",
        text="TANK-204",
        page=3,
        element_id="elem_p3_tank",
    )

    all_elements = [
        elem_p1_line,
        elem_p1_tank,
        elem_p1_pt,
        elem_p2_line,
        elem_p3_line,
        elem_p3_tank,
    ]

    PIDExtractor.link_cross_page_tags(all_elements)

    # 6"-P-1203-A1A appears on pages 1, 2, 3
    assert elem_p1_line.continues_on_pages == [2, 3]
    assert elem_p2_line.continues_on_pages == [1, 3]
    assert elem_p3_line.continues_on_pages == [1, 2]

    # TANK-204 appears on pages 1, 3
    assert elem_p1_tank.continues_on_pages == [3]
    assert elem_p3_tank.continues_on_pages == [1]

    # PT-204A only appears on page 1
    assert elem_p1_pt.continues_on_pages == []


@pytest.mark.asyncio
async def test_tile_ocr_failure_isolation(tmp_path):
    """Verify that an OCR failure on one tile does not crash extraction of the whole page."""
    img = Image.new("RGB", (600, 400), "white")
    img_path = tmp_path / "test_tile_fail.png"
    img.save(img_path)

    # Create mock OCR that fails on the second tile call
    call_count = 0

    class FailingOCRProvider(FakeOCRProvider):
        async def recognize(self, image_path: Path):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("Simulated transient OCR crash on tile 2")
            return [
                OCRRegion(
                    text="PT-204A",
                    bbox=[50, 50, 150, 80],
                    confidence=0.95,
                )
            ]

    # 1 row, 2 cols = 2 tiles
    settings = PIDSettings(tile_grid_rows=1, tile_grid_cols=2, crop_margin_pixels=10)
    extractor = PIDExtractor(ocr_provider=FailingOCRProvider({}), settings=settings)

    elements = await extractor.extract_page(
        image_or_pdf_path=img_path,
        page_number=1,
        output_dir=tmp_path / "crops",
        document_sha256="fake_sha",
    )

    # Even though tile 2 failed, tile 1 succeeded and returned PT-204A
    assert len(elements) >= 1
    assert elements[0].text == "PT-204A"
    assert call_count == 2


@pytest.mark.asyncio
async def test_pdf_render_clean_domain_exceptions(tmp_path):
    """Verify that file-access or invalid page errors raise clean PIDExtractionError."""
    extractor = PIDExtractor(ocr_provider=FakeOCRProvider({}))

    # 1. Non-existent file
    with pytest.raises(PIDExtractionError) as exc_info:
        await extractor.extract_page(
            image_or_pdf_path=tmp_path / "does_not_exist.pdf",
            page_number=1,
            output_dir=tmp_path / "crops",
        )
    assert "Source file not found" in str(exc_info.value)

    # 2. Corrupt or non-image raster file
    corrupt_file = tmp_path / "corrupt.png"
    corrupt_file.write_text("not an image")
    with pytest.raises(PIDExtractionError) as exc_info2:
        await extractor.extract_page(
            image_or_pdf_path=corrupt_file,
            page_number=1,
            output_dir=tmp_path / "crops",
        )
    assert "Cannot open image file" in str(exc_info2.value)




