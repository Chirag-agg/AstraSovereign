"""Deterministic OOXML post-processing shared by document generators/renderers.

python-docx, openpyxl and PptxGenJS all stamp current timestamps (zip entries
and/or ``docProps/core.xml``), which makes byte-identical inputs produce
different files. Normalising both gives reproducible deliverables.
"""

import io
import re
import zipfile
from pathlib import Path

FIXED_TIMESTAMP = "1980-01-01T00:00:00Z"


def normalize_ooxml(path: Path) -> None:
    """Rewrite an OOXML package with fixed entry timestamps and core dates."""
    fixed = (1980, 1, 1, 0, 0, 0)
    buffer = io.BytesIO()
    with zipfile.ZipFile(path, "r") as source:
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as target:
            for info in source.infolist():
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
                new_info = zipfile.ZipInfo(info.filename, date_time=fixed)
                new_info.compress_type = zipfile.ZIP_DEFLATED
                new_info.external_attr = info.external_attr
                target.writestr(new_info, data)
    path.write_bytes(buffer.getvalue())
