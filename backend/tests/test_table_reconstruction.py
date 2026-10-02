"""Table reconstruction from OCR geometry — pure, synthetic, no engine.

Every element here is hand-placed, so a failure names the geometry that broke
rather than an OCR engine's opinion of a fixture. The column x-intervals and
the 70 px row pitch mirror the scenario reports; the fixtures themselves are
exercised separately through the real engine.

What this pins down:

* a clean grid becomes one table with the right header and the right values;
* a skewed page still reads as rows, because tolerance is measured from the
  page's own line height rather than assumed;
* a cell that was never read leaves its column empty instead of shifting the
  row's values left;
* two values in one cell are both kept, in reading order, each with its own
  bbox — never merged and never chosen between;
* a wrapped remark continues the row above instead of becoming a row of its
  own;
* a title block above the table is not part of it;
* a paragraph and a scatter of drawing labels are not tables — a wrong table
  is worse than no table.
"""

from app.schemas.extraction import ExtractionElement
from app.services.table_reconstruction import reconstruct_tables

KEY = (105, 260)
VALUE = (425, 579)
REMARK = (745, 900)
COLUMNS = (KEY, VALUE, REMARK)

ROW_PITCH = 70
ROW_HEIGHT = 40
FIRST_ROW = 330

HEADER = ("Course", "Thickness (mm)", "Remarks")


def element(text, column, row, *, page=1, confidence=0.9, source="ocr", skew=0.0, dy=0):
    x1, x2 = column
    y1 = FIRST_ROW + row * ROW_PITCH + skew * x1 + dy
    return ExtractionElement(
        type="text",
        page=page,
        text=text,
        bbox=[float(x1), float(y1), float(x2), float(y1 + ROW_HEIGHT)],
        confidence=confidence,
        source=source,
    )


def grid(rows, *, page=1, skew=0.0):
    elements = []
    for row_index, cells in enumerate(rows):
        for column_index, text in enumerate(cells):
            if text:
                elements.append(
                    element(text, COLUMNS[column_index], row_index, page=page, skew=skew)
                )
    return elements


BASIC = [
    HEADER,
    ("C1", "13.4", ""),
    ("C2", "10.9", ""),
    ("C3", "11.2", ""),
    ("C4", "12.8", ""),
]


def test_clean_grid_becomes_one_table():
    tables, leftovers = reconstruct_tables(grid(BASIC))

    assert len(tables) == 1
    assert leftovers == []
    table = tables[0]
    assert table.type == "table"
    assert table.source == "table_reconstruction"
    assert table.page == 1
    assert table.table.header == ["Course", "Thickness (mm)", "Remarks"]
    assert len(table.table.rows) == 4
    assert [row[0].candidates[0].text for row in table.table.rows] == ["C1", "C2", "C3", "C4"]
    assert [row[1].candidates[0].text for row in table.table.rows] == [
        "13.4",
        "10.9",
        "11.2",
        "12.8",
    ]


def test_cell_confidence_is_the_minimum_of_its_candidates():
    elements = grid(BASIC)
    for element_ in elements:
        if element_.text == "C1":
            element_.confidence = 0.42  # the only fragment in that cell

    tables, _ = reconstruct_tables(elements)

    assert tables[0].table.rows[0][0].confidence == 0.42


def test_cell_bbox_covers_its_fragment_and_element_bbox_covers_the_table():
    tables, _ = reconstruct_tables(grid(BASIC))

    table = tables[0]
    first = table.table.rows[0][0]
    assert first.bbox == [float(KEY[0]), float(FIRST_ROW + ROW_PITCH), float(KEY[1]),
                          float(FIRST_ROW + ROW_PITCH + ROW_HEIGHT)]
    assert table.bbox[0] == float(KEY[0])
    assert table.bbox[2] == float(REMARK[1])
    assert table.bbox[1] == float(FIRST_ROW)
    assert table.bbox[3] == float(FIRST_ROW + 4 * ROW_PITCH + ROW_HEIGHT)


def test_a_skewed_page_still_reads_as_rows():
    """~1 degree: the row's fragments disagree by ~11 px vertically."""
    tables, leftovers = reconstruct_tables(grid(BASIC, skew=0.0175))

    assert len(tables) == 1
    assert leftovers == []
    assert len(tables[0].table.rows) == 4
    assert tables[0].table.rows[3][1].candidates[0].text == "12.8"


def test_a_missing_cell_leaves_that_column_empty_rather_than_shifting_values():
    rows = [HEADER, ("C1", "13.4", ""), ("C2", "", "re-shot"), ("C3", "11.2", "")]
    tables, _ = reconstruct_tables(grid(rows))

    table = tables[0]
    assert [cell.col for cell in table.table.rows[1]] == [0, 2]
    assert table.table.rows[1][0].candidates[0].text == "C2"


