"""Real local OCR/vision integration tests (run only when the local engines
are available). Fully local — no external services.

- ``test_real_ocr_scanned_pdf_ingestion`` exercises the real RapidOCR engine
  end-to-end through the MultimodalService.
- ``test_real_vision_smoke`` runs the OllamaVisionProvider against a real local
  multimodal model when one is present (skipped otherwise).
"""

import asyncio
import shutil

import pytest

from app.services.ollama_service import OllamaService
from app.services.vision_provider import OllamaVisionProvider
from tests.conftest import make_image_pdf, make_multimodal_stack, make_png


def run(coro):
    return asyncio.run(coro)


def _ollama_vision_model():
    try:
        import httpx

        resp = httpx.get("http://localhost:11434/api/tags", timeout=3)
        resp.raise_for_status()
        names = [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        return None
    for name in names:
        lowered = name.lower()
        if "llava" in lowered or "vision" in lowered or "vl" in lowered:
            return name
    return None


@pytest.mark.rapidocr
def test_real_ocr_scanned_pdf_ingestion(tmp_path):
    from app.services.ocr_provider import RapidOCREngine

    img = make_png(tmp_path / "scan.png", ["Pump seal leakage 3 ml/hr", "Vibration 2.1 mm/s"])
    pdf = tmp_path / "scan.pdf"
    make_image_pdf(pdf, img, page_count=1)

    service, _scheduler, uploads, _tmproot = make_multimodal_stack(
        tmp_path, ocr=RapidOCREngine()
    )
    dest = uploads / "user-001" / "scan.pdf"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(pdf, dest)

    doc = run(service.ingest_scanned("user-001", dest, "scan.pdf"))
    assert doc.status == "ready", doc
    results = run(service.knowledge_base.search("user-001", "seal leakage", 3))
    assert results
    assert results[0].filename == "scan.pdf"


VISION_MODEL = _ollama_vision_model()


@pytest.mark.skipif(not VISION_MODEL, reason="no local vision model available on Ollama")
def test_real_vision_smoke(tmp_path):
    img = make_png(tmp_path / "page_0001.png", ["Pump seal leakage 3 ml/hr"])

    async def scenario():
        service = OllamaService(
            base_url="http://localhost:11434", default_model="unused", timeout_seconds=120
        )
        try:
            provider = OllamaVisionProvider(service)
            result = await provider.analyze(
                img, "What text or objects are visible?", "", VISION_MODEL
            )
            assert result.observations or result.text
        finally:
            await service.aclose()

    run(scenario())
