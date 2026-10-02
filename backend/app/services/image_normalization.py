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

# Maximum pixels on the long edge before downscaling. A 4 MP scan at 1600px
# long edge produces a ~600 KB PNG; without the cap the same source encoded
# verbatim would embed as a 40 MB blob and bloat every deck that carries it.
PPTX_LONG_EDGE_MAX = 1600

# The only formats PptxGenJS will accept in the ``data:`` payload after we
# re-encode. JPEG gives smaller files for photographic scans; PNG is lossless
# and preferred for everything else (line art, tables, schematics).
_PPTX_ACCEPTED_FORMATS = {"PNG", "JPEG"}

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


def cap_long_edge(image: Image.Image, max_px: int = PPTX_LONG_EDGE_MAX) -> Image.Image:
    """Return *image* downscaled so its longest side ≤ *max_px*, or the same
    object when it already fits.  Aspect ratio is preserved; upscaling is
    never done (an image smaller than the cap is returned unchanged).

    The downscale uses ``LANCZOS`` (the highest-quality Pillow resampling
    filter) so text in a P&ID crop or a scanned table remains legible.
    """
    w, h = image.size
    long_side = max(w, h)
    if long_side <= max_px:
        return image
    scale = max_px / long_side
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    return image.resize((new_w, new_h), Image.LANCZOS)


def normalize_for_pptx(
    source: ImageSource,
    max_long_edge: int = PPTX_LONG_EDGE_MAX,
) -> bytes:
    """Read any Pillow-readable raster, cap it, and return PNG bytes.

    The returned bytes are always PNG (never JPEG, BMP, TIFF, etc.) so the
    caller can build a ``image/png;base64,…`` data URI with confidence.

    Raises :class:`ImageNormalizationError` when:
    - the source cannot be decoded by Pillow, or
    - the re-encoded image is not PNG or JPEG (i.e. Pillow could not round-trip
      through a web-safe format — an edge-case for exotic palette modes).
    """
    try:
        with _open(source) as opened:
            opened.load()
            image = opened.copy()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageNormalizationError(
            f"Cannot read image '{_name(source)}': {exc}"
        ) from exc

    # Downscale before re-encoding so the base64 blob stays manageable.
    image = cap_long_edge(image, max_long_edge)

    # Re-encode to PNG (lossless, always accepted by PptxGenJS).
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

    # Verify the round-trip produced an accepted format.
    buffer.seek(0)
    try:
        with Image.open(buffer) as check:
            fmt = (check.format or "").upper()
    except Exception as exc:  # pragma: no cover
        raise ImageNormalizationError(
            f"Re-encoded image '{_name(source)}' could not be verified: {exc}"
        ) from exc
    if fmt not in _PPTX_ACCEPTED_FORMATS:
        raise ImageNormalizationError(
            f"Re-encoded image '{_name(source)}' is '{fmt}'; "
            f"only PNG or JPEG are accepted for embedding"
        )
    buffer.seek(0)
    return buffer.read()


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


def render_data_uri_normalized(
    source: ImageSource,
    max_long_edge: int = PPTX_LONG_EDGE_MAX,
) -> str:
    """Normalize *source* for PPTX embedding and return the ``data:`` URI.

    Unlike :func:`render_data_uri` this always returns a string (never
    ``None``) and always caps the long edge, making it the single call-site
    for the presentation tool's image pipeline.  A web-safe path whose
    dimensions already fit the cap is still re-encoded via
    :func:`normalize_for_pptx` so the cap is enforced uniformly.
    """
    data = normalize_for_pptx(source, max_long_edge)
    encoded = base64.b64encode(data).decode("ascii")
    return f"image/png;base64,{encoded}"
