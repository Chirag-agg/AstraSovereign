"""Local document ingestion: text extraction + deterministic chunking.

Supports text-based PDFs, plain text, and markdown. Scanned (image-only) PDFs
are detected and reported as requiring OCR (not implemented in this phase).
No external services or network calls are involved.
"""

from pathlib import Path
from typing import Optional

from pypdf import PdfReader

SUPPORTED_DOCUMENT_TYPES = ("pdf", "txt", "md")


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


def _extract_pdf_pages(path: Path) -> list[tuple[int, str]]:
    try:
        reader = PdfReader(str(path))
    except Exception as exc:
        raise DocumentIngestionError(f"Cannot read PDF: {exc}") from exc

    pages: list[tuple[int, str]] = []
    total_chars = 0
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:
            raise DocumentIngestionError(
                f"Cannot extract PDF text on page {index}: {exc}"
            ) from exc
        total_chars += len(text)
        pages.append((index, text))

    if total_chars == 0:
        raise DocumentRequiresOCR("Document requires OCR")
    return pages


def chunk_text(text: str, chunk_size: int = 800, chunk_overlap: int = 100) -> list[str]:
    """Deterministic, order-preserving character-window chunking with overlap."""
    text = (text or "").strip()
    if not text:
        return []
    chunk_size = max(int(chunk_size), 1)
    step = max(int(chunk_size) - int(chunk_overlap), 1)
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start += step
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
