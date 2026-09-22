"""Builds the per-document extraction artifact.

Two entry points:

``from_elements``
    The general seam: takes already-built :class:`ExtractionElement` objects
    (with whatever provenance the backend produced) and fills in the
    content-addressed ``element_id`` and ``order`` for any element that does not
    already carry them.

``from_pages``
    A thin adapter over the original ``(page, text)`` shape, kept so existing
    callers (and the txt/md path) are unchanged. It emits ``source="text_layer"``
    elements with no bbox and no confidence — a PDF text layer exposes neither,
    and inventing them would be a lie the audit trail cannot afford.
"""

import hashlib
from typing import Optional

from app.schemas.extraction import (
    DocumentExtraction,
    ExtractionElement,
    TableCell,
    TableData,
)
from app.services.table_reconstruction import reconstruct_tables


def _normalize_text(text: str) -> str:
    """Whitespace-collapsed text, used only for the element_id hash — the
    element's own ``text`` is never rewritten."""
    return " ".join((text or "").split())


def _bbox_key(bbox: Optional[list]) -> str:
    """bbox rounded to int for hashing, so sub-pixel jitter in an otherwise
    identical region does not mint a new element id."""
    if not bbox:
        return ""
    try:
        return ",".join(str(int(round(float(value)))) for value in bbox)
    except (TypeError, ValueError):
        return ""


