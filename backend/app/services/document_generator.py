"""Local document generator abstraction (Phase 9).

The Agent produces structured ``DocumentContent``; a concrete generator converts
it into an office file. Word (``.docx``) and Excel (``.xlsx``) are implemented;
PowerPoint is handled by the separate presentation renderer. Everything runs
locally with local Python libraries — no cloud document APIs, no external
conversion services, no telemetry.
"""

import asyncio
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.schemas.document_content import (
    ApprovalSignature,
    DocumentContent,
    DocumentSection,
    GeneratedDocument,
)

logger = logging.getLogger("app.document_generator")

FOOTER_TEXT = "Generated locally by the Sovereign On-Premise AI Workbench."


class DocumentGenerationError(Exception):
    """A document could not be generated or validated."""


class DocumentGenerator(ABC):
    """Converts structured document content into a deliverable file."""

    supported_types: tuple[str, ...] = ()

    @abstractmethod
    async def generate(
        self, content: DocumentContent, output_dir: Path, filename: str
    ) -> GeneratedDocument:
        raise NotImplementedError

    def describe(self) -> dict:
        return {"generator": self.__class__.__name__, "types": list(self.supported_types)}


class WordDocumentGenerator(DocumentGenerator):
    """Generates valid .docx files from structured content using python-docx."""

    supported_types = ("word",)

    async def generate(
        self, content: DocumentContent, output_dir: Path, filename: str
    ) -> GeneratedDocument:
        return await asyncio.to_thread(self._generate_sync, content, output_dir, filename)

    def _generate_sync(
        self, content: DocumentContent, output_dir: Path, filename: str
    ) -> GeneratedDocument:
        try:
            from docx import Document
        except ImportError as exc:
            raise DocumentGenerationError(
                "python-docx is not installed (Word generation unavailable)"
            ) from exc

        output_dir.mkdir(parents=True, exist_ok=True)
        target = output_dir / filename

        try:
            doc = Document()
            if content.title:
                doc.add_heading(content.title, level=0)
            if content.subtitle:
                paragraph = doc.add_paragraph()
                run = paragraph.add_run(content.subtitle)
                run.italic = True

            if content.approval is not None:
                self._add_approval(doc, content.approval)

            for section in content.sections:
                self._add_section(doc, section)

            if content.sources:
                doc.add_heading("Sources", level=1)
                for source in content.sources:
                    doc.add_paragraph(source, style="List Number")

            footer = doc.sections[0].footer
            footer_paragraph = footer.paragraphs[0]
            footer_paragraph.text = FOOTER_TEXT

            doc.save(str(target))
        except DocumentGenerationError:
            raise
        except Exception as exc:
            raise DocumentGenerationError(
                f"Word generation failed: {exc.__class__.__name__}"
            ) from exc

        self._normalize_zip(target)
        self._validate(target)
        return GeneratedDocument(
            filename=filename,
            path=target,
            size_bytes=target.stat().st_size,
            type="word",
        )

    @staticmethod
    def _normalize_zip(path: Path) -> None:
        """Rewrite the .docx zip with fixed entry timestamps.

        python-docx stamps every zip entry with the current time, which makes
        byte-identical inputs produce different files across seconds. Normalizing
        entry timestamps makes generation deterministic.
        """
        import io
        import zipfile

        fixed = (1980, 1, 1, 0, 0, 0)
        buffer = io.BytesIO()
        with zipfile.ZipFile(path, "r") as source:
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as target:
                for info in source.infolist():
                    new_info = zipfile.ZipInfo(info.filename, date_time=fixed)
                    new_info.compress_type = zipfile.ZIP_DEFLATED
                    new_info.external_attr = info.external_attr
                    target.writestr(new_info, source.read(info.filename))
        path.write_bytes(buffer.getvalue())

    @staticmethod
    def _add_approval(doc, approval) -> None:
        """Render the formal approval-note block (header, body, signatures)."""
        doc.add_heading("Approval Note", level=1)
        header_rows = [
            ("Reference No.", approval.reference_number),
            ("Date", approval.date),
            ("Originator", approval.originator),
            ("Department", approval.department),
            ("Subject", approval.subject),
        ]
        header_table = doc.add_table(rows=len(header_rows), cols=2)
        header_table.style = "Table Grid"
        for row_index, (label, value) in enumerate(header_rows):
            header_table.cell(row_index, 0).text = label
            header_table.cell(row_index, 1).text = value

        if approval.background:
            doc.add_heading("Background", level=1)
            doc.add_paragraph(approval.background)
        if approval.recommendation:
            doc.add_heading("Recommendation", level=1)
            doc.add_paragraph(approval.recommendation)

        doc.add_heading("Approval", level=1)
        signatures = list(approval.signatures) or [ApprovalSignature()]
        signature_table = doc.add_table(rows=len(signatures) + 1, cols=4)
        signature_table.style = "Table Grid"
        for col_index, label in enumerate(("Name", "Designation", "Signature", "Date")):
            signature_table.cell(0, col_index).text = label
        for row_index, signature in enumerate(signatures, start=1):
            signature_table.cell(row_index, 0).text = signature.name
            signature_table.cell(row_index, 1).text = signature.designation
            signature_table.cell(row_index, 2).text = ""  # signed by hand
            signature_table.cell(row_index, 3).text = signature.date

    @staticmethod
    def _add_section(doc, section: DocumentSection) -> None:
        if section.heading:
            doc.add_heading(section.heading, level=1)
        for paragraph in section.paragraphs:
            doc.add_paragraph(paragraph)
        for bullet in section.bullets:
            doc.add_paragraph(bullet, style="List Bullet")
        for item in section.numbered:
            doc.add_paragraph(item, style="List Number")
        if section.table:
            rows = len(section.table)
            cols = max(len(row) for row in section.table)
            table = doc.add_table(rows=rows, cols=cols)
            table.style = "Table Grid"
            for row_index, row in enumerate(section.table):
                for col_index in range(cols):
                    cell_text = row[col_index] if col_index < len(row) else ""
                    table.cell(row_index, col_index).text = cell_text
        for image in section.images:
            from docx.shared import Inches

            width = Inches(image.width_inches or 6.0)
            doc.add_picture(image.path, width=width)
            if image.caption:
                caption_paragraph = doc.add_paragraph()
                caption_run = caption_paragraph.add_run(image.caption)
                caption_run.italic = True

    @staticmethod
    def _validate(path: Path) -> None:
        if not path.is_file() or path.stat().st_size <= 0:
            raise DocumentGenerationError("Generated document is missing or empty")
        try:
            from docx import Document

            Document(str(path))
        except Exception as exc:
            raise DocumentGenerationError(
                f"Generated document failed validation: {exc.__class__.__name__}"
            ) from exc


