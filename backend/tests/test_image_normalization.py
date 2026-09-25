"""In-memory image normalization: web-safe pass-through and PNG conversion."""

import base64
import io

import pytest
from PIL import Image

from app.services.image_normalization import (
    ImageNormalizationError,
    embed_source,
    is_web_safe,
    png_bytes,
    render_data_uri,
)
from tests.conftest import make_bmp, make_image_bytes, make_png


def test_web_safe_formats_are_detected(tmp_path):
    assert is_web_safe(tmp_path / "a.png")
    assert is_web_safe(tmp_path / "b.jpg")
    assert is_web_safe(tmp_path / "c.JPEG")
    assert not is_web_safe(tmp_path / "d.bmp")
    assert not is_web_safe(tmp_path / "e")


def test_embed_source_passes_a_web_safe_path_through(tmp_path):
    """The PNG/JPEG pipeline must stay byte-for-byte what it was: a str path."""
    picture = make_png(tmp_path / "crop.png", ["detail"])
    source = embed_source(picture)
    assert isinstance(source, str)
    assert source == str(picture)


def test_embed_source_converts_a_bmp_to_a_png_stream(tmp_path):
    picture = make_bmp(tmp_path / "crop.bmp")
    source = embed_source(picture)
    assert isinstance(source, io.BytesIO)
    with Image.open(source) as image:
        assert image.format == "PNG"


def test_png_bytes_reads_any_raster(tmp_path):
    picture = make_bmp(tmp_path / "crop.bmp", size=(64, 32))
    with Image.open(io.BytesIO(png_bytes(picture))) as image:
        assert image.size == (64, 32)


def test_png_bytes_is_deterministic(tmp_path):
    picture = make_bmp(tmp_path / "crop.bmp")
    assert png_bytes(picture) == png_bytes(picture)


def test_unreadable_image_raises_a_named_error(tmp_path):
    bogus = tmp_path / "bad.bmp"
    bogus.write_bytes(b"not an image at all")
    with pytest.raises(ImageNormalizationError, match="Cannot read image 'bad.bmp'"):
        png_bytes(bogus)


def test_render_data_uri_is_none_for_web_safe(tmp_path):
    picture = make_png(tmp_path / "crop.png", ["detail"])
    assert render_data_uri(picture) is None


def test_render_data_uri_carries_a_parseable_mime_prefix(tmp_path):
    """PptxGenJS parses the media extension out of the prefix, so a bare base64
    blob would be dropped silently."""
    picture = make_bmp(tmp_path / "crop.bmp")
    uri = render_data_uri(picture)
    assert uri.startswith("image/png;base64,")
    decoded = base64.b64decode(uri.split(",", 1)[1])
    assert decoded.startswith(b"\x89PNG")


def test_raw_bytes_are_never_web_safe():
    """Bytes carry no extension, so there is nothing to declare them safe."""
    assert not is_web_safe(make_image_bytes())


def test_png_bytes_accepts_raw_bytes():
    """A PDF page rendered for embedding arrives as bytes, not a path."""
    with Image.open(io.BytesIO(png_bytes(make_image_bytes(fmt="BMP")))) as image:
        assert image.format == "PNG"
        assert image.size == (140, 100)


def test_embed_source_wraps_bytes_in_a_png_stream():
    source = embed_source(make_image_bytes(fmt="BMP"))
    assert isinstance(source, io.BytesIO)
    with Image.open(source) as image:
        assert image.format == "PNG"


def test_render_data_uri_encodes_bytes():
    uri = render_data_uri(make_image_bytes(fmt="BMP"))
    assert uri.startswith("image/png;base64,")
    assert base64.b64decode(uri.split(",", 1)[1]).startswith(b"\x89PNG")


def test_unreadable_bytes_raise_a_named_error():
    with pytest.raises(ImageNormalizationError, match="Cannot read image 'embedded image'"):
        png_bytes(b"not an image at all")

