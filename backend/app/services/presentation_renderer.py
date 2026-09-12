"""Local PPTX rendering + validation for the presentation_generation tool.

Two renderer implementations share one interface:

- ``NodePresentationRenderer`` shells out to the local PptxGenJS script
  (``presentation/src/render.cjs``). Fully offline; the node process only
  receives a workspace-scoped JSON input path and a workspace-scoped output
  path.
- ``FakePresentationRenderer`` writes a deterministic, structurally valid
  minimal PPTX (used in tests; no Node dependency).

Validation always runs after a write: file exists, non-zero, is a ZIP/OpenXML
package, has ``[Content_Types].xml`` + ``ppt/presentation.xml``, and contains at
least the expected number of slide parts (a renderer may add layout, divider, or
template slides; it must never drop content slides).
"""

import json
import logging
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Union

from app.schemas.presentation import PresentationContent
from app.services.ooxml import normalize_ooxml

logger = logging.getLogger("app.presentation_renderer")


class PresentationRenderError(Exception):
    """Rendering or validation of the presentation failed."""


@dataclass
class GeneratedPresentation:
    path: Path
    size_bytes: int
    slide_count: int


def _slide_part_count(package: zipfile.ZipFile) -> int:
    return sum(
        1
        for name in package.namelist()
        if name.startswith("ppt/slides/slide") and name.endswith(".xml")
    )


def validate_pptx(path: Path, expected_slides: int) -> int:
    """Validate a PPTX package; returns the number of slide parts found.

    A renderer may legitimately emit more slide parts than the content model
    declared (layout/divider/template slides), so the check is "at least the
    expected number" — content slides must never be silently dropped.
    """
    if not path.exists():
        raise PresentationRenderError("presentation file was not created")
    if path.stat().st_size == 0:
        raise PresentationRenderError("presentation file is empty")
    try:
        with zipfile.ZipFile(path) as package:
            names = package.namelist()
            if package.testzip() is not None:
                raise PresentationRenderError("presentation package is corrupted")
            if "[Content_Types].xml" not in names:
                raise PresentationRenderError("presentation has no [Content_Types].xml")
            if "ppt/presentation.xml" not in names:
                raise PresentationRenderError("presentation has no ppt/presentation.xml")
            slides = _slide_part_count(package)
    except (OSError, zipfile.BadZipFile) as exc:
        raise PresentationRenderError(f"presentation is not a valid zip/OpenXML package: {exc}") from exc
    if slides < expected_slides:
        raise PresentationRenderError(
            f"expected at least {expected_slides} slides but found {slides} slide parts"
        )
    return slides


class NodePresentationRenderer:
    """Render via the local PptxGenJS node script (offline)."""

    def __init__(
        self,
        node_command: str = "node",
        script_path: Optional[Union[str, Path]] = None,
        timeout_seconds: float = 90.0,
    ) -> None:
        self._node = node_command
        self._script = str(script_path or Path(__file__).resolve().parents[3] / "presentation" / "src" / "render.cjs")
        self._timeout = timeout_seconds

    def generate(
        self,
        content: PresentationContent,
        output_dir: Path,
        filename: str,
    ) -> GeneratedPresentation:
        if not Path(self._script).is_file():
            raise PresentationRenderError(
                "local presentation renderer is not installed "
                "(expected presentation/src/render.cjs); run `npm install` in presentation/"
            )
        output_dir.mkdir(parents=True, exist_ok=True)
        target = output_dir / filename
        try:
            # The render payload is document content and must never linger in the
            # artifacts directory if the process crashes mid-render.
            with tempfile.TemporaryDirectory(prefix="astra-render-") as tmp_dir:
                payload_path = Path(tmp_dir) / "content.json"
                payload_path.write_text(
                    json.dumps(content.model_dump(), ensure_ascii=False), encoding="utf-8"
                )
                proc = subprocess.run(
                    [
                        self._node,
                        self._script,
                        "--in",
                        str(payload_path),
                        "--out",
                        str(target),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=self._timeout,
                )
            if proc.returncode != 0:
                detail = (proc.stderr or "").strip()[-1500:]
                raise PresentationRenderError(
                    f"local renderer failed: {detail or 'unknown error'}"
                )
            slides = validate_pptx(target, len(content.slides))
            normalize_ooxml(target)
            return GeneratedPresentation(
                path=target,
                size_bytes=target.stat().st_size,
                slide_count=slides,
            )
        except subprocess.TimeoutExpired as exc:
            raise PresentationRenderError("local renderer timed out") from exc


class FakePresentationRenderer:
    """Deterministic minimal valid PPTX writer used by tests."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def generate(
        self,
        content: PresentationContent,
        output_dir: Path,
        filename: str,
    ) -> GeneratedPresentation:
        output_dir.mkdir(parents=True, exist_ok=True)
        target = output_dir / filename
        _write_minimal_pptx(target, len(content.slides))
        self.calls.append({"slides": len(content.slides), "target": str(target)})
        slides = validate_pptx(target, len(content.slides))
        return GeneratedPresentation(
            path=target,
            size_bytes=target.stat().st_size,
            slide_count=slides,
        )


def _write_minimal_pptx(target: Path, slide_count: int) -> None:
    """Write a tiny but structurally valid PPTX with ``slide_count`` slides."""
    slides_xml = []
    for i in range(1, slide_count + 1):
        slides_xml.append(
            f"""<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Slide {i}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>"""
        )
    overrides = "".join(
        f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for i in range(1, slide_count + 1)
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        + overrides
        + "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
        "</Relationships>"
    )
    sld_id_lst = "".join(f'<p:sldId id="{256 + i}" r:id="rId{i + 1}"/>' for i in range(1, slide_count + 1))
    slide_rels = "".join(
        f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
        for i in range(1, slide_count + 1)
    )
    presentation = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        f'<p:sldIdLst>{sld_id_lst}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/>'
        "</p:presentation>"
    )
    presentation_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + slide_rels
        + "</Relationships>"
    )
    parts: dict[str, bytes] = {
        "[Content_Types].xml": content_types.encode("utf-8"),
        "_rels/.rels": root_rels.encode("utf-8"),
        "ppt/presentation.xml": presentation.encode("utf-8"),
        "ppt/_rels/presentation.xml.rels": presentation_rels.encode("utf-8"),
    }
    for i in range(1, slide_count + 1):
        parts[f"ppt/slides/slide{i}.xml"] = slides_xml[i - 1].encode("utf-8")
    tmp = target.with_suffix(".tmp.pptx")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in parts.items():
            zf.writestr(name, data)
    shutil.move(str(tmp), str(target))
