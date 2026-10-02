"""Multimodal service + document_vision tool tests.

Covers image ingestion, scanned-PDF detection/ingestion, the document_vision
tool, ownership isolation, temporary-image cleanup, OCR/vision failure handling,
resource-scheduling integration, log hygiene, and the health multimodal section.
"""

import asyncio
import logging
from pathlib import Path

import httpx
import pytest

from app.schemas.resources import ResourceRequirements
from app.services.log_context import set_job_context
from app.services.ocr_provider import FakeOCRProvider
from app.services.ollama_service import OllamaService
from app.services.tools import DocumentVisionTool, ToolError
from app.services.vision_provider import FakeVisionProvider, OllamaVisionProvider, VisionProviderError
from tests.conftest import (
    make_blank_pdf,
    make_multimodal_stack,
    make_ollama_handler,
    make_png,
)


def run(coro):
    return asyncio.run(coro)


def ingest_scan(service, uploads, user_id, filename="scan.pdf", page_count=2):
    path = uploads / user_id / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    make_blank_pdf(path, pages=page_count)
    return service.ingest_scanned(user_id, path, filename)


# ------------------------------------------------------------- ingestion

def test_image_ingestion_via_multimodal(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "Pump seal leakage 3 ml/hr"})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    img = uploads / "user-001" / "photo.png"
    img.parent.mkdir(parents=True, exist_ok=True)
    make_png(img, ["pump seal"])

    doc = run(service.ingest_scanned("user-001", img, "photo.png"))
    assert doc.status == "ready"
    assert doc.document_type == "png"
    assert doc.chunk_count >= 1
    assert doc.metadata.get("ocr") is True
    assert doc.metadata.get("page_count") == 1


def test_scanned_pdf_ingestion_indexes_ocr_text(tmp_path):
    ocr = FakeOCRProvider(
        page_text={1: "INSPECTION DATE 2026-08-15", 2: "SEAL REPLACEMENT RECOMMENDED"}
    )
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    doc = run(ingest_scan(service, uploads, "user-001"))
    assert doc.status == "ready"
    assert doc.document_type == "pdf"
    assert doc.chunk_count >= 1
    results = run(service.knowledge_base.search("user-001", "seal replacement", 3))
    assert results


def test_container_picture_is_recognised_into_the_container_page(tmp_path):
    """OCR of a container family: a picture inside a Word file is recognised and
    its text joins the page it sits on. No page is added, so the document's page
    numbering is unchanged, and the picture itself is registered as an image
    document so it can be embedded as a figure."""
    from app.services.document_ingestion import EMBEDDED_IMAGES_KEY
    from tests.conftest import make_docx, make_image_bytes

    ocr = FakeOCRProvider(page_text={1: "TAG-P204 seal leak 4 ml/hr"})
    service, _scheduler, _uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    docx = tmp_path / "report.docx"
    make_docx(docx, paragraphs=["Pump 204 inspection"], pictures=[make_image_bytes()])

    doc = run(service.ingest_container("user-001", docx, "report.docx"))
    assert doc.status == "ready"
    assert doc.metadata.get("page_count") == 1  # a figure does not add a page

    results = run(service.knowledge_base.search("user-001", "seal leak", 3))
    assert any("TAG-P204" in hit.text for hit in results), (
        "the figure's recognised text was not indexed"
    )

    children = doc.metadata.get(EMBEDDED_IMAGES_KEY) or []
    assert children and children[0]["doc_id"].startswith("doc-")
    child = run(service.knowledge_base.get_document("user-001", children[0]["doc_id"]))
    assert child is not None
    assert child.document_type == "png"
    assert child.chunk_count == 0  # its text lives on the container's page


def test_container_without_pictures_keeps_the_plain_path(tmp_path):
    from tests.conftest import make_docx

    service, _scheduler, _uploads, _tmp = make_multimodal_stack(tmp_path)
    docx = tmp_path / "plain.docx"
    make_docx(docx, paragraphs=["Pump 204 inspection complete."])

    doc = run(service.ingest_container("user-001", docx, "plain.docx"))
    assert doc.status == "ready"
    assert doc.chunk_count >= 1
    assert doc.metadata.get("embedded_images") is None


