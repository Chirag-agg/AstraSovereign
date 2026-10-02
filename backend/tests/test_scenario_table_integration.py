"""Table reconstruction driven by the real OCR engine, on the real scan.

``test_table_reconstruction.py`` pins the geometry with hand-placed boxes;
this file is the other half — the same reconstruction fed by real RapidOCR
boxes over the survey fixtures, scored against the expected values. The unit file can prove a
rule works on geometry it chose; only this one can show the rule survives the
boxes an engine actually reports.

The three shapes that matter:

* a survey sheet that *is* a table — every course row recovered, the inch-unit
  reading kept exactly as written, and the struck-through value with its
  handwritten correction kept as two candidates of one cell, each with the bbox
  it was read from;
* a survey sheet with a course missing — a row with no reading, and no reading
  invented to fill it;
* a P&ID extract — labels scattered over a drawing, which is not a table, and
  must not become one.
"""

import asyncio
import shutil
from pathlib import Path

import pytest

from app.services.extraction_store import JsonExtractionStore
from app.services.ocr_provider import RapidOCREngine
from tests.conftest import make_multimodal_stack

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures" / "table_integration"

COURSES = ["1", "2", "3", "4", "5", "6"]
INCH_TO_MM = 25.4
READINGS_2026 = {
    "1": {"printed_mm": 13.4},
    "2": {"printed_mm": 10.9},
    "3": {"printed_mm": 11.2},
    "4": {"printed_mm": 12.8},
    "5": {"struck_mm": 10.4, "handwritten_mm": 11.6},
    "6": {"printed_in": 0.455},
}
READINGS_2021 = {
    "1": 14.1,
    "2": 11.9,
    "3": 12.2,
    "4": 13.6,
    "6": 12.4,
}

REPORT_2021 = "inspection_report_2021.pdf"
REPORT_2026 = "inspection_report_2026.pdf"
PID = "tank204_pid_extract.png"
SCANS = (REPORT_2021, REPORT_2026, PID)

EXPECTED_HEADER = ["Course", "Thickness (mm)", "Remarks"]

MISSING = [name for name in SCANS if not (FIXTURES / name).exists()]

pytestmark = pytest.mark.skipif(
    bool(MISSING),
    reason=f"table integration fixtures not built: {', '.join(MISSING)}",
)


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(scope="module")
def extractions(tmp_path_factory):
    """Ingest the three scans once through the real engine."""
    tmp_path = tmp_path_factory.mktemp("scenario_tables")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path,
        ocr=RapidOCREngine(),
        extraction_store=JsonExtractionStore(tmp_path / "extractions"),
    )
    built = {}
    for name in SCANS:
        dest = uploads / "user-001" / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(FIXTURES / name, dest)
        doc = run(service.ingest_scanned("user-001", dest, name))
        assert doc.status == "ready", f"{name}: {doc.status}"
        built[name] = service.knowledge_base.get_extraction("user-001", doc.document_id)
    return built


def only_table(extraction):
    tables = [element for element in extraction.elements if element.type == "table"]
    assert len(tables) == 1, f"expected one table, found {len(tables)}"
    return tables[0]


def by_course(table):
    """Rows keyed by the text in the key column, in the order they were read."""
    keyed = {}
    for row in table.table.rows:
        keys = [cell for cell in row if cell.col == 0]
        assert keys, "every table row carries a course"
        keyed[keys[0].candidates[0].text] = row
    return keyed


def cell_in(row, column):
    return next((cell for cell in row if cell.col == column), None)


def thickness_texts(row):
    cell = cell_in(row, 1)
    return [] if cell is None else [candidate.text for candidate in cell.candidates]


@pytest.mark.rapidocr
def test_2026_sheet_becomes_one_table_with_a_row_per_course(extractions):
    table = only_table(extractions[REPORT_2026])

    assert table.source == "table_reconstruction"
    assert table.table.header == EXPECTED_HEADER
    assert list(by_course(table)) == [f"C{course}" for course in COURSES]


