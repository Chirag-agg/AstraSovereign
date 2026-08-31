"""Local document generator abstraction (Phase 9).

The Agent produces structured ``DocumentContent``; a concrete generator converts
it into an office file. Only Word is implemented in this phase; the
``DocumentGenerator`` interface keeps Excel/PowerPoint pluggable for later.
Everything runs locally with local Python libraries — no cloud document APIs,
no external conversion services, no telemetry.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.schemas.document_content import DocumentContent, DocumentSection, GeneratedDocument

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
