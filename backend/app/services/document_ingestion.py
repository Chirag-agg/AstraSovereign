"""Local document ingestion: text extraction + deterministic chunking.

Reads every common input family with local libraries only — PDF, Office
(docx/xlsx/pptx), OpenDocument (odt/ods/odp), plain text and source code,
delimited data, JSON/YAML/XML/HTML, RTF, SVG, and standalone raster images.
Scanned (image-only) PDFs and image files are detected here and routed to the
multimodal pipeline (OCR + vision) by the caller, as are the raster images a
container document carries inside it. No external services or network calls are
involved.
"""

import csv
import json
import posixpath
import re
import zipfile
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, Optional
from xml.etree import ElementTree

from pypdf import PdfReader

# --------------------------------------------------------------- type families
#
# One family per extraction strategy. ``SUPPORTED_DOCUMENT_TYPES`` is derived
# from the families, so the accepted set and the dispatch cannot disagree.

_PLAIN_TYPES = (
    "txt", "text", "md", "markdown", "rst", "log", "ini", "cfg", "conf",
    "toml", "env", "sql",
    "py", "pyi", "js", "jsx", "mjs", "cjs", "ts", "tsx", "java", "c", "h",
    "cc", "cpp", "cxx", "hpp", "hh", "cs", "go", "rs", "rb", "php", "swift",
    "kt", "kts", "scala", "sh", "bash", "zsh", "fish", "ps1", "psm1", "bat",
    "cmd", "pl", "pm", "lua", "r", "dart", "vue", "svelte", "gradle",
    "css", "scss", "sass", "less",
)
_CSV_TYPES = ("csv", "tsv")
_JSON_TYPES = ("json",)
_YAML_TYPES = ("yaml", "yml")
_XML_TYPES = ("xml",)
_HTML_TYPES = ("html", "htm")
_RTF_TYPES = ("rtf",)
_DOCX_TYPES = ("docx",)
_XLSX_TYPES = ("xlsx",)
_PPTX_TYPES = ("pptx",)
_ODF_TYPES = ("odt", "ods", "odp")
_SVG_TYPES = ("svg",)

# Families whose file is a zip container that can carry its own raster media.
CONTAINER_DOCUMENT_TYPES = frozenset(
    (*_DOCX_TYPES, *_XLSX_TYPES, *_PPTX_TYPES, *_ODF_TYPES)
)

# Plain-text families whose raw bytes are already the best preview — there is no
# extraction rendering to prefer — so the content endpoint serves them verbatim.
PLAIN_DOCUMENT_TYPES = frozenset(_PLAIN_TYPES)

IMAGE_DOCUMENT_TYPES = ("png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp")

# Binary Office formats from before 2007. Naming the modern equivalent is more
# useful to the user than a generic "unsupported type".
LEGACY_OFFICE_TYPES = {"doc": "docx", "xls": "xlsx", "ppt": "pptx"}

SUPPORTED_DOCUMENT_TYPES = tuple(
    sorted(
        {
            "pdf",
            *_PLAIN_TYPES,
            *_CSV_TYPES,
            *_JSON_TYPES,
            *_YAML_TYPES,
            *_XML_TYPES,
            *_HTML_TYPES,
            *_RTF_TYPES,
            *_DOCX_TYPES,
            *_XLSX_TYPES,
            *_PPTX_TYPES,
            *_ODF_TYPES,
            *_SVG_TYPES,
            *IMAGE_DOCUMENT_TYPES,
        }
    )
)

# Guards against a decompression bomb and against a pathological spreadsheet or
# log turning into an unbounded embedding job.
_MAX_ENTRY_COUNT = 400
_MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024
MAX_EXTRACTED_CHARS = 2_000_000
_TRUNCATION_MARKER = "\n…[truncated]"
_MAX_SHEET_ROWS = 5000
_MAX_SHEET_COLUMNS = 100

# Embedded media: only formats the OCR pipeline can read and the generators can
# embed are surfaced. A container's EMF/WMF/audio/video parts are skipped —
# nothing downstream could use them, and carrying them into the knowledge base
# would only mislead.
_MEDIA_PREFIX_BY_TYPE = {
    "docx": "word/media/",
    "xlsx": "xl/media/",
    "pptx": "ppt/media/",
    "odt": "Pictures/",
    "ods": "Pictures/",
    "odp": "Pictures/",
}
_MAX_EMBEDDED_IMAGES = 25
_MAX_EMBEDDED_IMAGE_BYTES = 8 * 1024 * 1024

