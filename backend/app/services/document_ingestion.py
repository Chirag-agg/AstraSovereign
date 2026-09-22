"""Local document ingestion: text extraction + deterministic chunking.

Supports text-based PDFs, plain text, markdown, and standalone images
(png/jpg/jpeg). Scanned (image-only) PDFs and image files are detected here and
routed to the Phase 8 multimodal pipeline (OCR + vision) by the caller.
No external services or network calls are involved.
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from pypdf import PdfReader

SUPPORTED_DOCUMENT_TYPES = ("pdf", "txt", "md", "png", "jpg", "jpeg")
IMAGE_DOCUMENT_TYPES = ("png", "jpg", "jpeg")


class DocumentIngestionError(Exception):
    """A document could not be read or extracted cleanly."""


class DocumentRequiresOCR(DocumentIngestionError):
    """A PDF has no extractable text (scanned/image-only)."""


def document_type_for(filename: str) -> str:
    suffix = Path(filename).suffix.lower().lstrip(".")
    if suffix not in SUPPORTED_DOCUMENT_TYPES:
        raise DocumentIngestionError(
            f"Unsupported document type '.{suffix}'; "
            f"supported: {', '.join(SUPPORTED_DOCUMENT_TYPES)}"
        )
    return suffix


def extract_document_pages(path: Path, document_type: str) -> list[tuple[Optional[int], str]]:
    """Return ``(page, text)`` pairs. ``page`` is ``None`` for txt/md files."""
    if document_type in ("txt", "md"):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            raise DocumentIngestionError(f"Cannot read file: {exc}") from exc
        return [(None, text)]

    if document_type == "pdf":
        return _extract_pdf_pages(path)

    raise DocumentIngestionError(f"Unsupported document type '{document_type}'")


def extract_pdf_page_texts(path: Path) -> list[tuple[int, str]]:
    """Per-page text layer in document order, with no OCR escalation.

    Unlike ``extract_document_pages`` this never raises ``DocumentRequiresOCR``:
    a page carrying no text layer comes back as ``(page, "")`` so a caller can
    route that page — and only that page — to OCR. A mixed PDF (some typed
    pages, some scanned) is the case this exists for.
    """
    return [(layout.page, layout.text) for layout in extract_pdf_page_layouts(path)]


@dataclass(frozen=True)
class PdfPageLayout:
    """One PDF page's text layer, plus whether a page-scale raster covers it."""

    page: int
    text: str
    raster_dominant: bool


def extract_pdf_page_layouts(path: Path) -> list[PdfPageLayout]:
    """Per-page text layer and raster guess, in document order.

    The richer form of ``extract_pdf_page_texts``: the raster flag is what lets
    a caller tell a page whose only text layer is a stamp from a page that was
    genuinely typed. Reading it costs one ``PdfReader`` pass either way.
    """
    try:
        reader = PdfReader(str(path))
    except Exception as exc:
        raise DocumentIngestionError(f"Cannot read PDF: {exc}") from exc

    layouts: list[PdfPageLayout] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:
            raise DocumentIngestionError(
                f"Cannot extract PDF text on page {index}: {exc}"
            ) from exc
        layouts.append(
            PdfPageLayout(
                page=index,
                text=text,
                raster_dominant=_page_is_raster_dominant(page),
            )
        )
    return layouts


def _page_is_raster_dominant(page) -> bool:
    """Whether an embedded image carries at least as many pixels as the page
    has square points — i.e. it is a page-scale scan, not a decorative mark.

    Measured on the scenario fixtures: a 150 dpi scan is 1254x1764 px on a
    602x847 pt page, 4.3 px per point-squared. A rule, bullet, or logo sits
    orders of magnitude below 1. Image access is best-effort — a page whose
    images cannot be read is reported as not raster dominant rather than
    failing the document, because the text layer is still readable.
    """
    try:
        images = list(page.images)
        box = page.mediabox
        page_area = float(box.width) * float(box.height)
    except Exception:
        return False
    if page_area <= 0:
        return False

    pixel_area = 0
    for image in images:
        try:
            width, height = image.image.size
        except Exception:
            continue
        pixel_area += int(width) * int(height)
    return pixel_area >= page_area


