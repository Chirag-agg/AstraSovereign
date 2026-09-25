"""Document ingestion tests: extraction, OCR detection, chunking, metadata."""

from pathlib import Path

import pytest

from app.services.document_ingestion import (
    EMBEDDED_IMAGES_KEY,
    DocumentIngestionError,
    DocumentRequiresOCR,
    build_chunks,
    chunk_text,
    document_type_for,
    embedded_image_ids,
    extract_document_pages,
    extract_embedded_media,
)
from tests.conftest import (
    make_blank_pdf,
    make_bmp,
    make_docx,
    make_image_bytes,
    make_odt,
    make_pptx,
    make_text_pdf,
    make_xlsx,
)


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
        document_type_for("notes.exe")


def test_document_type_for():
    assert document_type_for("manual.PDF") == "pdf"
    assert document_type_for("notes.txt") == "txt"
    assert document_type_for("readme.md") == "md"


def test_document_type_for_accepts_office_data_and_code():
    for filename in (
        "report.docx", "budget.xlsx", "deck.pptx", "sheet.ods", "notes.odt",
        "data.csv", "data.tsv", "config.json", "config.yaml", "config.yml",
        "feed.xml", "page.html", "prose.rtf", "script.py", "main.rs",
        "diagram.svg",
    ):
        assert document_type_for(filename) == filename.rsplit(".", 1)[1]


def test_document_type_for_reads_a_dotfile():
    """``.env`` has no suffix as pathlib counts one; the name itself is the type."""
    assert document_type_for(".env") == "env"


def test_legacy_office_type_names_the_modern_equivalent():
    for legacy, modern in (("doc", "docx"), ("xls", "xlsx"), ("ppt", "pptx")):
        with pytest.raises(DocumentIngestionError) as excinfo:
            document_type_for(f"old.{legacy}")
        assert f"re-save it as '.{modern}'" in str(excinfo.value)


def test_extract_docx_includes_paragraphs_and_tables(tmp_path):
    docx = tmp_path / "report.docx"
    make_docx(
        docx,
        paragraphs=["Pump 204 inspection complete."],
        tables=[[["Tag", "Reading"], ["P-204", "3.2 mm"]]],
    )
    pages = extract_document_pages(docx, "docx")
    assert pages[0][0] is None
    text = pages[0][1]
    assert "Pump 204 inspection complete." in text
    assert "| Tag | Reading |" in text
    assert "P-204" in text and "3.2 mm" in text


def test_extract_xlsx_includes_sheets_and_cells(tmp_path):
    xlsx = tmp_path / "budget.xlsx"
    make_xlsx(xlsx, {"Sheet1": [["Item", "Cost"], ["Pump", 1200]]})
    text = extract_document_pages(xlsx, "xlsx")[0][1]
    assert "[Sheet: Sheet1]" in text
    assert "| Item | Cost |" in text
    assert "Pump" in text and "1200" in text


def test_extract_xlsx_reads_formula_only_sheets(tmp_path):
    """A formula with no cached value survives the data_only retry."""
    xlsx = tmp_path / "calc.xlsx"
    make_xlsx(xlsx, {"Sheet1": [["=SUM(1,2)"]]})
    text = extract_document_pages(xlsx, "xlsx")[0][1]
    assert "=SUM(1,2)" in text


def test_extract_pptx_includes_slide_text_and_notes(tmp_path):
    pptx = tmp_path / "deck.pptx"
    make_pptx(
        pptx,
        slides=[("First slide", ["alpha"]), ("Second slide", ["beta"])],
        notes={1: "remember the pumps"},
    )
    pages = extract_document_pages(pptx, "pptx")
    assert [page for page, _ in pages] == [1, 2]
    assert "First slide" in pages[0][1]
    assert "beta" in pages[1][1]
    assert "Notes: remember the pumps" in pages[0][1]


def test_extract_odt_includes_paragraphs(tmp_path):
    odt = tmp_path / "notes.odt"
    make_odt(odt, paragraphs=["Corrosion survey complete."])
    text = extract_document_pages(odt, "odt")[0][1]
    assert "Corrosion survey complete." in text