# Where a container records the image documents it produced, so a later reader
# (the attachment manifest, the delete path) can find them again.
EMBEDDED_IMAGES_KEY = "embedded_images"


class DocumentIngestionError(Exception):
    """A document could not be read or extracted cleanly."""


class DocumentRequiresOCR(DocumentIngestionError):
    """A PDF has no extractable text (scanned/image-only)."""


def document_type_for(filename: str) -> str:
    name = Path(filename).name
    suffix = Path(name).suffix.lower().lstrip(".")
    if not suffix:
        # pathlib reports no suffix for a dotfile such as ".env"; recover it.
        candidate = name.lower().lstrip(".")
        if candidate in SUPPORTED_DOCUMENT_TYPES:
            return candidate
    if suffix in LEGACY_OFFICE_TYPES:
        raise DocumentIngestionError(
            f"'.{suffix}' is a legacy binary format; "
            f"re-save it as '.{LEGACY_OFFICE_TYPES[suffix]}' and upload again"
        )
    if suffix not in SUPPORTED_DOCUMENT_TYPES:
        raise DocumentIngestionError(
            f"Unsupported document type '.{suffix}'; "
            f"supported: {', '.join(SUPPORTED_DOCUMENT_TYPES)}"
        )
    return suffix


def extract_document_pages(path: Path, document_type: str) -> list[tuple[Optional[int], str]]:
    """Return ``(page, text)`` pairs for a supported document.

    ``page`` is ``None`` for a family with no page structure of its own
    (everything but PDF and PPTX); for a PPTX it is the slide number.
    """
    document_type = (document_type or "").lower()
    family = _FAMILY_BY_TYPE.get(document_type)
    if family is None or family == "image":
        # An image has no text layer; the caller routes it to OCR instead.
        raise DocumentIngestionError(f"Unsupported document type '{document_type}'")
    if family == "pdf":
        return _extract_pdf_pages(path)
    if family == "pptx":
        return _extract_pptx_pages(path)
    return [(None, _cap(_EXTRACTORS[family](path, document_type)))]


# ------------------------------------------------------------- shared helpers


def _cap(text: str) -> str:
    if len(text) <= MAX_EXTRACTED_CHARS:
        return text
    return text[:MAX_EXTRACTED_CHARS] + _TRUNCATION_MARKER


def _read_text(path: Path) -> str:
    try:
        return _cap(path.read_text(encoding="utf-8", errors="replace"))
    except OSError as exc:
        raise DocumentIngestionError(f"Cannot read file: {exc}") from exc


def _escape_cell(value: object) -> str:
    return " ".join(str(value).split()).replace("|", "\\|")


def _markdown_table(rows: Iterable[Iterable[object]]) -> str:
    """Render rows as a markdown table *inside* the page text.

    Downstream, page text becomes both the retrieval chunks and the extraction
    artifact, so a table written this way reads back as a table in a citation.
    Ragged rows are padded and cells escaped, so a malformed table still comes
    back intact.
    """
    cleaned: list[list[str]] = []
    for row in rows:
        cells = [_escape_cell(cell) for cell in row]
        if any(cells):
            cleaned.append(cells)
    if not cleaned:
        return ""
    width = max(len(row) for row in cleaned)
    lines: list[str] = []
    for index, row in enumerate(cleaned):
        lines.append("| " + " | ".join(row + [""] * (width - len(row))) + " |")
        if index == 0:
            lines.append("| " + " | ".join("---" for _ in range(width)) + " |")
    return "\n".join(lines)


def _local_name(tag: str) -> str:
    """The tag without its XML namespace, e.g. ``{ns}a:t`` -> ``t``."""
    return tag.rsplit("}", 1)[-1]


def _checked_zip(path: Path) -> zipfile.ZipFile:
    """Open an OOXML/ODF container, refusing a decompression bomb.

    The entry count and uncompressed sizes are read from the central directory
    *before* anything is inflated, so a crafted small archive cannot expand into
    unbounded memory.
    """
    try:
        archive = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as exc:
        raise DocumentIngestionError(f"Cannot read document: {exc}") from exc
    try:
        infos = archive.infolist()
        if len(infos) > _MAX_ENTRY_COUNT:
            raise DocumentIngestionError(
                f"Document is too large to read safely: {len(infos)} internal "
                f"entries (max {_MAX_ENTRY_COUNT})"
            )
        total = sum(info.file_size for info in infos)
        if total > _MAX_UNCOMPRESSED_BYTES:
            raise DocumentIngestionError(
                f"Document is too large to read safely: {total} bytes "
                f"uncompressed (max {_MAX_UNCOMPRESSED_BYTES})"
            )
    except Exception:
        archive.close()
        raise
    return archive


