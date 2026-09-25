"""Word document generator tests: headings, paragraphs, bullets, numbered lists,
tables, sources, footer, validity, and determinism."""

import asyncio

from app.schemas.document_content import (
    ApprovalNote,
    DocumentContent,
    DocumentImage,
    DocumentSection,
)
from app.services.document_generator import WordDocumentGenerator


def run(coro):
    return asyncio.run(coro)


def sample_content():
    return DocumentContent(
        title="Inspection Approval Note",
        subtitle="Generated from local evidence",
        sections=[
            DocumentSection(
                heading="Inspection Summary",
                paragraphs=["The cooling water pump was inspected on 2026-08-15."],
            ),
            DocumentSection(
                heading="Key Findings",
                bullets=["Vibration reading 2.1 mm/s", "Seal leakage 3 ml/hr"],
            ),
            DocumentSection(
                heading="Required Actions",
                numbered=["Monitor the seal at the next interval", "Verify coupling alignment"],
            ),
            DocumentSection(
                heading="Measurements",
                table=[["Reading", "Value"], ["Vibration", "2.1 mm/s"]],
            ),
        ],
        sources=["inspection_report.pdf, page 1", "pump_maintenance_manual.txt"],
    )


def read_docx(path):
    from docx import Document

    doc = Document(str(path))
    return doc


def test_word_generation_produces_valid_docx(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    assert generated.path.exists()
    assert generated.size_bytes > 0
    assert generated.filename == "note.docx"
    assert generated.type == "word"
    read_docx(generated.path)  # must open without error


def test_word_contains_title_and_headings(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    texts = [p.text for p in doc.paragraphs]
    assert "Inspection Approval Note" in texts
    for heading in ("Inspection Summary", "Key Findings", "Required Actions", "Measurements", "Sources"):
        assert any(p.text == heading and p.style.name.startswith("Heading") for p in doc.paragraphs)


def test_word_paragraphs(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    texts = [p.text for p in doc.paragraphs]
    assert "The cooling water pump was inspected on 2026-08-15." in texts


def test_word_bullet_list(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    bullets = [p.text for p in doc.paragraphs if p.style.name == "List Bullet"]
    assert bullets == ["Vibration reading 2.1 mm/s", "Seal leakage 3 ml/hr"]


def test_word_numbered_list(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    numbered = [p.text for p in doc.paragraphs if p.style.name == "List Number"]
    # required actions come first; the sources section is also a numbered list
    assert numbered[:2] == ["Monitor the seal at the next interval", "Verify coupling alignment"]
    assert numbered[2:] == ["inspection_report.pdf, page 1", "pump_maintenance_manual.txt"]


def test_word_table(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    assert len(doc.tables) == 1
    table = doc.tables[0]
    assert table.cell(0, 0).text == "Reading"
    assert table.cell(0, 1).text == "Value"
    assert table.cell(1, 0).text == "Vibration"
    assert table.cell(1, 1).text == "2.1 mm/s"


def test_word_sources_preserved(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    texts = [p.text for p in doc.paragraphs]
    assert "inspection_report.pdf, page 1" in texts
    assert "pump_maintenance_manual.txt" in texts


def test_word_footer_has_page_x_of_y_and_no_marketing_line(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    footer_text = doc.sections[0].footer.paragraphs[0].text
    assert "Page" in footer_text
    assert "of" in footer_text
    # a marketing line has no place on a formal deliverable
    assert "Sovereign On-Premise AI Workbench" not in footer_text


def test_word_uses_a4_page_size(tmp_path):
    generated = run(WordDocumentGenerator().generate(sample_content(), tmp_path, "note.docx"))
    section = read_docx(generated.path).sections[0]
    assert round(section.page_width.mm) == 210
    assert round(section.page_height.mm) == 297


def test_word_footer_carries_classification(tmp_path):
    content = sample_content()
    content.classification = "INTERNAL"
    generated = run(WordDocumentGenerator().generate(content, tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    assert "INTERNAL" in doc.sections[0].footer.paragraphs[0].text


def test_approval_note_recommendation_follows_findings(tmp_path):
    content = DocumentContent(
        title="Approval Note",
        approval=ApprovalNote(
            reference_number="X/1", background="background text", recommendation="rec text"
        ),
        sections=[DocumentSection(heading="Findings", paragraphs=["finding"])],
    )
    generated = run(WordDocumentGenerator().generate(content, tmp_path, "note.docx"))
    doc = read_docx(generated.path)
    texts = [paragraph.text for paragraph in doc.paragraphs]
    assert texts.index("Background") < texts.index("Findings")
    assert texts.index("Findings") < texts.index("Recommendation")
    assert texts.index("Recommendation") < texts.index("Approval")


def test_word_generation_is_deterministic(tmp_path):
    generator = WordDocumentGenerator()
    a = run(generator.generate(sample_content(), tmp_path, "a.docx"))
    b = run(generator.generate(sample_content(), tmp_path, "b.docx"))
    assert a.path.read_bytes() == b.path.read_bytes()


def test_empty_title_still_generates_valid_file(tmp_path):
    content = DocumentContent(
        title="",
        sections=[DocumentSection(paragraphs=["plain body"])],
    )
    generated = run(WordDocumentGenerator().generate(content, tmp_path, "plain.docx"))
    assert generated.size_bytes > 0
    read_docx(generated.path)


def test_word_embeds_converted_bmp_image(tmp_path):
    """python-docx cannot read a bmp; the converted PNG must still land inline."""
    from tests.conftest import make_bmp, make_png

    bmp = make_bmp(tmp_path / "crop.bmp")
    png = make_png(tmp_path / "crop.png", ["detail"])
    content = DocumentContent(
        title="Evidence",
        sections=[
            DocumentSection(
                heading="Figures",
                images=[
                    DocumentImage(path=str(bmp), caption="bmp figure", width_inches=3.0),
                    DocumentImage(path=str(png), caption="png figure", width_inches=3.0),
                ],
            )
        ],
    )
    generated = run(WordDocumentGenerator().generate(content, tmp_path, "figs.docx"))
    doc = read_docx(generated.path)
    assert len(doc.inline_shapes) == 2
    assert any(paragraph.text == "bmp figure" for paragraph in doc.paragraphs)
