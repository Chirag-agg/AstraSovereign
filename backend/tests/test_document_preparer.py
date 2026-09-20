"""DocumentPreparer tests: PDF rendering, image preparation, clean failures."""

import asyncio

import pytest
from reportlab.pdfgen import canvas

from app.services.document_preparer import (
    DocumentPreparationError,
    DocumentPreparer,
    page_number_from_path,
)
from tests.conftest import make_png, make_text_pdf


def run(coro):
    return asyncio.run(coro)


def make_multipage_pdf(path, page_count=3):
    c = canvas.Canvas(str(path))
    for i in range(1, page_count + 1):
        c.drawString(72, 760, f"Page {i}")
        c.showPage()
    c.save()


def test_render_text_pdf_preserves_page_numbers(tmp_path):
    pdf = tmp_path / "doc.pdf"
    make_text_pdf(pdf, ["Pump manual", "Seal inspection page"])
    pages = run(DocumentPreparer().prepare(pdf, "pdf", tmp_path / "out"))
    assert [p.page for p in pages] == [1]
    assert len(pages) == 1
    assert pages[0].image_path.exists()
    assert pages[0].width > 0 and pages[0].height > 0
    assert page_number_from_path(pages[0].image_path) == 1


def test_render_selected_pages_only(tmp_path):
    pdf = tmp_path / "three.pdf"
    make_multipage_pdf(pdf, page_count=3)
    pages = run(DocumentPreparer().prepare(pdf, "pdf", tmp_path / "out", pages=[1, 3]))
    assert [p.page for p in pages] == [1, 3]


def test_out_of_range_page_fails_cleanly(tmp_path):
    pdf = tmp_path / "one.pdf"
    make_text_pdf(pdf, ["only one page"])
    with pytest.raises(DocumentPreparationError, match="does not exist"):
        run(DocumentPreparer().prepare(pdf, "pdf", tmp_path / "out", pages=[5]))


def test_malformed_pdf_fails_cleanly(tmp_path):
    pdf = tmp_path / "broken.pdf"
    pdf.write_bytes(b"%PDF-1.4 not a real pdf at all")
    with pytest.raises(DocumentPreparationError, match="Cannot render PDF"):
        run(DocumentPreparer().prepare(pdf, "pdf", tmp_path / "out"))


def test_prepare_image_single_page(tmp_path):
    img = make_png(tmp_path / "photo.png", ["Pump seal", "leakage 3 ml/hr"])
    pages = run(DocumentPreparer().prepare(img, "png", tmp_path / "out"))
    assert [p.page for p in pages] == [1]
    assert pages[0].image_path.exists()
    assert page_number_from_path(pages[0].image_path) == 1


def test_image_with_multiple_pages_requested_fails(tmp_path):
    img = make_png(tmp_path / "photo.jpg", ["x"])
    with pytest.raises(DocumentPreparationError, match="exactly one page"):
        run(DocumentPreparer().prepare(img, "jpg", tmp_path / "out", pages=[1, 2]))


def test_unsupported_image_fails_cleanly(tmp_path):
    bogus = tmp_path / "bogus.png"
    bogus.write_bytes(b"this is not an image")
    with pytest.raises(DocumentPreparationError, match="Cannot read image"):
        run(DocumentPreparer().prepare(bogus, "png", tmp_path / "out"))


def test_unsupported_document_type_fails(tmp_path):
    doc = tmp_path / "notes.docx"
    doc.write_bytes(b"x")
    with pytest.raises(DocumentPreparationError, match="Unsupported document type"):
        run(DocumentPreparer().prepare(doc, "docx", tmp_path / "out"))


def test_oversized_image_is_downscaled(tmp_path):
    from PIL import Image

    big = tmp_path / "big.png"
    Image.new("RGB", (8000, 2000), "white").save(big)
    pages = run(DocumentPreparer(max_image_dimension=1000).prepare(big, "png", tmp_path / "out"))
    assert pages[0].width <= 1000
    assert pages[0].height <= 1000


def test_too_many_pages_fails_cleanly(tmp_path):
    pdf = tmp_path / "many.pdf"
    make_multipage_pdf(pdf, page_count=6)
    with pytest.raises(DocumentPreparationError, match="exceeding the maximum"):
        run(DocumentPreparer(max_pages=3).prepare(pdf, "pdf", tmp_path / "out"))


def make_mixed_content_pdf(path, image_size=(200, 200)):
    """One page with real text plus a small embedded photo/diagram, and one
    pure-text page with no embedded image at all — the realistic case this
    feature targets (a report page with one figure, not a full scan)."""
    from PIL import Image
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    image = Image.new("RGB", image_size, color=(200, 40, 40))
    c = canvas.Canvas(str(path))
    c.drawString(72, 760, "Inspection findings for Course 2")
    c.drawImage(ImageReader(image), 72, 400, width=image_size[0], height=image_size[1])
    c.showPage()
    c.drawString(72, 760, "A pure-text page with no figures at all")
    c.showPage()
    c.save()


def test_extract_embedded_images_finds_the_figure_not_the_whole_page(tmp_path):
    pdf = tmp_path / "mixed.pdf"
    make_mixed_content_pdf(pdf)
    preparer = DocumentPreparer()

    page_one = run(preparer.extract_embedded_images(pdf, 1, tmp_path / "out"))
    assert len(page_one) == 1
    assert page_one[0].page == 1
    assert page_one[0].image_path.exists()
    assert page_one[0].width > 0 and page_one[0].height > 0
    assert page_number_from_path(page_one[0].image_path) == 1

    page_two = run(preparer.extract_embedded_images(pdf, 2, tmp_path / "out"))
    assert page_two == []


def test_extract_embedded_images_skips_tiny_decorative_images(tmp_path):
    from PIL import Image
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    pdf = tmp_path / "icon.pdf"
    tiny = Image.new("RGB", (16, 16), color=(0, 0, 0))
    c = canvas.Canvas(str(pdf))
    c.drawString(72, 760, "A page with only a tiny decorative bullet icon")
    c.drawImage(ImageReader(tiny), 72, 700, width=16, height=16)
    c.showPage()
    c.save()

    result = run(DocumentPreparer().extract_embedded_images(pdf, 1, tmp_path / "out"))
    assert result == []


def test_extract_embedded_images_on_a_malformed_pdf_returns_empty_not_raises(tmp_path):
    bad = tmp_path / "bad.pdf"
    bad.write_bytes(b"not a real pdf")
    result = run(DocumentPreparer().extract_embedded_images(bad, 1, tmp_path / "out"))
    assert result == []
