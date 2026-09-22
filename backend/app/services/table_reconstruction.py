"""Reconstructs tables from OCR geometry alone.

Pure: no model, no I/O, no schema knowledge beyond the extraction element. It
takes the OCR regions that landed on one page and returns the tables it found
plus everything it left alone. An element either becomes part of exactly one
table or is handed back untouched.

The input shape is the whole point. OCR gives fragments with boxes, and a
fragment only means something next to the fragments beside and above it. A
table is recovered by geometry — rows from vertical position, columns from the
header row's x-intervals — never by asking a model to guess a structure and
never by reflowing the text. A fragment that cannot be placed is left as a text
element rather than being assigned to the nearest plausible cell.

Nothing here invents. Every value is the OCR text of some region, each cell
keeps *every* candidate that fell into it, and a cell's confidence is the
minimum of its candidates'. Units are never converted: "0.455 in" stays
"0.455 in", because converting it here would hide the unit the instrument
actually reported.
"""

import re
from typing import Optional

from app.schemas.extraction import (
    CellCandidate,
    ExtractionElement,
    TableCell,
    TableData,
)

# A cell is numeric when the *whole* cell is a number, optionally followed by a
# short unit token: "13.4", "0.455 in", "12.5%". A cell that merely contains a
# digit is a label, not a reading, and "25.0 m DIA" is not numeric either — the
# unit check is deliberately too narrow to accept a stray word.
_NUMERIC_RE = re.compile(r"^[+-]?\d+(?:[.,]\d+)?\s*[A-Za-z%°]{0,8}$")

# Row clustering tolerance, as a fraction of the page's median element height.
# Two fragments belong to the same row when their vertical centres are this
# close. The scenario fixtures measure a ~40 px line height, a ~70 px row pitch
# and a ~0.4 degree scan skew that displaces a fragment by ~7 px across the
# page, so two-thirds of a line height groups a row without reaching the row
# below it — which matters for the handwritten correction, whose ink box sits
# ~23 px below the printed value it corrects.
_ROW_TOLERANCE_FRACTION = 0.6

# Acceptance rule. A structured region narrower, shorter, or less consistent
# than this is left as text elements: a wrong table is worse than no table,
# because it hands a reader a structure the document never had.
_MIN_COLUMNS = 2
_MIN_DATA_ROWS = 3
_MIN_ROW_MATCH = 0.70

# ...and most rows must actually carry a reading. Geometry alone cannot tell a
# table from a justified block of prose whose lines happen to wrap at the same
# place: both give aligned fragments in aligned columns. What separates them is
# content — a table of readings has a reading in nearly every row, prose has
# none — so a region without numbers is left as the text it is.
_MIN_NUMERIC_ROWS = 0.5

# A fragment belongs to a column when at least this share of its width lies
# inside that column's band. A caption or a title runs across the table and is
# not a cell; a value that sits in a column whose header text is narrower than
# the column still is.
#
# A fragment that fails this — because it spills past the gap between two
# columns, as a handwritten correction scribbled to the right of the value it
# replaces does — is still a cell of the column its centre falls in, provided it
# never reaches another column's *header*. That is the difference the share is a
# proxy for: a reading sits under its own label, a caption runs across the
# labels. Both readings are kept; the caption is not a cell and is left alone.
_MIN_CELL_CONTAINMENT = 0.9


class _Row:
    """A horizontal band of fragments, in left-to-right order."""

    def __init__(self, element: ExtractionElement) -> None:
        self.elements: list[ExtractionElement] = [element]
        self._centre_sum = _centre_y(element)

    @property
    def centre(self) -> float:
        return self._centre_sum / len(self.elements)

    def add(self, element: ExtractionElement) -> None:
        self.elements.append(element)
        self._centre_sum += _centre_y(element)

    def sort(self) -> None:
        self.elements.sort(key=lambda element: element.bbox[0])


def _centre_y(element: ExtractionElement) -> float:
    return (element.bbox[1] + element.bbox[3]) / 2.0


def _height(element: ExtractionElement) -> float:
    return element.bbox[3] - element.bbox[1]


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2.0


def _union(boxes: list[list[float]]) -> Optional[list[float]]:
    if not boxes:
        return None
    return [
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    ]


def _min_confidence(values: list[Optional[float]]) -> Optional[float]:
    known = [value for value in values if value is not None]
    return min(known) if known else None


def _is_numeric(text: str) -> bool:
    return bool(_NUMERIC_RE.match((text or "").strip()))


def _numeric_fraction(elements: list[ExtractionElement]) -> float:
    texts = [(element.text or "").strip() for element in elements]
    non_empty = [text for text in texts if text]
    if not non_empty:
        return 1.0
    return sum(1 for text in non_empty if _is_numeric(text)) / len(non_empty)


