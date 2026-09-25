"""In-memory normalization of non-web-safe images into PNG.

The deliverable generators take a file path or a stream. A PNG/JPEG source is
handed over untouched — the pipeline for those is byte-for-byte what it always
was — while the wider raster formats the ingestion layer now accepts (bmp, gif,
tiff, webp) are re-encoded to PNG bytes in memory. A source that is already
bytes (a PDF page rendered for embedding) is normalized the same way.

Nothing here touches the filesystem: a job's workspace is asserted to contain
only ``artifacts/``, so a converted image can never be staged as a temp file.

Pillow's PNG encoder writes no timestamp chunk, so a converted image is as
deterministic as the source it came from.
"""

import base64
import io
from pathlib import Path
from typing import Optional, Union

from PIL import Image, UnidentifiedImageError

WEB_SAFE_SUFFIXES = {".png", ".jpg", ".jpeg"}

# Modes Pillow can write to PNG without an explicit conversion.
_PNG_MODES = ("1", "L", "LA", "P", "RGB", "RGBA", "I", "I;16")

ImageSource = Union[str, Path, bytes]


class ImageNormalizationError(Exception):
    """An image could not be re-encoded for embedding."""


def _is_bytes(source: ImageSource) -> bool:
    return isinstance(source, (bytes, bytearray))


def _name(source: ImageSource) -> str:
    return "embedded image" if _is_bytes(source) else Path(source).name


def _open(source: ImageSource) -> Image.Image:
    if _is_bytes(source):
        return Image.open(io.BytesIO(source))
    return Image.open(source)


def is_web_safe(source: ImageSource) -> bool:
    """True when the format can be embedded as-is (no conversion needed).

    Raw bytes carry no extension to check, so they are always normalized.
    """
    if _is_bytes(source):
        return False
    return Path(source).suffix.lower() in WEB_SAFE_SUFFIXES


def png_bytes(source: ImageSource) -> bytes:
    """Read any Pillow-readable raster (a path or raw bytes) and return PNG."""
    try:
        with _open(source) as opened:
            opened.load()
            image = opened.copy()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageNormalizationError(
            f"Cannot read image '{_name(source)}': {exc}"
        ) from exc
    if image.mode not in _PNG_MODES:
        has_alpha = "A" in image.getbands()
        image = image.convert("RGBA" if has_alpha else "RGB")
    buffer = io.BytesIO()
    try:
        image.save(buffer, format="PNG")
    except (OSError, ValueError) as exc:
        raise ImageNormalizationError(
            f"Cannot convert image '{_name(source)}' to PNG: {exc}"
        ) from exc
    return buffer.getvalue()


def embed_source(source: ImageSource) -> Union[str, io.BytesIO]:
    """Return what a generator should be handed for this image.

    A web-safe source is returned as its path string, so the existing PNG/JPEG
    pipeline is unchanged (python-docx and openpyxl both close a path source
    they opened themselves). Anything else — a wider raster format, or a PDF
    page already rendered to bytes — becomes a stream of PNG bytes.
    """
    if not _is_bytes(source) and is_web_safe(source):
        return str(source)
    return io.BytesIO(png_bytes(source))


def render_data_uri(source: ImageSource) -> Optional[str]:
    """Return a ``data:`` payload for a non-web-safe image, else ``None``.

    The presentation renderer (PptxGenJS) reads an image either from ``path``
    or from ``data``; a web-safe path keeps using the path, so no existing
    presentation changes shape.
    """
    if not _is_bytes(source) and is_web_safe(source):
        return None
    encoded = base64.b64encode(png_bytes(source)).decode("ascii")
    # PptxGenJS parses the media extension out of ``image/(\w+);`` and rejects a
    # bare base64 blob, so the MIME prefix is load-bearing.
    return f"image/png;base64,{encoded}"