def test_blank_pdf_fails_with_requires_ocr(tmp_path):
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path)
    doc = run(ingest_scan(service, uploads, "user-001"))
    assert doc.status == "failed"
    assert "Document requires OCR" in doc.error


def test_scanned_pdf_detected_for_multimodal(tmp_path):
    from app.services.document_ingestion import (
        DocumentRequiresOCR,
        extract_document_pages,
    )

    scan = tmp_path / "scan.pdf"
    make_blank_pdf(scan, pages=1)
    with pytest.raises(DocumentRequiresOCR):
        extract_document_pages(scan, "pdf")


# --------------------------------------------------------- document_vision

def test_document_vision_tool_returns_structured_evidence(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "INSPECTION DATE: 2026-08-15", 2: "VIBRATION 2.1 mm/s"})
    vision = FakeVisionProvider(
        observations_by_page={
            1: ["Inspection date visible", "Handwritten note near seal"],
            2: ["Vibration reading visible"],
        }
    )
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-1")
    tool = DocumentVisionTool(service)

    result = run(
        tool.execute(Path("."), {"document_id": doc.document_id, "question": "What findings are visible?"})
    )
    assert result.ok
    assert "[PAGE 1]" in result.content
    assert "[PAGE 2]" in result.content
    assert "[OCR]" in result.content
    assert "[VISION]" in result.content
    assert "INSPECTION DATE" in result.content
    assert "Inspection date visible" in result.content
    assert "scan.pdf" in result.content
    assert doc.document_id in result.content


def test_document_vision_pages_filter(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "PAGE ONE CONTENT", 2: "PAGE TWO CONTENT"})
    vision = FakeVisionProvider(observations_by_page={1: ["obs1"], 2: ["obs2"]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-pages")
    tool = DocumentVisionTool(service)

    result = run(
        tool.execute(Path("."), {"document_id": doc.document_id, "pages": [1], "question": "q"})
    )
    assert "PAGE ONE CONTENT" in result.content
    assert "PAGE TWO CONTENT" not in result.content


# ------------------------------------------- embedded-image-only vision

def make_mixed_content_pdf(path):
    """Page 1: real typed text plus one embedded figure. Page 2: pure text,
    no figures at all — the realistic case (a report with one diagram, not
    a full scan) this feature targets."""
    from PIL import Image
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    image = Image.new("RGB", (200, 200), color=(200, 40, 40))
    c = canvas.Canvas(str(path))
    c.drawString(72, 760, "Inspection findings for Course 2, see figure below")
    c.drawImage(ImageReader(image), 72, 400, width=200, height=200)
    c.showPage()
    c.drawString(72, 760, "A pure-text page with no figures at all")
    c.showPage()
    c.save()


def test_vision_targets_the_embedded_figure_not_the_whole_page(tmp_path):
    """A text-based PDF page with one embedded figure should send vision
    just that figure, not the whole busy page render."""
    ocr = FakeOCRProvider(page_text={1: "Inspection findings for Course 2", 2: "A pure-text page"})
    vision = FakeVisionProvider(observations_by_page={1: ["Corrosion visible in the figure"]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    pdf_path = uploads / "user-001" / "mixed.pdf"
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    make_mixed_content_pdf(pdf_path)
    doc = run(service.knowledge_base.ingest_document("user-001", pdf_path, "mixed.pdf"))
    assert not doc.metadata.get("ocr")  # sanity: the text path, not ingest_scanned
    set_job_context(user_id="user-001", job_id="job-figure")

    result = run(service.analyze("user-001", doc.document_id, [1, 2], "What does the figure show?"))

    page_one, page_two = result.pages
    assert page_one.observations == ["[figure] Corrosion visible in the figure"]
    assert page_one.vision_model == "vision-model"
    # Vision only ran once, targeting page 1's embedded image — never page 2
    # (no figures) and never the whole-page render.
    assert len(vision.calls) == 1
    assert vision.calls[0]["page"] == 1

    assert page_two.observations == []
    assert page_two.vision_text == ""


def test_vision_skips_pure_text_pages_entirely(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "Inspection findings for Course 2", 2: "A pure-text page"})
    vision = FakeVisionProvider(observations_by_page={1: ["should never be seen"]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    pdf_path = uploads / "user-001" / "mixed.pdf"
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    make_mixed_content_pdf(pdf_path)
    doc = run(service.knowledge_base.ingest_document("user-001", pdf_path, "mixed.pdf"))
    set_job_context(user_id="user-001", job_id="job-textonly")

    result = run(service.analyze("user-001", doc.document_id, [2], "Anything visual here?"))

    assert result.pages[0].observations == []
    assert result.pages[0].ocr_text == "A pure-text page"
    assert vision.calls == []


def test_scanned_document_still_gets_whole_page_vision(tmp_path):
    """A genuinely scanned document (ingest_scanned, no extractable text
    layer) keeps the original whole-page-vision behavior unchanged — there
    is no separate typed-text portion to split the image from."""
    ocr = FakeOCRProvider(page_text={1: "scanned text"})
    vision = FakeVisionProvider(observations_by_page={1: ["whole page observation"]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    doc = run(ingest_scan(service, uploads, "user-001", page_count=1))
    assert doc.metadata.get("ocr") is True
    assert len(vision.calls) == 1
    assert "Describe this document page concisely" in vision.calls[0]["question"]
    set_job_context(user_id="user-001", job_id="job-scanned")

    result = run(service.analyze("user-001", doc.document_id, [1], "q"))

    assert "whole page observation" in result.pages[0].observations
    assert len(vision.calls) == 2
    assert vision.calls[1]["question"] == "q"


# ----------------------------------------------------- isolation & cleanup

def test_document_vision_ownership_isolation(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "secret pump data"})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-002", job_id="job-2")
    tool = DocumentVisionTool(service)

    with pytest.raises(ToolError, match="does not exist"):
        run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))


def test_document_vision_unknown_document(tmp_path):
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path)
    set_job_context(user_id="user-001", job_id="job-3")
    tool = DocumentVisionTool(service)
    with pytest.raises(ToolError, match="does not exist"):
        run(tool.execute(Path("."), {"document_id": "doc-nope", "question": "q"}))


def test_document_vision_requires_user_context(tmp_path):
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path)
    set_job_context()
    tool = DocumentVisionTool(service)
    with pytest.raises(ToolError, match="user context"):
        run(tool.execute(Path("."), {"document_id": "doc-x", "question": "q"}))


def test_temp_images_cleaned_after_success(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "text"})
    vision = FakeVisionProvider(observations_by_page={1: ["obs"]})
    service, _scheduler, uploads, tmproot = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-clean")
    tool = DocumentVisionTool(service)

    run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))
    assert list(tmproot.rglob("page_*.png")) == []
    assert not list(tmproot.iterdir())