def make_element_id(
    document_sha256: str,
    page: Optional[int],
    element_type: str,
    text: str,
    bbox: Optional[list],
) -> str:
    """Stable, content-addressed element id (first 16 hex chars).

    Identity is ``doc_sha256 | page | type | normalized text | bbox``. Two runs
    over identical input produce the identical id; changing any of those inputs
    produces a different one.
    """
    payload = "|".join(
        (
            document_sha256 or "",
            "" if page is None else str(page),
            element_type or "",
            _normalize_text(text),
            _bbox_key(bbox),
        )
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _cell_text(cell: TableCell) -> str:
    """Every candidate, never just one.

    A cell with two values is the single most dangerous thing a reconstruction
    can hand a reader: a struck-through printed value and the handwritten
    correction beside it are two different numbers, and printing either alone
    is a silent choice. Both are printed, with the count named.
    """
    texts = [(candidate.text or "").strip() for candidate in cell.candidates]
    texts = [text for text in texts if text]
    if not texts:
        return ""
    if len(texts) == 1:
        return _escape_cell(texts[0])
    joined = " | ".join(_escape_cell(text) for text in texts)
    return f"{joined} ({len(texts)} candidates — ambiguous)"


def _escape_cell(text: str) -> str:
    """Keep one cell on one markdown row. The characters are markdown's, not
    the document's: nothing is reworded, only stopped from ending the row."""
    return text.replace("|", "\\|").replace("\n", " ").replace("\r", " ")


def _render_table_markdown(table: TableData) -> str:
    """Markdown rendering of a reconstructed table; every candidate is kept."""
    width = max(
        [len(table.header)]
        + [1 + max((cell.col for cell in row), default=-1) for row in table.rows]
        or [0]
    )
    if width <= 0:
        return ""
    header = list(table.header) + [""] * (width - len(table.header))
    lines = [
        "| " + " | ".join(_escape_cell(text) for text in header) + " |",
        "| " + " | ".join("---" for _ in range(width)) + " |",
    ]
    for row in table.rows:
        cells = [""] * width
        for cell in row:
            if 0 <= cell.col < width:
                cells[cell.col] = _cell_text(cell)
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def unreadable_pages_notice(pages: list) -> str:
    """The one wording used everywhere a partially-read document is surfaced.

    A page the pipeline could not read is the most dangerous failure mode an
    assessment has: the reader gets a document that is silent where it should
    have spoken, and nothing in the text itself says so. Every path that
    serves such a document's content says this first.
    """
    ordered = sorted(page for page in (pages or []) if page is not None)
    if not ordered:
        return ""
    named = ", ".join(str(page) for page in ordered)
    return f"WARNING: pages {named} of this document could not be read"



class DocumentExtractor:
    """Elements -> artifact (ordered elements + markdown)."""

    backend = "pypdf"

    def from_elements(
        self,
        document_id: str,
        filename: str,
        document_type: str,
        elements: list[ExtractionElement],
        *,
        document_sha256: str = "",
        backend: Optional[str] = None,
        page_count: Optional[int] = None,
        markdown: Optional[str] = None,
        unreadable_pages: Optional[list[int]] = None,
    ) -> DocumentExtraction:
        prepared: list[ExtractionElement] = []
        max_page = 0
        for index, element in enumerate(elements):
            if element.page is not None:
                max_page = max(max_page, element.page)
            updates: dict = {}
            if element.order is None:
                updates["order"] = index
            if element.element_id is None:
                updates["element_id"] = make_element_id(
                    document_sha256,
                    element.page,
                    element.type,
                    element.text,
                    element.bbox,
                )
            # Never mutate the caller's element.
            prepared.append(element.model_copy(update=updates) if updates else element)

        ordered: list[ExtractionElement] = []
        for index, element in enumerate(self._with_tables(prepared)):
            updates = {}
            if element.order != index:
                updates["order"] = index
            if element.element_id is None:
                updates["element_id"] = make_element_id(
                    document_sha256,
                    element.page,
                    element.type,
                    element.text,
                    element.bbox,
                )
            ordered.append(element.model_copy(update=updates) if updates else element)

        body = markdown if markdown is not None else self._markdown_for(ordered)
        notice = unreadable_pages_notice(unreadable_pages or [])
        if notice:
            body = f"{notice}\n\n{body}" if body else notice
        return DocumentExtraction(
            document_id=document_id,
            filename=filename,
            document_type=document_type,
            backend=backend or self.backend,
            page_count=page_count if page_count is not None else max_page,
            elements=ordered,
            markdown=body,
            unreadable_pages=sorted({p for p in (unreadable_pages or []) if p is not None}),
        )

    def from_pages(
        self,
        document_id: str,
        filename: str,
        document_type: str,
        pages: list[tuple[Optional[int], str]],
        *,
        document_sha256: str = "",
        unreadable_pages: Optional[list[int]] = None,
    ) -> DocumentExtraction:
        """Legacy ``(page, text)`` adapter — unchanged output shape."""
        elements: list[ExtractionElement] = []
        sections: list[str] = []
        page_count = 0
        for page, text in pages:
            if page is not None:
                page_count = max(page_count, page)
            clean = (text or "").strip()
            if not clean:
                continue
            elements.append(
                ExtractionElement(
                    type="text", page=page, text=clean, source="text_layer"
                )
            )
            if page is not None:
                sections.append(f"## Page {page}\n\n{clean}")
            else:
                sections.append(clean)
        return self.from_elements(
            document_id,
            filename,
            document_type,
            elements,
            document_sha256=document_sha256,
            page_count=page_count,
            markdown="\n\n".join(sections),
            unreadable_pages=unreadable_pages,
        )

    @staticmethod
    def _inside(element: ExtractionElement, bbox: Optional[list[float]]) -> bool:
        """Does the element's centre sit inside ``bbox``?

        The centre, not the whole box: a reconstructed table's bbox is the union
        of its members, so every member is inside by construction, but a cell
        that overhangs the union by a fraction of a pixel must not be lost.
        """
        if not bbox or element.bbox is None or len(element.bbox) != 4:
            return False
        centre_x = (element.bbox[0] + element.bbox[2]) / 2.0
        centre_y = (element.bbox[1] + element.bbox[3]) / 2.0
        return bbox[0] <= centre_x <= bbox[2] and bbox[1] <= centre_y <= bbox[3]

    @staticmethod
    def _with_tables(elements: list[ExtractionElement]) -> list[ExtractionElement]:
        """Replace each page's OCR fragments with the table they formed.

        Reconstruction is per page — a table never spans a page break — and it
        only ever consumes OCR fragments: a text-layer element carries no bbox,
        so it has no geometry to reconstruct from and is returned exactly as it
        arrived. A page that yields no table comes back untouched, which is the
        common case and must stay free of cost.

        The table takes the position of its first member in document order, so
        reading order is preserved without re-sorting anything.
        """
        by_page: dict[Optional[int], list[ExtractionElement]] = {}
        for element in elements:
            by_page.setdefault(element.page, []).append(element)

        positions = {id(element): index for index, element in enumerate(elements)}
        table_at: dict[int, ExtractionElement] = {}
        consumed: set[int] = set()

        for page_elements in by_page.values():
            tables, leftovers = reconstruct_tables(page_elements)
            if not tables:
                continue
            leftover_ids = {id(element) for element in leftovers}
            members = [
                element for element in page_elements if id(element) not in leftover_ids
            ]
            for table in tables:
                owned = [
                    element for element in members if DocumentExtractor._inside(element, table.bbox)
                ]
                if not owned:
                    continue
                anchor = min(owned, key=lambda element: positions[id(element)])
                table_at[id(anchor)] = table
                # Only what a table actually took is dropped from the page. An
                # element the reconstruction consumed but no table claimed stays
                # in the artifact as it arrived: a fragment is never lost by
                # being placed nowhere.
                consumed.update(id(element) for element in owned)

        if not consumed:
            return elements
        rebuilt: list[ExtractionElement] = []
        for element in elements:
            if id(element) in table_at:
                rebuilt.append(table_at[id(element)])
            elif id(element) not in consumed:
                rebuilt.append(element)
        return rebuilt

    @staticmethod
    def _element_body(element: ExtractionElement) -> str:
        if element.type == "table" and element.table is not None:
            return (element.text or "").strip() or _render_table_markdown(element.table)
        return (element.text or "").strip()

    @staticmethod
    def _page_section(page: Optional[int], bodies: list[str]) -> str:
        text = "\n\n".join(bodies)
        return text if page is None else f"## Page {page}\n\n{text}"

    @staticmethod
    def _markdown_for(elements: list[ExtractionElement]) -> str:
        """Markdown grouped by page.

        Elements that arrived separately but sit on the same page (OCR regions,
        and later table rows) render inside one ``## Page N`` section, so a page
        never repeats its own heading once per fragment.
        """
        sections: list[str] = []
        current_page: Optional[int] = None
        bodies: list[str] = []
        for element in elements:
            body = DocumentExtractor._element_body(element)
            if not body:
                continue
            if bodies and element.page != current_page:
                sections.append(DocumentExtractor._page_section(current_page, bodies))
                bodies = []
            current_page = element.page
            bodies.append(body)
        if bodies:
            sections.append(DocumentExtractor._page_section(current_page, bodies))
        return "\n\n".join(sections)
