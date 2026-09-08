"""Document ingestion tests: extraction, OCR detection, chunking, metadata."""

from pathlib import Path

import pytest

from app.services.document_ingestion import (
    DocumentIngestionError,
    DocumentRequiresOCR,
    build_chunks,
    chunk_text,
    document_type_for,
    extract_document_pages,
)
from tests.conftest import make_blank_pdf, make_text_pdf


def test_chunking_is_deterministic_and_order_preserving():
    text = "word " * 500
    a = chunk_text(text, chunk_size=200, chunk_overlap=50)
    b = chunk_text(text, chunk_size=200, chunk_overlap=50)
    assert a == b
    assert len(a) > 1
    # order preserved: start offsets increase
    offsets = [text.index(c) for c in a]
    assert offsets == sorted(offsets)


def test_chunking_respects_size_and_overlap():
    text = "x" * 1000
    chunks = chunk_text(text, chunk_size=300, chunk_overlap=100)
    assert all(len(c) <= 300 for c in chunks)
    assert chunks[0][-100:] == chunks[1][:100]  # overlap preserved


def test_chunking_empty_text():
    assert chunk_text("   ") == []
    assert chunk_text("") == []


def test_txt_extraction(tmp_path):
    path = tmp_path / "a.txt"
    path.write_text("Hello pump world", encoding="utf-8")
    pages = extract_document_pages(path, "txt")
    assert pages == [(None, "Hello pump world")]


def test_markdown_extraction(tmp_path):
    path = tmp_path / "b.md"
    path.write_text("# Title\nBody text", encoding="utf-8")
    pages = extract_document_pages(path, "md")
    assert pages[0][1] == "# Title\nBody text"


def test_text_pdf_extraction(tmp_path):
    pdf = tmp_path / "doc.pdf"
    make_text_pdf(pdf, ["Pump maintenance every 30 days.", "Inspect seals."])
    pages = extract_document_pages(pdf, "pdf")
    assert pages[0][0] == 1
    assert "Pump maintenance" in pages[0][1]


def test_scanned_pdf_reports_requires_ocr(tmp_path):
    pdf = tmp_path / "scan.pdf"
    make_blank_pdf(pdf)  # no text layer
    with pytest.raises(DocumentRequiresOCR, match="Document requires OCR"):
        extract_document_pages(pdf, "pdf")


def test_malformed_pdf_fails_cleanly(tmp_path):
    pdf = tmp_path / "broken.pdf"
    pdf.write_bytes(b"%PDF-1.4 this is not a real pdf at all \x00\x01")
    with pytest.raises(DocumentIngestionError, match="Cannot read PDF"):
        extract_document_pages(pdf, "pdf")


def test_unsupported_document_type():
    with pytest.raises(DocumentIngestionError, match="Unsupported document type"):
        document_type_for("notes.docx")


def test_document_type_for():
    assert document_type_for("manual.PDF") == "pdf"
    assert document_type_for("notes.txt") == "txt"
    assert document_type_for("readme.md") == "md"


def test_build_chunks_carries_page_metadata():
    pages = [(1, "alpha " * 100), (2, "beta " * 100)]
    chunks = build_chunks(pages, chunk_size=150, chunk_overlap=20)
    pages_seen = {c["page"] for c in chunks}
    assert pages_seen == {1, 2}
    assert all("text" in c for c in chunks)