@pytest.mark.rapidocr
def test_2026_thickness_column_holds_exactly_what_was_printed(extractions):
    rows = by_course(only_table(extractions[REPORT_2026]))

    for course in COURSES:
        if course == "5":  # two values in one cell; asserted separately
            continue
        raw = READINGS_2026[course]
        expected = (
            f"{raw['printed_in']} in" if "printed_in" in raw else f"{raw['printed_mm']}"
        )
        assert thickness_texts(rows[f"C{course}"]) == [expected]


@pytest.mark.rapidocr
def test_2026_inch_reading_is_not_converted(extractions):
    """The instrument reported inches; converting here would bury what it said."""
    rows = by_course(only_table(extractions[REPORT_2026]))
    reported = thickness_texts(rows["C6"])[0]

    assert reported.endswith(" in")
    # 0.455 in is 11.56 mm — the value must not have been silently converted.
    converted = str(round(READINGS_2026["6"]["printed_in"] * INCH_TO_MM, 2))
    assert converted not in reported


@pytest.mark.rapidocr
def test_2026_corrected_course_keeps_both_readings_in_one_cell(extractions):
    """The struck-through value and the handwritten one are two facts, not one."""
    rows = by_course(only_table(extractions[REPORT_2026]))
    cell = cell_in(rows["C5"], 1)

    printed = str(READINGS_2026["5"]["struck_mm"])
    handwritten = str(READINGS_2026["5"]["handwritten_mm"])
    assert [candidate.text for candidate in cell.candidates] == [printed, handwritten]
    # Each candidate keeps the region it was read from, so the choice between
    # them is one a reader can still check.
    assert all(candidate.bbox for candidate in cell.candidates)
    assert cell.candidates[0].bbox != cell.candidates[1].bbox
    assert all(candidate.source_element_id for candidate in cell.candidates)
    # And the cell's own confidence is the weaker of the two.
    assert cell.confidence == min(
        candidate.confidence for candidate in cell.candidates
    )


@pytest.mark.rapidocr
def test_2026_ambiguous_cell_renders_every_candidate(extractions):
    markdown = extractions[REPORT_2026].markdown

    assert "| C5 | 10.4 | 11.6 (2 candidates — ambiguous) | re-shot |" in markdown
    assert "| C6 | 0.455 in | as reported |" in markdown
    # The handwritten value was folded into the cell, not left beside the table.
    assert "\n11.6\n" not in markdown


@pytest.mark.rapidocr
def test_2021_missing_course_gets_a_row_with_no_reading(extractions):
    """Course 5 was not accessible; the row says so rather than inventing one."""
    table = only_table(extractions[REPORT_2021])
    rows = by_course(table)

    assert table.table.header == EXPECTED_HEADER
    assert list(rows) == [f"C{course}" for course in COURSES]
    assert thickness_texts(rows["C5"]) == []
    assert [cell.col for cell in rows["C5"]] == [0, 2]


@pytest.mark.rapidocr
def test_2021_readings_match_the_previous_survey_exactly(extractions):
    rows = by_course(only_table(extractions[REPORT_2021]))

    read = {
        f"C{course}": thickness_texts(rows[f"C{course}"])
        for course in READINGS_2021
    }
    assert read == {
        f"C{course}": [str(value)]
        for course, value in READINGS_2021.items()
    }


@pytest.mark.rapidocr
def test_a_pid_extract_is_not_a_table(extractions):
    """A drawing's labels share no column structure; a wrong table is worse."""
    extraction = extractions[PID]

    assert [element for element in extraction.elements if element.type == "table"] == []
    # The labels are still there — as the text they are.
    assert extraction.elements
    assert all(element.type == "text" for element in extraction.elements)


@pytest.mark.rapidocr
def test_every_reconstructed_cell_sits_inside_its_table(extractions):
    for name in (REPORT_2021, REPORT_2026):
        table = only_table(extractions[name])
        assert table.bbox is not None
        for row in table.table.rows:
            for cell in row:
                assert cell.bbox is not None
                assert table.bbox[0] <= cell.bbox[0]
                assert table.bbox[1] <= cell.bbox[1]
                assert cell.bbox[2] <= table.bbox[2]
                assert cell.bbox[3] <= table.bbox[3]
