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
    TableData,
)


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


def _render_table_markdown(table: TableData) -> str:
    """Markdown rendering of a reconstructed table; every candidate is kept."""
    lines: list[str] = []
    if table.header:
        lines.append("| " + " | ".join(table.header) + " |")
        lines.append("| " + " | ".join("---" for _ in table.header) + " |")
    for row in table.rows:
        cells = []
        for cell in row:
            cells.append(" / ".join(cell.candidates))
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


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
    ) -> DocumentExtraction:
        ordered: list[ExtractionElement] = []
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
            ordered.append(element.model_copy(update=updates) if updates else element)
        return DocumentExtraction(
            document_id=document_id,
            filename=filename,
            document_type=document_type,
            backend=backend or self.backend,
            page_count=page_count if page_count is not None else max_page,
            elements=ordered,
            markdown=markdown if markdown is not None else self._markdown_for(ordered),
        )

    def from_pages(
        self,
        document_id: str,
        filename: str,
        document_type: str,
        pages: list[tuple[Optional[int], str]],
        *,
        document_sha256: str = "",
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
        )

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