def test_extract_csv_as_markdown_table(tmp_path):
    csv = tmp_path / "tags.csv"
    csv.write_text("tag,value\nP-204,3.2\n", encoding="utf-8")
    text = extract_document_pages(csv, "csv")[0][1]
    assert "| tag | value |" in text
    assert "| P-204 | 3.2 |" in text


def test_extract_json_is_pretty_printed(tmp_path):
    path = tmp_path / "config.json"
    path.write_text('{"name":"pump","tag":"P-204"}', encoding="utf-8")
    text = extract_document_pages(path, "json")[0][1]
    assert '"name": "pump"' in text


def test_extract_html_drops_tags(tmp_path):
    path = tmp_path / "page.html"
    path.write_text(
        "<html><head><style>p{color:red}</style></head>"
        "<body><p>Visible text</p><script>var x=1;</script></body></html>",
        encoding="utf-8",
    )
    text = extract_document_pages(path, "html")[0][1]
    assert "Visible text" in text
    assert "var x=1" not in text
    assert "color:red" not in text


def test_extract_rtf_drops_control_words(tmp_path):
    path = tmp_path / "memo.rtf"
    path.write_text(
        r"{\rtf1\ansi{\fonttbl{\f0 Arial;}}Tank 204 inspection\par Course 2 below limit}",
        encoding="utf-8",
    )
    text = extract_document_pages(path, "rtf")[0][1]
    assert "Tank 204 inspection" in text
    assert "fonttbl" not in text


def test_extract_code_is_plain_text(tmp_path):
    path = tmp_path / "script.py"
    path.write_text("def main():\n    return 42\n", encoding="utf-8")
    assert extract_document_pages(path, "py")[0] == (None, "def main():\n    return 42\n")


def test_extract_svg_indexes_its_labels(tmp_path):
    """Nothing offline can rasterize an SVG, so it is indexed as text: the tag
    numbers a reader searches for survive, the markup does not."""
    path = tmp_path / "loop.svg"
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg">'
        "<title>Instrument loop</title>"
        '<text x="1" y="1">P-204</text>'
        '<rect width="10" height="10"/>'
        "</svg>",
        encoding="utf-8",
    )
    pages = extract_document_pages(path, "svg")
    assert pages[0][0] is None
    assert "Instrument loop" in pages[0][1]
    assert "P-204" in pages[0][1]
    assert "rect" not in pages[0][1]


def test_extract_embedded_media_lifts_a_docx_picture(tmp_path):
    docx = tmp_path / "report.docx"
    make_docx(docx, paragraphs=["Pump 204"], pictures=[make_image_bytes()])
    media = extract_embedded_media(docx, "docx")
    assert len(media) == 1
    assert media[0].suffix == ".png"
    assert media[0].page is None
    assert media[0].data == make_image_bytes()


def test_extract_embedded_media_maps_a_pptx_picture_to_its_slide(tmp_path):
    pptx = tmp_path / "deck.pptx"
    make_pptx(
        pptx,
        slides=[("One", ["a"]), ("Two", ["b"])],
        media={1: [make_image_bytes()], 2: [make_image_bytes(color=(10, 10, 10))]},
    )
    media = extract_embedded_media(pptx, "pptx")
    assert [item.page for item in media] == [1, 2]


def test_extract_embedded_media_drops_a_non_raster_part(tmp_path):
    """An EMF/WMF/audio part cannot be OCR-ed or embedded, so it is skipped
    rather than carried into the knowledge base as a broken image."""
    import zipfile

    pptx = tmp_path / "mixed.pptx"
    with zipfile.ZipFile(pptx, "w") as archive:
        archive.writestr("ppt/media/image1.png", make_image_bytes())
        archive.writestr("ppt/media/image2.emf", b"not a raster")
    media = extract_embedded_media(pptx, "pptx")
    assert [item.suffix for item in media] == [".png"]


def test_extract_embedded_media_caps_the_count(tmp_path):
    pptx = tmp_path / "huge.pptx"
    make_pptx(
        pptx,
        slides=[("One", ["a"])],
        media={1: [make_image_bytes() for _ in range(30)]},
    )
    assert len(extract_embedded_media(pptx, "pptx")) == 25