# --------------------------------------------------------- Office: PowerPoint

_SLIDE_PART_RE = re.compile(r"^ppt/slides/slide(\d+)\.xml$")
_NOTES_PART_RE = re.compile(r"^ppt/notesSlides/notesSlide(\d+)\.xml$")
_PRESENTATION_PART = "ppt/presentation.xml"
_PRESENTATION_RELS = "ppt/_rels/presentation.xml.rels"
_RELATIONSHIP_NS = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
)


def _extract_pptx_pages(path: Path) -> list[tuple[Optional[int], str]]:
    """One page per slide, in presentation order, with speaker notes appended."""
    with _checked_zip(path) as archive:
        names = archive.namelist()
        slides: dict[int, str] = {}
        notes: dict[int, str] = {}
        for name in names:
            match = _SLIDE_PART_RE.match(name)
            if match:
                slides[int(match.group(1))] = name
                continue
            match = _NOTES_PART_RE.match(name)
            if match:
                notes[int(match.group(1))] = name
        if not slides:
            raise DocumentIngestionError("Presentation contains no slides")
        pages: list[tuple[Optional[int], str]] = []
        for number in _pptx_slide_order(archive, slides):
            lines = _drawingml_lines(archive.read(slides[number]))
            note = notes.get(number)
            if note:
                note_lines = _drawingml_lines(archive.read(note))
                if note_lines:
                    lines.append("Notes: " + " ".join(note_lines))
            pages.append((number, _cap("\n".join(lines))))
    return pages


def _pptx_slide_order(archive: zipfile.ZipFile, slides: dict[int, str]) -> list[int]:
    """Slide numbers in presentation order.

    A reordered deck keeps its original ``slideN.xml`` numbering and records the
    new order only in ``presentation.xml``'s relationship list, so reading the
    parts in numeric order would cite the wrong slide. Falls back to numeric
    order when that chain cannot be read.
    """
    try:
        rels = _relationships(archive.read(_PRESENTATION_RELS))
        root = ElementTree.fromstring(archive.read(_PRESENTATION_PART))
    except (KeyError, ElementTree.ParseError):
        return sorted(slides)
    ordered: list[int] = []
    for node in root.iter():
        if _local_name(node.tag) != "sldId":
            continue
        target = rels.get(node.get(f"{{{_RELATIONSHIP_NS}}}id") or "")
        if not target:
            continue
        name = posixpath.normpath(posixpath.join("ppt", target))
        match = _SLIDE_PART_RE.match(name)
        if match and int(match.group(1)) in slides and int(match.group(1)) not in ordered:
            ordered.append(int(match.group(1)))
    return ordered or sorted(slides)


def _relationships(xml_bytes: bytes) -> dict[str, str]:
    try:
        root = ElementTree.fromstring(xml_bytes)
    except ElementTree.ParseError:
        return {}
    return {
        node.get("Id", ""): node.get("Target", "")
        for node in root
        if _local_name(node.tag) == "Relationship" and node.get("Target")
    }


def _drawingml_lines(xml_bytes: bytes) -> list[str]:
    """One line per DrawingML paragraph (``a:p``), its text runs joined."""
    try:
        root = ElementTree.fromstring(xml_bytes)
    except ElementTree.ParseError as exc:
        raise DocumentIngestionError(f"Cannot read document XML: {exc}") from exc
    lines: list[str] = []
    for node in root.iter():
        if _local_name(node.tag) != "p":
            continue
        text = "".join(
            child.text or "" for child in node.iter() if _local_name(child.tag) == "t"
        ).strip()
        if text:
            lines.append(text)
    return lines


# -------------------------------------------------------------- Office: Word


def _extract_docx(path: Path, document_type: str) -> str:
    try:
        import docx
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except ImportError as exc:
        raise DocumentIngestionError(
            "Word support is not available on this deployment"
        ) from exc
    try:
        document = docx.Document(str(path))
    except Exception as exc:
        raise DocumentIngestionError(f"Cannot read Word document: {exc}") from exc
    blocks: list[str] = []
    # Walk the body's children so paragraphs and tables keep document order;
    # `document.paragraphs` alone would drop every table.
    for child in document.element.body.iterchildren():
        name = _local_name(child.tag)
        if name == "p":
            text = Paragraph(child, document).text.strip()
            if text:
                blocks.append(text)
        elif name == "tbl":
            rows = [
                [cell.text for cell in row.cells] for row in Table(child, document).rows
            ]
            table = _markdown_table(rows)
            if table:
                blocks.append(table)
    return "\n\n".join(blocks)