def test_temp_images_cleaned_after_failure(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "text"})

    class BoomVision(FakeVisionProvider):
        async def analyze(self, image_path, question, ocr_text, model):
            raise VisionProviderError("vision exploded")

    service, _scheduler, uploads, tmproot = make_multimodal_stack(tmp_path, ocr=ocr, vision=BoomVision())
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-clean-fail")
    tool = DocumentVisionTool(service)

    with pytest.raises(ToolError, match="vision analysis failed"):
        run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))
    assert list(tmproot.rglob("page_*.png")) == []
    assert not list(tmproot.iterdir())


def test_cross_user_knowledge_isolation(tmp_path):
    ocr = FakeOCRProvider(page_text={1: "classified pump data"})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    run(ingest_scan(service, uploads, "user-001"))
    docs_b = run(service.knowledge_base.list_documents("user-002"))
    assert docs_b == []


# ----------------------------------------------------- failure handling

def test_ocr_failure_degrades_to_vision_only(tmp_path):
    ocr = FakeOCRProvider(page_text={2: "PAGE TWO TEXT"}, fail_pages={1})
    vision = FakeVisionProvider(observations_by_page={1: ["Observed from image"]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-degrade")
    tool = DocumentVisionTool(service)

    result = run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))
    assert result.ok
    assert "no text detected" in result.content
    assert "Observed from image" in result.content


def test_vision_disabled_fails_cleanly(tmp_path):
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, vision_enabled=False)
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-disabled")
    tool = DocumentVisionTool(service)
    with pytest.raises(ToolError, match="not configured or is disabled"):
        run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))