def test_two_values_in_one_cell_are_both_kept_in_reading_order():
    elements = grid(BASIC)
    # The struck-through printed value and the handwritten correction beside it.
    elements.append(element("11.6", VALUE, 1, confidence=0.55, skew=0.0, dy=24))

    tables, leftovers = reconstruct_tables(elements)

    assert leftovers == []
    cell = tables[0].table.rows[0][1]
    assert [candidate.text for candidate in cell.candidates] == ["13.4", "11.6"]
    assert [candidate.bbox[1] for candidate in cell.candidates] == sorted(
        candidate.bbox[1] for candidate in cell.candidates
    )
    assert cell.confidence == 0.55
    assert all(candidate.source_element_id is None for candidate in cell.candidates)


def test_a_wrapped_remark_continues_the_row_above():
    rows = [HEADER, ("C1", "13.4", "first line"), ("C2", "10.9", ""), ("C3", "11.2", "")]
    elements = grid(rows)
    # The second line of C1's remark: no key column, free text only, sitting
    # between two rows rather than inside either one.
    elements.append(element("second line", REMARK, 1, dy=40))

    tables, _ = reconstruct_tables(elements)

    table = tables[0]
    assert len(table.table.rows) == 3
    remark = table.table.rows[0][2]
    assert [candidate.text for candidate in remark.candidates] == ["first line", "second line"]
    assert [row[0].candidates[0].text for row in table.table.rows] == ["C1", "C2", "C3"]


def test_a_title_block_above_the_table_is_not_part_of_it():
    elements = grid(BASIC)
    wide = (90, 1100)
    for row, text in enumerate(
        ["MRPL - MECHANICAL MAINTENANCE", "Ultrasonic Thickness Survey - TANK-204", "Survey date: 2026-08-15"]
    ):
        elements.append(element(text, wide, row - 4))

    tables, leftovers = reconstruct_tables(elements)

    assert len(tables) == 1
    assert len(tables[0].table.rows) == 4
    assert [element.text for element in leftovers] == [
        "MRPL - MECHANICAL MAINTENANCE",
        "Ultrasonic Thickness Survey - TANK-204",
        "Survey date: 2026-08-15",
    ]


def test_a_multiline_paragraph_is_not_a_table():
    """Prose whose lines wrap at the same place still has no readings in it."""
    left = (90, 490)
    right = (500, 900)
    lines = [
        ("Readings taken with a 5 MHz dual-element probe.", ""),
        ("Values below the SOP-09 retirement limit require", "engineering review."),
        ("Course 6 recorded in inches by the field", "instrument; convert as needed."),
        ("Course 5 required a repeat shot after a", "probe fault on the shell."),
        ("The survey covered the full shell from", "the bottom course upward."),
        ("No other accessible course was left", "unsurveyed in this interval."),
    ]
    elements = []
    for row, (first, second) in enumerate(lines):
        elements.append(element(first, left, row))
        if second:
            elements.append(element(second, right, row))

    tables, leftovers = reconstruct_tables(elements)

    assert tables == []
    assert len(leftovers) == len(elements)


def test_a_scatter_of_drawing_labels_is_not_a_table():
    labels = [
        ("TANK-204", (120, 260), 0),
        ("LT-204", (770, 870), 0),
        ("25.0 m DIA", (90, 300), 3),
        ("FT-204", (500, 600), 3),
        ("13.0 m HT", (90, 340), 4),
        ("P&ID extract - TANK-204 and connected lines", (400, 900), 7),
    ]
    elements = [element(text, column, row) for text, column, row in labels]

    tables, leftovers = reconstruct_tables(elements)

    assert tables == []
    assert len(leftovers) == len(elements)


def test_elements_without_geometry_take_no_part():
    elements = grid(BASIC)
    without_bbox = ExtractionElement(type="text", page=1, text="typed elsewhere", source="ocr")
    text_layer = ExtractionElement(
        type="text", page=1, text="from a text layer", source="text_layer", bbox=[0, 0, 10, 10]
    )
    elements.extend([without_bbox, text_layer])

    tables, leftovers = reconstruct_tables(elements)

    assert len(tables) == 1
    assert without_bbox in leftovers
    assert text_layer in leftovers


def test_too_little_structure_is_left_as_text():
    """Two data rows is not a table: the acceptance rule keeps it as text."""
    rows = [HEADER, ("C1", "13.4", ""), ("C2", "10.9", "")]
    elements = grid(rows)

    tables, leftovers = reconstruct_tables(elements)

    assert tables == []
    assert leftovers == elements
