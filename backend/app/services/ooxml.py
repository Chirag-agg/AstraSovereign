"""Deterministic OOXML post-processing shared by document generators/renderers.

python-docx, openpyxl and PptxGenJS all stamp current timestamps (zip entries
and/or ``docProps/core.xml``), which makes byte-identical inputs produce
different files. Normalising both gives reproducible deliverables.

It also reconciles ``[Content_Types].xml`` with the parts actually in the
package, because PptxGenJS 4.0.1 declares one ``slideMasterN.xml`` override per
slide while writing only ``slideMaster1.xml`` (see ``_prune_missing_overrides``).
"""

import io
import re
import zipfile
from pathlib import Path
from typing import Match

FIXED_TIMESTAMP = "1980-01-01T00:00:00Z"

_OVERRIDE_RE = re.compile(r"<Override\b[^>]*/>", re.IGNORECASE)
_OVERRIDE_PARTNAME_RE = re.compile(r'PartName="([^"]+)"', re.IGNORECASE)


def _prune_missing_overrides(text: str, part_names: set[str]) -> str:
    """Drop content-type ``Override`` entries whose part is not in the package.

    OPC requires every ``Override`` to name a part that exists. PptxGenJS 4.0.1
    emits ``/ppt/slideMasters/slideMaster${idx+1}.xml`` per *slide* while writing
    a single master, so a 6-slide deck declares five masters it never produced.
    PowerPoint happens to tolerate the dangling declarations, but stricter OOXML
    consumers (LibreOffice, mobile viewers, most import pipelines) refuse or
    repair the file. The fix belongs here rather than in the renderer: this runs
    on every generated package, so it covers docx/xlsx and any future renderer.
    """
    def keep(match: Match[str]) -> str:
        part = _OVERRIDE_PARTNAME_RE.search(match.group(0))
        if part is None or part.group(1).lstrip("/") in part_names:
            return match.group(0)
        return ""

    return _OVERRIDE_RE.sub(keep, text)


def normalize_ooxml(path: Path) -> None:
    """Rewrite an OOXML package with fixed entry timestamps and core dates."""
    fixed = (1980, 1, 1, 0, 0, 0)
    buffer = io.BytesIO()
    with zipfile.ZipFile(path, "r") as source:
        infos = source.infolist()
        part_names = {i.filename for i in infos if not i.filename.endswith("/")}
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as target:
            for info in infos:
                data = source.read(info.filename)
                if info.filename == "docProps/core.xml":
                    text = data.decode("utf-8")
                    text = re.sub(
                        r"(<dcterms:created[^>]*>)[^<]*(</dcterms:created>)",
                        rf"\g<1>{FIXED_TIMESTAMP}\g<2>",
                        text,
                    )
                    text = re.sub(
                        r"(<dcterms:modified[^>]*>)[^<]*(</dcterms:modified>)",
                        rf"\g<1>{FIXED_TIMESTAMP}\g<2>",
                        text,
                    )
                    data = text.encode("utf-8")
                elif info.filename == "[Content_Types].xml":
                    text = _prune_missing_overrides(
                        data.decode("utf-8"), part_names
                    )
                    data = text.encode("utf-8")
                new_info = zipfile.ZipInfo(info.filename, date_time=fixed)
                new_info.compress_type = zipfile.ZIP_DEFLATED
                new_info.external_attr = info.external_attr
                target.writestr(new_info, data)
    path.write_bytes(buffer.getvalue())