def _is_candidate_header(elements: list[ExtractionElement]) -> bool:
    """A header row labels its columns; a data row is made of readings.

    Strictly *less* than half numeric, so a row that is one label and one
    reading ("C1 | 13.4") is not mistaken for a header, while a row of column
    titles ("Course | Thickness (mm) | Remarks") is.
    """
    return len(elements) >= _MIN_COLUMNS and _numeric_fraction(elements) < 0.5


def _column_bands(
    header: list[ExtractionElement],
) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    """Column bands from the header's own x-intervals.

    The boundary between two columns is the midpoint of the gap between their
    header texts; the outer columns run to infinity. Anchoring on the header
    rather than on the data is what keeps a value in the column its label
    claims, even though a header's text is narrower than the column it heads.

    Returns the bands and the header intervals they were cut from; the second
    is what tells a reading that sits under its own label from a caption that
    runs across the table (see ``_band_index``).
    """
    intervals = sorted((element.bbox[0], element.bbox[2]) for element in header)
    edges = [float("-inf")]
    for (_, previous_right), (next_left, _) in zip(intervals, intervals[1:]):
        edges.append((previous_right + next_left) / 2.0)
    edges.append(float("inf"))
    return list(zip(edges, edges[1:])), intervals


def _band_index(
    element: ExtractionElement,
    bands: list[tuple[float, float]],
    intervals: list[tuple[float, float]],
) -> Optional[int]:
    left, right = element.bbox[0], element.bbox[2]
    width = right - left
    if width <= 0:
        return None
    centre = (left + right) / 2.0
    for index, (low, high) in enumerate(bands):
        if low <= centre < high:
            overlap = min(right, high) - max(left, low)
            if overlap / width >= _MIN_CELL_CONTAINMENT:
                return index
            for other, (other_left, other_right) in enumerate(intervals):
                if other == index:
                    continue
                if left < other_right and right > other_left:
                    return None
            return index
    return None


def _row_matches(
    elements: list[ExtractionElement],
    bands: list[tuple[float, float]],
    intervals: list[tuple[float, float]],
) -> bool:
    """Does this row line up with the table's columns?

    Every fragment must sit inside exactly one column band. A row of one
    fragment matches only when that fragment is *not* in the key column: a
    wrapped remark continues the row above it, but a lone key-column label is
    a line above the table, not a row of it.
    """
    if not elements:
        return False
    assigned = []
    for element in elements:
        band = _band_index(element, bands, intervals)
        if band is None:
            return False
        assigned.append(band)
    if len(assigned) >= _MIN_COLUMNS:
        return True
    return assigned[0] != 0


def _row_is_table_like(
    elements: list[ExtractionElement], key_left: float
) -> bool:
    """May this row be part of the table region?

    Two or more fragments always may. A single fragment may when it does not
    start at the key column's left edge — that is a continuation or a note in a
    free-text column, not a key-column-only line. This is deliberately looser
    than :func:`_row_matches`: the run is drawn generously and then judged by
    how much of it actually lines up with the columns.
    """
    if len(elements) >= _MIN_COLUMNS:
        return True
    return len(elements) == 1 and elements[0].bbox[0] > key_left + 1


def _cluster_rows(elements: list[ExtractionElement], tolerance: float) -> list[_Row]:
    rows: list[_Row] = []
    for element in sorted(elements, key=lambda item: (_centre_y(item), item.bbox[0])):
        centre = _centre_y(element)
        nearest = None
        nearest_gap = None
        for row in rows:
            gap = abs(centre - row.centre)
            if nearest_gap is None or gap < nearest_gap:
                nearest, nearest_gap = row, gap
        if nearest is not None and nearest_gap is not None and nearest_gap <= tolerance:
            nearest.add(element)
        else:
            rows.append(_Row(element))
    for row in rows:
        row.sort()
    return rows


def _candidates(elements: list[ExtractionElement]) -> list[CellCandidate]:
    return [
        CellCandidate(
            text=(element.text or "").strip(),
            bbox=list(element.bbox),
            confidence=element.confidence,
            source_element_id=element.element_id,
        )
        for element in sorted(elements, key=lambda element: (element.bbox[0], element.bbox[1]))
    ]


def _cell(elements: list[ExtractionElement], row: int, column: int) -> TableCell:
    return TableCell(
        row=row,
        col=column,
        candidates=_candidates(elements),
        bbox=_union([element.bbox for element in elements]),
        confidence=_min_confidence([element.confidence for element in elements]),
    )


