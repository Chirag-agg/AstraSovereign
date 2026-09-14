"""Builds the per-document extraction artifact.

Today it wraps the existing text extraction (pypdf pages, or OCR pages from the
multimodal path) into the same structured shape. Docling will implement this
seam and add real element types (table/section_header) and provenance; the
artifact schema and ``read_document`` do not change.
"""

from typing import Optional

from app.schemas.extraction import DocumentExtraction, ExtractionElement


class DocumentExtractor:
    """Page text -> ordered elements + markdown."""

    backend = "pypdf"

    def from_pages(
        self,
        document_id: str,
        filename: str,
        document_type: str,
        pages: list[tuple[Optional[int], str]],
    ) -> DocumentExtraction:
        elements: list[ExtractionElement] = []
        sections: list[str] = []
        page_count = 0
        for page, text in pages:
            if page is not None:
                page_count = max(page_count, page)
            clean = (text or "").strip()
            if not clean:
                continue
            elements.append(ExtractionElement(type="text", page=page, text=clean))
            if page is not None:
                sections.append(f"## Page {page}\n\n{clean}")
            else:
                sections.append(clean)
        return DocumentExtraction(
            document_id=document_id,
            filename=filename,
            document_type=document_type,
            backend=self.backend,
            page_count=page_count,
            elements=elements,
            markdown="\n\n".join(sections),
        )
