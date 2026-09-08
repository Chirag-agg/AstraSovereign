"""OCR provider tests: abstraction, deterministic fake, real RapidOCR engine."""

import asyncio

import pytest

from app.services.ocr_provider import FakeOCRProvider, OCRProviderError, RapidOCREngine
from tests.conftest import make_png


def run(coro):
    return asyncio.run(coro)


def test_fake_ocr_returns_scripted_text_with_metadata(tmp_path):
    img = tmp_path / "page_0001.png"
    img.write_bytes(b"x")
    provider = FakeOCRProvider(page_text={1: "INSPECTION DATE: 2026-08-15\nSeal leakage 3 ml/hr"})
    regions = run(provider.recognize(img))
    assert len(regions) == 1
    region = regions[0]
    assert "INSPECTION DATE" in region.text
    assert region.bbox == [0, 0, 10, 10]
    assert region.confidence == 0.99


def test_fake_ocr_blank_page_produces_no_text(tmp_path):
    img = tmp_path / "page_0002.png"
    img.write_bytes(b"x")
    assert run(FakeOCRProvider().recognize(img)) == []


def test_fake_ocr_engine_failure_raises(tmp_path):
    img = tmp_path / "page_0001.png"
    img.write_bytes(b"x")
    provider = FakeOCRProvider(fail_pages={1})
    with pytest.raises(OCRProviderError):
        run(provider.recognize(img))


def test_fake_ocr_describe(tmp_path):
    assert FakeOCRProvider().describe()["provider"] == "fake"
    assert RapidOCREngine().describe()["provider"] == "rapidocr"


@pytest.mark.rapidocr
def test_real_rapidocr_extracts_text_and_metadata(tmp_path):
    img = make_png(tmp_path / "page_0001.png", ["Pump seal leakage 3 ml/hr", "Vibration 2.1 mm/s"])
    provider = RapidOCREngine()
    regions = run(provider.recognize(img))
    text = " ".join(r.text for r in regions).lower()
    assert "seal" in text
    assert "vibration" in text
    assert all(r.bbox for r in regions)
    assert all(r.confidence is not None for r in regions)