def _build_table(
    header: list[ExtractionElement],
    data: list[list[ExtractionElement]],
    bands: list[tuple[float, float]],
    intervals: list[tuple[float, float]],
    page: Optional[int],
) -> tuple[ExtractionElement, list[ExtractionElement]]:
    members: list[ExtractionElement] = list(header)

    header_cells: dict[int, list[ExtractionElement]] = {}
    for element in header:
        band = _band_index(element, bands, intervals)
        if band is not None:
            header_cells.setdefault(band, []).append(element)
    table_header = [
        " ".join(
            (element.text or "").strip()
            for element in sorted(header_cells.get(column, []), key=lambda e: e.bbox[0])
        )
        for column in range(len(bands))
    ]

    # Built as sparse columns, then rendered dense: a row is free to leave a
    # column empty, and a cell is free to hold more than one candidate.
    grid: list[dict[int, TableCell]] = []
    for elements in data:
        grouped: dict[int, list[ExtractionElement]] = {}
        for element in elements:
            band = _band_index(element, bands, intervals)
            if band is not None:
                grouped.setdefault(band, []).append(element)
        if not grouped:
            continue
        if 0 not in grouped and grid:
            # A continuation: no key column, only free text. It belongs to the
            # row above — a wrapped remark is one remark, not a row with a hole
            # where its key should be.
            for column, extra in sorted(grouped.items()):
                existing = grid[-1].get(column)
                if existing is None:
                    grid[-1][column] = _cell(extra, len(grid) - 1, column)
                    continue
                existing.candidates.extend(_candidates(extra))
                existing.bbox = _union(
                    ([existing.bbox] if existing.bbox else [])
                    + [list(element.bbox) for element in extra]
                )
                existing.confidence = _min_confidence(
                    [existing.confidence, *(element.confidence for element in extra)]
                )
            members.extend(elements)
            continue
        row_index = len(grid)
        grid.append(
            {
                column: _cell(extra, row_index, column)
                for column, extra in sorted(grouped.items())
            }
        )
        members.extend(elements)

    table_rows = [[cell for _, cell in sorted(row.items())] for row in grid]
    table_element = ExtractionElement(
        type="table",
        page=page,
        text="",
        bbox=_union([element.bbox for element in members]),
        confidence=_min_confidence([element.confidence for element in members]),
        source="table_reconstruction",
        table=TableData(header=table_header, rows=table_rows),
    )
    return table_element, members


def _best_table(rows: list[_Row], page: Optional[int]) -> Optional[
    tuple[ExtractionElement, list[ExtractionElement]]
]:
    best: Optional[tuple[ExtractionElement, list[ExtractionElement]]] = None
    best_rows = 0
    for index, header_row in enumerate(rows):
        if not _is_candidate_header(header_row.elements):
            continue
        bands, intervals = _column_bands(header_row.elements)
        if len(bands) < _MIN_COLUMNS:
            continue
        key_left = header_row.elements[0].bbox[0]
        data: list[list[ExtractionElement]] = []
        for row in rows[index + 1 :]:
            if not _row_is_table_like(row.elements, key_left):
                break
            data.append(row.elements)
        if len(data) < _MIN_DATA_ROWS:
            continue
        matched = sum(
            1 for elements in data if _row_matches(elements, bands, intervals)
        ) + (1 if _row_matches(header_row.elements, bands, intervals) else 0)
        if matched / (len(data) + 1) < _MIN_ROW_MATCH:
            continue
        readings = sum(
            1
            for elements in data
            if any(_is_numeric(element.text) for element in elements)
        )
        if readings / len(data) < _MIN_NUMERIC_ROWS:
            continue
        if len(data) <= best_rows:
            continue
        best_rows = len(data)
        best = _build_table(header_row.elements, data, bands, intervals, page)
    return best


def reconstruct_tables(
    elements: list[ExtractionElement],
) -> tuple[list, list]:
    """Find the tables among one page's OCR fragments.

    Returns ``(table_elements, leftover_elements)``. Only OCR fragments with
    real geometry can take part; everything else — text-layer elements, which
    carry no bbox, and anything unrecognised — comes back untouched in
    ``leftover_elements``. When no region satisfies the acceptance rule this
    returns ``([], elements)``: the page keeps its fragments exactly as they
    arrived rather than gaining a table the document does not have.
    """
    eligible = [
        element
        for element in elements
        if element.source == "ocr"
        and element.bbox is not None
        and len(element.bbox) == 4
        and (element.text or "").strip()
    ]
    if len(eligible) < _MIN_COLUMNS * (_MIN_DATA_ROWS + 1):
        return [], list(elements)
    tolerance = _median([_height(element) for element in eligible]) * _ROW_TOLERANCE_FRACTION
    if tolerance <= 0:
        return [], list(elements)
    rows = _cluster_rows(eligible, tolerance)
    if len(rows) < _MIN_DATA_ROWS + 1:
        return [], list(elements)
    page = elements[0].page if elements else None
    found = _best_table(rows, page)
    if found is None:
        return [], list(elements)
    table_element, members = found
    consumed = {id(element) for element in members}
    leftovers = [element for element in elements if id(element) not in consumed]
    return [table_element], leftovers