def test_vision_model_unavailable_fails_cleanly(tmp_path):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "test-model"}]})
        return httpx.Response(404, json={"error": "model not found"})

    ollama = OllamaService(
        base_url="http://ollama.test", default_model="x", transport=httpx.MockTransport(handler)
    )
    vision = OllamaVisionProvider(ollama)
    ocr = FakeOCRProvider(page_text={1: "text"})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, vision=vision, vision_model="ghost-model"
    )
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-ghost")
    tool = DocumentVisionTool(service)
    with pytest.raises(ToolError, match="vision analysis failed"):
        run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))


# -------------------------------------------------------- resource scheduling

def test_vision_resource_scheduling_grant_and_release(tmp_path):
    vision_resources = ResourceRequirements(gpu_vram_mb=4096, cpu_cores=2, memory_mb=2048)
    vision = FakeVisionProvider(observations_by_page={1: ["obs"]})
    ocr = FakeOCRProvider(page_text={1: "text"})
    service, scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, vision=vision, vision_resources=vision_resources
    )
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-res")
    tool = DocumentVisionTool(service)

    result = run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))
    assert result.ok
    stats = scheduler.stats()
    assert stats["running_jobs"] == 0
    assert scheduler.provider().allocated() == []


def test_vision_resource_rejection_fails_cleanly(tmp_path):
    vision_resources = ResourceRequirements(gpu_vram_mb=999999)
    ocr = FakeOCRProvider(page_text={1: "text"})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, vision=FakeVisionProvider(), vision_resources=vision_resources
    )
    doc = run(ingest_scan(service, uploads, "user-001"))
    set_job_context(user_id="user-001", job_id="job-reject")
    tool = DocumentVisionTool(service)
    with pytest.raises(ToolError, match="vision resources rejected"):
        run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))


# ------------------------------------------------------------ log hygiene

def test_no_image_or_ocr_contents_in_logs(tmp_path, caplog):
    ocr_marker = "SECRET-OCR-CONTENT-77"
    vision_marker = "SECRET-VISION-CONTENT-88"
    ocr = FakeOCRProvider(page_text={1: ocr_marker + " pump data"})
    vision = FakeVisionProvider(observations_by_page={1: [vision_marker + " observation"]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr, vision=vision)
    doc = run(ingest_scan(service, uploads, "user-001"))

    with caplog.at_level(logging.INFO, logger="app"):
        set_job_context(user_id="user-001", job_id="job-log")
        tool = DocumentVisionTool(service)
        run(tool.execute(Path("."), {"document_id": doc.document_id, "question": "q"}))

    record_text = " ".join(
        str(v) for r in caplog.records for v in r.__dict__.values()
        if not str(v).startswith("<") and "LogRecord" not in str(type(v))
    )
    assert ocr_marker not in record_text
    assert vision_marker not in record_text
    assert "ocr_started" in record_text
    assert "ocr_completed" in record_text
    assert "vision_started" in record_text
    assert "vision_completed" in record_text


# ---------------------------------------------------------------- health

def test_health_multimodal_section_ok(client_factory, test_models):
    models = dict(test_models)
    models["vision"] = {
        "provider": "ollama",
        "model": "vision-model",
        "enabled": True,
        "capabilities": ["vision", "image"],
    }
    with client_factory(
        make_ollama_handler({"test-model", "coder-model", "vision-model"}),
        models=models,
        vision_provider=FakeVisionProvider(),
    ) as c:
        health = c.get("/health").json()

    mm = health["multimodal"]
    assert mm["status"] == "ok"
    assert mm["ocr"]["enabled"] is True
    assert mm["ocr"]["provider"]["provider"] == "fake"
    assert mm["vision"]["model"] == "vision-model"
    assert mm["vision"]["enabled"] is True
    assert mm["vision"]["available"] is True


def test_health_multimodal_disabled(client_factory, test_models):
    with client_factory(make_ollama_handler({"test-model", "coder-model"})) as c:
        health = c.get("/health").json()
    mm = health["multimodal"]
    assert mm["status"] == "disabled"
    assert mm["vision"]["enabled"] is False
    assert mm["ocr"]["enabled"] is True