def page_requires_ocr(text: str, raster_dominant: bool, min_text_chars: int) -> bool:
    """Whether one PDF page needs recognising rather than reading.

    Two page shapes need OCR: one with no text layer at all, and one whose
    visible content is a page-scale raster carrying only a stamp — a scanned
    page with "Page 3" typed over it would otherwise be indexed as the string
    "Page 3" and its real content silently lost. A typed page keeps its text
    layer however short that layer is, because there is no raster to recognise.
    """
    text = (text or "").strip()
    if raster_dominant:
        return len(text) < max(int(min_text_chars), 1)
    return not text


def _extract_pdf_pages(path: Path) -> list[tuple[Optional[int], str]]:
    pages = extract_pdf_page_texts(path)
    if sum(len(text) for _, text in pages) == 0:
        raise DocumentRequiresOCR("Document requires OCR")
    return pages


_WORD_RE = re.compile(r"\S+")


def _char_windows(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Plain character-window fallback for a single token longer than
    chunk_size (e.g. a run with no whitespace at all) — the only case where
    a word-boundary window cannot respect chunk_size."""
    step = max(chunk_size - chunk_overlap, 1)
    windows: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        windows.append(text[start:end])
        if end >= len(text):
            break
        start += step
    return windows


def chunk_text(text: str, chunk_size: int = 800, chunk_overlap: int = 100) -> list[str]:
    """Deterministic, order-preserving chunking that never splits a word.

    Each chunk is still a verbatim substring of the source text (original
    whitespace/newlines inside it are untouched) — only the boundary is
    chosen at a word edge instead of an arbitrary character offset. A chunk
    that starts or ends mid-word both reads wrong in a citation and produces
    a measurably worse embedding for the truncated token at the boundary.
    """
    text = (text or "").strip()
    if not text:
        return []
    chunk_size = max(int(chunk_size), 1)
    chunk_overlap = max(int(chunk_overlap), 0)
    words = list(_WORD_RE.finditer(text))
    if not words:
        return []

    chunks: list[str] = []
    start_idx = 0
    n = len(words)
    while start_idx < n:
        chunk_start_pos = words[start_idx].start()
        if words[start_idx].end() - chunk_start_pos > chunk_size:
            # A single token already exceeds chunk_size on its own (no
            # whitespace to break on) — fall back to a character window over
            # just that token so the chunk_size guarantee still holds.
            token = text[words[start_idx].start() : words[start_idx].end()]
            chunks.extend(_char_windows(token, chunk_size, chunk_overlap))
            start_idx += 1
            continue
        end_idx = start_idx
        while end_idx < n and (words[end_idx].end() - chunk_start_pos) <= chunk_size:
            end_idx += 1
        chunk_end_pos = words[end_idx - 1].end()
        chunks.append(text[chunk_start_pos:chunk_end_pos])
        if end_idx >= n:
            break
        if chunk_overlap == 0:
            start_idx = end_idx
            continue
        # Step back by whole words worth ~chunk_overlap characters so the
        # next window overlaps on a word boundary too; guaranteed to advance
        # start_idx (never repeats the same window) since j is at most
        # end_idx - 1 and always > start_idx when it is used.
        j = end_idx - 1
        while j > start_idx and (chunk_end_pos - words[j].start()) < chunk_overlap:
            j -= 1
        start_idx = j if j > start_idx else end_idx
    return chunks


def build_chunks(
    pages: list[tuple[Optional[int], str]],
    chunk_size: int = 800,
    chunk_overlap: int = 100,
) -> list[dict]:
    """Turn extracted pages into ordered ``{"page", "text"}`` chunks."""
    chunks: list[dict] = []
    for page, text in pages:
        for piece in chunk_text(text, chunk_size, chunk_overlap):
            chunks.append({"page": page, "text": piece})
    return chunks