# -------------------------------------------------------- Office: spreadsheets


def _extract_xlsx(path: Path, document_type: str) -> str:
    workbook = _load_workbook(path, data_only=True)
    sections, has_content = _xlsx_sections(workbook)
    workbook.close()
    if has_content:
        return "\n\n".join(sections)
    # Every cell read as blank, which is what a workbook of formulas with no
    # cached values looks like under `data_only`; read the formulas instead.
    workbook = _load_workbook(path, data_only=False)
    try:
        return "\n\n".join(_xlsx_sections(workbook)[0])
    finally:
        workbook.close()


def _load_workbook(path: Path, *, data_only: bool):
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise DocumentIngestionError(
            "Spreadsheet support is not available on this deployment"
        ) from exc
    try:
        return load_workbook(str(path), read_only=True, data_only=data_only)
    except Exception as exc:
        raise DocumentIngestionError(f"Cannot read spreadsheet: {exc}") from exc


def _xlsx_sections(workbook) -> tuple[list[str], bool]:
    """Render every sheet as ``[Sheet: name]`` plus a markdown table.

    The flag is whether any sheet actually carried a value — the sheet header
    alone must not count, or a formula-only workbook would look non-empty.
    """
    sections: list[str] = []
    has_content = False
    for sheet in workbook.worksheets:
        rows: list[list[str]] = []
        for index, row in enumerate(sheet.iter_rows(values_only=True)):
            if index >= _MAX_SHEET_ROWS:
                rows.append(["…[truncated]"])
                break
            cells = [
                "" if value is None else str(value)
                for value in list(row)[:_MAX_SHEET_COLUMNS]
            ]
            if any(cell.strip() for cell in cells):
                rows.append(cells)
        sections.append(f"[Sheet: {sheet.title}]")
        table = _markdown_table(rows)
        if table:
            has_content = True
            sections.append(table)
    return sections, has_content


# ------------------------------------------------------- data and markup files


def _extract_plain(path: Path, document_type: str) -> str:
    return _read_text(path)


def _extract_delimited(path: Path, document_type: str) -> str:
    text = _read_text(path)
    delimiter = "\t" if document_type == "tsv" else ","
    try:
        delimiter = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|").delimiter
    except csv.Error:
        pass
    try:
        rows = list(csv.reader(text.splitlines(), delimiter=delimiter))
    except csv.Error as exc:
        raise DocumentIngestionError(f"Cannot read delimited file: {exc}") from exc
    return _markdown_table(rows)


def _extract_json(path: Path, document_type: str) -> str:
    text = _read_text(path)
    try:
        parsed = json.loads(text)
    except ValueError:
        return text
    return json.dumps(parsed, indent=2, ensure_ascii=False)


def _extract_yaml(path: Path, document_type: str) -> str:
    text = _read_text(path)
    try:
        import yaml
    except ImportError:
        return text
    try:
        parsed = yaml.safe_load(text)
        if parsed is None:
            return text
        return yaml.safe_dump(parsed, sort_keys=False, allow_unicode=True)
    except yaml.YAMLError:
        return text


def _extract_xml(path: Path, document_type: str) -> str:
    text = _read_text(path)
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        return text
    return "\n".join(part.strip() for part in root.itertext() if part.strip())


class _VisibleTextParser(HTMLParser):
    """Collects rendered text, dropping script and style bodies."""

    _SKIP = {"script", "style"}
    _BREAK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BREAK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag in self._BREAK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip_depth:
            self.parts.append(data)


def _extract_html(path: Path, document_type: str) -> str:
    text = _read_text(path)
    parser = _VisibleTextParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception:
        return text
    lines = [" ".join(line.split()) for line in "".join(parser.parts).splitlines()]
    return "\n".join(line for line in lines if line)


# ------------------------------------------------------------------------- RTF

_RTF_CONTROL_RE = re.compile(r"\\[a-zA-Z]+-?\d* ?")
_RTF_HEX_RE = re.compile(r"\\'([0-9a-fA-F]{2})")
_RTF_DESTINATION_RE = re.compile(
    r"\\(?:fonttbl|colortbl|stylesheet|info|pict|themedata|datastore|listtable|"
    r"listoverridetable|rsidtbl|generator|xmlnstbl|filetbl|header|footer|"
    r"footnote|annotation|object|fldinst)"
)


