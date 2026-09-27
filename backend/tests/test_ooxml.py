"""OOXML normalisation: fixed timestamps, and a package whose
``[Content_Types].xml`` only declares parts that exist."""

import re
import zipfile
from pathlib import Path

from app.services.ooxml import FIXED_TIMESTAMP, normalize_ooxml

_CORE = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    "<cp:coreProperties>"
    '<dcterms:created xsi:type="dcterms:W3CDTF">2026-09-26T20:27:08Z</dcterms:created>'
    '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-09-26T20:27:08Z</dcterms:modified>'
    "</cp:coreProperties>"
)

_TYPES_HEAD = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
)
_TYPES_TAIL = "</Types>"


def _override(part: str) -> str:
    return f'<Override PartName="{part}" ContentType="application/xml"/>'


def _write_package(tmp_path: Path, content_types: str) -> Path:
    target = tmp_path / "sample.pptx"
    with zipfile.ZipFile(target, "w") as package:
        package.writestr("[Content_Types].xml", content_types)
        package.writestr("docProps/core.xml", _CORE)
        package.writestr("ppt/presentation.xml", "<p:presentation/>")
        package.writestr("ppt/slides/slide1.xml", "<p:sld/>")
        package.writestr("ppt/slides/slide2.xml", "<p:sld/>")
    return target


def test_overrides_for_parts_the_package_does_not_contain_are_dropped(tmp_path):
    """PptxGenJS 4.0.1 emits one ``slideMasterN.xml`` override per slide while
    writing a single master, so a two-slide deck declares master 2 and never
    produces it. PowerPoint tolerates the dangling declaration; stricter OOXML
    readers refuse the file."""
    content_types = (
        _TYPES_HEAD
        + _override("/ppt/presentation.xml")
        + _override("/ppt/slideMasters/slideMaster1.xml")
        + _override("/ppt/slideMasters/slideMaster2.xml")
        + _override("/ppt/slides/slide1.xml")
        + _override("/ppt/slides/slide2.xml")
        + _TYPES_TAIL
    )
    target = _write_package(tmp_path, content_types)

    normalize_ooxml(target)

    with zipfile.ZipFile(target) as package:
        text = package.read("[Content_Types].xml").decode("utf-8")
    assert "slideMaster" not in text
    # Every override naming a part that is actually present survives.
    for part in ("/ppt/presentation.xml", "/ppt/slides/slide1.xml", "/ppt/slides/slide2.xml"):
        assert f'PartName="{part}"' in text
    # Defaults are untouched.
    assert '<Default Extension="rels"' in text
    assert text.endswith(_TYPES_TAIL)


def test_a_consistent_package_keeps_every_override(tmp_path):
    content_types = (
        _TYPES_HEAD
        + _override("/ppt/presentation.xml")
        + _override("/ppt/slides/slide1.xml")
        + _override("/ppt/slides/slide2.xml")
        + _TYPES_TAIL
    )
    target = _write_package(tmp_path, content_types)

    normalize_ooxml(target)

    with zipfile.ZipFile(target) as package:
        text = package.read("[Content_Types].xml").decode("utf-8")
    assert text.count("<Override") == 3


def test_core_dates_are_pinned_to_the_fixed_timestamp(tmp_path):
    target = _write_package(tmp_path, _TYPES_HEAD + _TYPES_TAIL)

    normalize_ooxml(target)

    with zipfile.ZipFile(target) as package:
        core = package.read("docProps/core.xml").decode("utf-8")
    assert re.search(
        rf"<dcterms:created[^>]*>{FIXED_TIMESTAMP}</dcterms:created>", core
    )
    assert re.search(
        rf"<dcterms:modified[^>]*>{FIXED_TIMESTAMP}</dcterms:modified>", core
    )