_XLSX_NUMBER_RE = re.compile(r"^-?(?:0|[1-9]\d*)(?:\.\d+)?$")
_INVALID_SHEET_CHARS_RE = re.compile(r"[\\/*?:\[\]]")


def _sheet_name(name: str, used: set[str]) -> str:
    """Return an Excel-legal, unique, <=31-char worksheet name."""
    base = _INVALID_SHEET_CHARS_RE.sub(" ", (name or "").strip())[:31].strip() or "Sheet"
    candidate = base
    index = 2
    while candidate.lower() in used:
        suffix = f" ({index})"
        candidate = base[: 31 - len(suffix)] + suffix
        index += 1
    used.add(candidate.lower())
    return candidate


def _coerce_cell(value: str):
    """Write '=...' as a real formula; keep other text verbatim.

    Plain integers/decimals are written as numbers so formulas can compute them,
    but values with leading zeros (IDs, codes) stay text.
    """
    if value.startswith("="):
        return value
    if _XLSX_NUMBER_RE.match(value):
        return float(value) if "." in value else int(value)
    return value


class XlsxDocumentGenerator(DocumentGenerator):
    """Generates valid .xlsx workbooks from structured content using openpyxl.

    Each section table becomes a worksheet (named from the section heading);
    cells beginning with ``=`` are written as real formulas. When there are no
    tables, section text is written as rows. Fully local; no macro/telemetry.
    """

    supported_types = ("excel",)

    async def generate(
        self, content: DocumentContent, output_dir: Path, filename: str
    ) -> GeneratedDocument:
        return await asyncio.to_thread(self._generate_sync, content, output_dir, filename)

    def _generate_sync(
        self, content: DocumentContent, output_dir: Path, filename: str
    ) -> GeneratedDocument:
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font
        except ImportError as exc:
            raise DocumentGenerationError(
                "openpyxl is not installed (Excel generation unavailable)"
            ) from exc

        output_dir.mkdir(parents=True, exist_ok=True)
        target = output_dir / filename

        try:
            workbook = Workbook()
            # Fixed timestamps keep byte-identical inputs deterministic.
            workbook.properties.created = datetime(1980, 1, 1)
            workbook.properties.modified = datetime(1980, 1, 1)
            used_names: set[str] = set()

            table_sections = [section for section in content.sections if section.table]
            if table_sections:
                for index, section in enumerate(table_sections):
                    sheet = workbook.active if index == 0 else workbook.create_sheet()
                    sheet.title = _sheet_name(
                        section.heading or content.title or "Sheet", used_names
                    )
                    for row_index, row in enumerate(section.table, start=1):
                        for col_index, cell in enumerate(row, start=1):
                            sheet.cell(row=row_index, column=col_index).value = _coerce_cell(
                                str(cell)
                            )
                    for col_index in range(1, max(len(row) for row in section.table) + 1):
                        sheet.cell(row=1, column=col_index).font = Font(bold=True)
            else:
                sheet = workbook.active
                sheet.title = _sheet_name(content.title or "Sheet", used_names)
                row_index = 1
                for section in content.sections:
                    if section.heading:
                        heading_cell = sheet.cell(row=row_index, column=1)
                        heading_cell.value = section.heading
                        heading_cell.font = Font(bold=True)
                        row_index += 1
                    for item in (*section.paragraphs, *section.bullets, *section.numbered):
                        sheet.cell(row=row_index, column=1).value = item
                        row_index += 1

            if content.sources:
                sheet = workbook.create_sheet(title=_sheet_name("Sources", used_names))
                for row_index, source in enumerate(content.sources, start=1):
                    sheet.cell(row=row_index, column=1).value = source

            workbook.save(str(target))
        except DocumentGenerationError:
            raise
        except Exception as exc:
            raise DocumentGenerationError(
                f"Excel generation failed: {exc.__class__.__name__}"
            ) from exc

        self._validate(target)
        return GeneratedDocument(
            filename=filename,
            path=target,
            size_bytes=target.stat().st_size,
            type="excel",
        )

    @staticmethod
    def _validate(path: Path) -> None:
        if not path.is_file() or path.stat().st_size <= 0:
            raise DocumentGenerationError("Generated workbook is missing or empty")
        try:
            from openpyxl import load_workbook

            load_workbook(str(path))
        except Exception as exc:
            raise DocumentGenerationError(
                f"Generated workbook failed validation: {exc.__class__.__name__}"
            ) from exc