def test_extract_embedded_media_is_empty_for_a_plain_document(tmp_path):
    path = tmp_path / "notes.txt"
    path.write_text("nothing to lift out", encoding="utf-8")
    assert extract_embedded_media(path, "txt") == []


def test_embedded_image_ids_reads_dict_and_bare_entries():
    class Doc:
        metadata = {
            EMBEDDED_IMAGES_KEY: [
                {"doc_id": "doc-a", "page": 1},
                "doc-b",
                {"doc_id": "doc-a"},  # a duplicate is not repeated
                {"filename": "no id here"},
            ]
        }

    assert embedded_image_ids(Doc()) == ["doc-a", "doc-b"]


def _craft_zip(declared_bytes: int) -> bytes:
    """A minimal, valid zip whose central directory declares one stored member
    of ``declared_bytes`` uncompressed — the shape of a decompression bomb.

    Built by hand because ``zipfile`` rewrites the declared size on close.
    """
    import struct
    import zlib

    name = b"ppt/slides/slide1.xml"
    data = b"x"
    crc = zlib.crc32(data) & 0xFFFFFFFF
    local = (
        struct.pack("<4sHHHHHIIIHH", b"PK\x03\x04", 20, 0, 0, 0, 0, crc,
                    len(data), declared_bytes, len(name), 0)
        + name + data
    )
    central = (
        struct.pack("<4sHHHHHHIIIHHHHHII", b"PK\x01\x02", 20, 20, 0, 0, 0, 0, crc,
                    len(data), declared_bytes, len(name), 0, 0, 0, 0, 0, 0)
        + name
    )
    end = struct.pack(
        "<4sHHHHIIH", b"PK\x05\x06", 0, 0, 1, 1, len(central), len(local), 0
    )
    return local + central + end


def test_oversized_zip_member_is_rejected(tmp_path):
    """A member that declares a huge uncompressed size is refused before inflating."""
    path = tmp_path / "bomb.pptx"
    path.write_bytes(_craft_zip(2 * 1024 * 1024 * 1024))
    with pytest.raises(DocumentIngestionError, match="too large"):
        extract_document_pages(path, "pptx")


def test_pdf_page_texts_still_dispatch(tmp_path):
    pdf = tmp_path / "doc.pdf"
    make_text_pdf(pdf, ["Pump maintenance every 30 days."])
    assert extract_document_pages(pdf, "pdf")[0][0] == 1


def test_build_chunks_carries_page_metadata():
    pages = [(1, "alpha " * 100), (2, "beta " * 100)]
    chunks = build_chunks(pages, chunk_size=150, chunk_overlap=20)
    pages_seen = {c["page"] for c in chunks}
    assert pages_seen == {1, 2}
    assert all("text" in c for c in chunks)


def test_chunking_never_splits_a_word():
    """Too-basic RAG complaint: the old blind character slice could cut a
    chunk boundary mid-word (e.g. 'inspect' | 'ion'), which both reads wrong
    in a citation and embeds worse at the truncated boundary token. Each
    chunk must start and end on a real word boundary."""
    words = [
        "corrosion", "rate", "thickness", "reading", "inspection", "report",
        "shell", "course", "nameplate", "geometry", "revision", "procedure",
        "survey", "allowable", "stress", "efficiency", "diameter", "height",
    ]
    text = " ".join(words * 6)  # long enough to force multiple chunks
    chunks = chunk_text(text, chunk_size=80, chunk_overlap=20)
    assert len(chunks) > 1
    for chunk in chunks:
        assert chunk == chunk.strip()
        first_char, last_char = chunk[0], chunk[-1]
        assert not first_char.isspace() and not last_char.isspace()
        # Every chunk boundary must land on a real word from the source list,
        # never a fragment of one.
        assert chunk.split()[0] in words
        assert chunk.split()[-1] in words


def test_chunking_falls_back_to_character_window_for_one_giant_token():
    """A single token with no whitespace at all (pathological OCR noise, a
    URL, a hash) cannot be split on a word boundary — the chunk_size
    guarantee must still hold via a character-window fallback."""
    token = "x" * 1000
    chunks = chunk_text(token, chunk_size=300, chunk_overlap=100)
    assert all(len(c) <= 300 for c in chunks)
    assert chunks[0][-100:] == chunks[1][:100]