def _extract_rtf(path: Path, document_type: str) -> str:
    """Best-effort RTF text — enough to index, not a full RTF parser."""
    raw = _read_text(path)
    text = _rtf_to_text(raw)
    return text if text.strip() else raw


def _rtf_group_is_destination(raw: str, index: int) -> bool:
    cursor = index + 1
    if cursor >= len(raw) or raw[cursor] != "\\":
        return False
    if raw[cursor + 1 : cursor + 2] == "*":
        return True  # `{\*\...}` is by definition ignorable
    return bool(_RTF_DESTINATION_RE.match(raw, cursor))


def _skip_rtf_group(raw: str, start: int) -> int:
    """Index just past the ``}`` matching the ``{`` at ``start``."""
    depth = 0
    index = start
    while index < len(raw):
        char = raw[index]
        if char == "\\":
            index += 2  # an escaped literal; braces cannot follow a control word
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index + 1
        index += 1
    return len(raw)


def _rtf_to_text(raw: str) -> str:
    out: list[str] = []
    index = 0
    while index < len(raw):
        char = raw[index]
        if char == "\\":
            control = _RTF_CONTROL_RE.match(raw, index)
            if control:
                word = control.group(0).strip()
                if word in ("\\par", "\\line", "\\sect", "\\page"):
                    out.append("\n")
                elif word == "\\tab":
                    out.append(" ")
                index = control.end()
                continue
            hexadecimal = _RTF_HEX_RE.match(raw, index)
            if hexadecimal:
                out.append(chr(int(hexadecimal.group(1), 16)))
                index = hexadecimal.end()
                continue
            index += 2  # an escaped literal: \{ \} \\ \~
            continue
        if char == "{":
            if _rtf_group_is_destination(raw, index):
                index = _skip_rtf_group(raw, index)
                continue
            index += 1
            continue
        if char == "}":
            index += 1
            continue
        out.append(char)
        index += 1
    lines = [" ".join(line.split()) for line in "".join(out).splitlines()]
    return "\n".join(line for line in lines if line)


# --------------------------------------------------------------- ODF documents


def _extract_odf(path: Path, document_type: str) -> str:
    with _checked_zip(path) as archive:
        try:
            xml_bytes = archive.read("content.xml")
        except KeyError as exc:
            raise DocumentIngestionError(
                "OpenDocument file is missing its content"
            ) from exc
    try:
        root = ElementTree.fromstring(xml_bytes)
    except ElementTree.ParseError as exc:
        raise DocumentIngestionError(f"Cannot read document XML: {exc}") from exc
    return "\n\n".join(_odf_blocks(root))


def _odf_blocks(node) -> list[str]:
    blocks: list[str] = []
    for child in node:
        name = _local_name(child.tag)
        if name in ("p", "h"):
            text = " ".join("".join(child.itertext()).split())
            if text:
                blocks.append(text)
        elif name == "table":
            rows: list[list[str]] = []
            for row in child:
                if _local_name(row.tag) != "table-row":
                    continue
                cells = [
                    " ".join("".join(cell.itertext()).split())
                    for cell in row
                    if _local_name(cell.tag) in ("table-cell", "covered-table-cell")
                ]
                if any(cells):
                    rows.append(cells)
            table = _markdown_table(rows)
            if table:
                blocks.append(table)
        else:
            blocks.extend(_odf_blocks(child))
    return blocks


# --------------------------------------------------------- SVG and media files


def _extract_svg(path: Path, document_type: str) -> str:
    """The visible text of an SVG — its labels, tags and titles.

    Nothing offline can rasterize an SVG, so it is indexed as text rather than
    as a picture: shapes and attributes carry no text and are dropped, but the
    tag numbers and callouts a drawing is labelled with are exactly what a
    reader searches for.
    """
    try:
        root = ElementTree.parse(path).getroot()
    except (ElementTree.ParseError, OSError, ValueError):
        return _read_text(path)
    lines = [" ".join(part.split()) for part in root.itertext()]
    return "\n".join(line for line in lines if line)


@dataclass(frozen=True)
class EmbeddedMedia:
    """One raster image carried inside a container document."""

    suffix: str
    data: bytes
    page: Optional[int]


_MEDIA_NUMBER_RE = re.compile(r"(\d+)")
_PPTX_SLIDE_RELS_RE = re.compile(r"^ppt/slides/_rels/slide(\d+)\.xml\.rels$")


