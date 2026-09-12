"""Excel generator tests: workbook validity, real formulas, numeric cells,
ID preservation, unique sheet names, sources, text fallback, and determinism."""

import asyncio

from app.schemas.document_content import DocumentContent, DocumentSection
from app.services.document_generator import XlsxDocumentGenerator


def run(coro):
    return asyncio.run(coro)


def load(path):
    from openpyxl import load_workbook

    return load_workbook(str(path))


def test_xlsx_generates_valid_workbook(tmp_path):
    content = DocumentContent(
        title="Findings",
        sections=[
            DocumentSection(
                heading="Readings",
                table=[["Item", "Value"], ["Course 2", "10.9"]],
            )
        ],
    )
    generated = run(XlsxDocumentGenerator().generate(content, tmp_path, "findings.xlsx"))
    assert generated.path.exists()
    assert generated.size_bytes > 0
    assert generated.type == "excel"
    workbook = load(generated.path)
    assert "Readings" in workbook.sheetnames
    assert workbook["Readings"]["B2"].value == 10.9


def test_xlsx_writes_real_formulas(tmp_path):
    content = DocumentContent(
        title="Totals",
        sections=[
            DocumentSection(
                heading="Numbers",
                table=[
                    ["Item", "Value"],
                    ["A", "1"],
                    ["B", "2"],
                    ["Total", "=SUM(B2:B3)"],
                ],
            )
        ],
    )
    generated = run(XlsxDocumentGenerator().generate(content, tmp_path, "totals.xlsx"))
    sheet = load(generated.path)["Numbers"]
    assert sheet["B2"].value == 1
    assert sheet["B3"].value == 2
    assert sheet["B4"].value == "=SUM(B2:B3)"
    assert sheet["B4"].data_type == "f"


def test_xlsx_preserves_ids_with_leading_zeros(tmp_path):
    content = DocumentContent(
        title="Ids",
        sections=[
            DocumentSection(heading="Codes", table=[["Code", "Value"], ["007", "42"]])
        ],
    )
    generated = run(XlsxDocumentGenerator().generate(content, tmp_path, "ids.xlsx"))
    sheet = load(generated.path)["Codes"]
    assert sheet["A2"].value == "007"
    assert sheet["B2"].value == 42


def test_xlsx_sheet_names_are_unique(tmp_path):
    content = DocumentContent(
        title="Dup",
        sections=[
            DocumentSection(heading="Data", table=[["a"], ["1"]]),
            DocumentSection(heading="Data", table=[["b"], ["2"]]),
        ],
    )
    generated = run(XlsxDocumentGenerator().generate(content, tmp_path, "dup.xlsx"))
    names = load(generated.path).sheetnames
    assert len(names) == len(set(names)) == 2


def test_xlsx_sources_sheet(tmp_path):
    content = DocumentContent(
        title="Src",
        sections=[DocumentSection(heading="T", table=[["a"], ["1"]])],
        sources=["report.pdf, p.1"],
    )
    generated = run(XlsxDocumentGenerator().generate(content, tmp_path, "src.xlsx"))
    workbook = load(generated.path)
    assert "Sources" in workbook.sheetnames
    assert workbook["Sources"]["A1"].value == "report.pdf, p.1"


def test_xlsx_text_fallback_without_tables(tmp_path):
    content = DocumentContent(
        title="Notes",
        sections=[
            DocumentSection(
                heading="Summary",
                paragraphs=["line one"],
                bullets=["point"],
            )
        ],
    )
    generated = run(XlsxDocumentGenerator().generate(content, tmp_path, "notes.xlsx"))
    sheet = load(generated.path)["Notes"]
    values = [
        cell.value
        for row in sheet.iter_rows()
        for cell in row
        if cell.value is not None
    ]
    assert "Summary" in values
    assert "line one" in values
    assert "point" in values


def test_xlsx_is_deterministic(tmp_path):
    content = DocumentContent(
        title="D",
        sections=[DocumentSection(heading="T", table=[["a"], ["1"]])],
    )
    generator = XlsxDocumentGenerator()
    first = run(generator.generate(content, tmp_path, "a.xlsx"))
    second = run(generator.generate(content, tmp_path, "b.xlsx"))
    assert first.path.read_bytes() == second.path.read_bytes()