def extract_embedded_media(path: Path, document_type: str) -> list[EmbeddedMedia]:
    """The embeddable raster images inside a container document.

    A Word/Excel/PowerPoint/OpenDocument file is a zip, and a picture pasted
    into one is a plain raster under ``word|xl|ppt/media/`` (or ODF's
    ``Pictures/``). Those are what a reader can also use as a figure, so they
    are lifted out — in container order, capped in count and per-image size,
    with the slide a PowerPoint picture sits on recorded so its text can be
    attributed to that slide rather than to the deck as a whole.
    """
    prefix = _MEDIA_PREFIX_BY_TYPE.get((document_type or "").lower())
    if prefix is None:
        return []
    found: list[EmbeddedMedia] = []
    with _checked_zip(path) as archive:
        pages = _pptx_media_pages(archive) if prefix.startswith("ppt/") else {}
        names = sorted(
            (name for name in archive.namelist() if name.startswith(prefix)),
            key=lambda name: (
                int(match.group(1)) if (match := _MEDIA_NUMBER_RE.search(Path(name).stem)) else 0,
                name,
            ),
        )
        for name in names:
            suffix = Path(name).suffix.lower()
            if suffix.lstrip(".") not in IMAGE_DOCUMENT_TYPES:
                continue
            try:
                if archive.getinfo(name).file_size > _MAX_EMBEDDED_IMAGE_BYTES:
                    continue
                data = archive.read(name)
            except (KeyError, OSError, zipfile.BadZipFile):
                continue
            found.append(
                EmbeddedMedia(
                    suffix=suffix,
                    data=data,
                    page=pages.get(posixpath.basename(name)),
                )
            )
            if len(found) >= _MAX_EMBEDDED_IMAGES:
                break
    return found


def _pptx_media_pages(archive: zipfile.ZipFile) -> dict[str, Optional[int]]:
    """Map each media part's basename to the slide that first references it.

    A picture placed on several slides (a logo in a master) keeps the first
    slide it appears on, which is enough to attribute its text; the alternative
    — crediting it to no slide at all — would lose the attribution entirely.
    """
    mapping: dict[str, Optional[int]] = {}
    for name in archive.namelist():
        match = _PPTX_SLIDE_RELS_RE.match(name)
        if not match:
            continue
        slide = int(match.group(1))
        try:
            targets = _relationships(archive.read(name)).values()
        except (KeyError, OSError, zipfile.BadZipFile):
            continue
        for target in targets:
            mapping.setdefault(posixpath.basename(target), slide)
    return mapping


# ---------------------------------------------------------------- family maps


def embedded_image_ids(document) -> list[str]:
    """The doc_ids of the image documents lifted out of this container.

    The picture documents a container upload creates are recorded on the
    container's own metadata, because the container is the only handle a caller
    has on them afterwards.
    """
    entries = (document.metadata or {}).get(EMBEDDED_IMAGES_KEY) or []
    ids: list[str] = []
    for entry in entries:
        document_id = entry.get("doc_id") if isinstance(entry, dict) else entry
        if isinstance(document_id, str) and document_id and document_id not in ids:
            ids.append(document_id)
    return ids

def _family_by_type() -> dict[str, str]:
    mapping = {"pdf": "pdf"}
    for family, types in (
        ("image", IMAGE_DOCUMENT_TYPES),
        ("plain", _PLAIN_TYPES),
        ("csv", _CSV_TYPES),
        ("json", _JSON_TYPES),
        ("yaml", _YAML_TYPES),
        ("xml", _XML_TYPES),
        ("html", _HTML_TYPES),
        ("rtf", _RTF_TYPES),
        ("docx", _DOCX_TYPES),
        ("xlsx", _XLSX_TYPES),
        ("pptx", _PPTX_TYPES),
        ("odf", _ODF_TYPES),
        ("svg", _SVG_TYPES),
    ):
        for extension in types:
            mapping[extension] = family
    return mapping


_FAMILY_BY_TYPE = _family_by_type()

_EXTRACTORS = {
    "plain": _extract_plain,
    "csv": _extract_delimited,
    "json": _extract_json,
    "yaml": _extract_yaml,
    "xml": _extract_xml,
    "html": _extract_html,
    "rtf": _extract_rtf,
    "docx": _extract_docx,
    "xlsx": _extract_xlsx,
    "odf": _extract_odf,
    "svg": _extract_svg,
}


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
