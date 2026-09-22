"""Structure-aware ingestion, phase 1: provenance through the seam.

What this pins down:

* an OCR region arrives as its own element, keeping its own bbox and
  confidence (``source="ocr"``) instead of being flattened into page text;
* a PDF text layer contributes ``None`` for both — a text layer exposes
  neither, and inventing them would be a lie the audit trail cannot afford;
* OCR is decided per page, so a mixed PDF keeps the typed pages it has and
  renders only the pages that need recognising;
* element ids are content-addressed and stable, and a v1 artifact (written
  before these fields existed) still loads;
* the whole path runs with the socket layer denied — no egress, proved by
  construction rather than asserted by policy.
"""

import asyncio
import json
import socket
from pathlib import Path

from app.schemas.extraction import ExtractionElement
from app.schemas.multimodal import OCRRegion
from app.services.document_preparer import page_number_from_path
from app.services.extraction_store import JsonExtractionStore
from app.services.extractor import DocumentExtractor, make_element_id
from app.services.ocr_provider import OCRProvider
from tests.conftest import make_blank_pdf, make_multimodal_stack

LOOPBACK = {"127.0.0.1", "::1", "localhost"}


def run(coro):
    return asyncio.run(coro)


class GeometryFakeOCR(OCRProvider):
    """Scripted OCR: one region per scripted line, each with its own geometry.

    ``FakeOCRProvider`` answers a page with a single region on a fixed bbox, so
    it cannot show that a region's *own* bbox and confidence survive the seam.
    This double scripts them per line. The existing fake is deliberately left
    alone — its callers depend on its exact output.
    """

    def __init__(self, pages: dict[int, list[tuple[str, list[int], float]]]) -> None:
        self._pages = dict(pages)
        self.calls: list[int] = []

    async def recognize(self, image_path: Path) -> list[OCRRegion]:
        page = page_number_from_path(Path(image_path))
        self.calls.append(page)
        return [
            OCRRegion(text=text, bbox=list(bbox), confidence=confidence)
            for text, bbox, confidence in self._pages.get(page, [])
        ]

    def describe(self) -> dict:
        return {"provider": "geometry-fake", "engine": "scripted-geometry"}


def make_mixed_page_pdf(path: Path) -> None:
    """Page 1 carries a real text layer; page 2 has none (as if it were scanned)."""
    from reportlab.pdfgen import canvas

    canvas_obj = canvas.Canvas(str(path))
    canvas_obj.drawString(72, 760, "Course C1 thickness 13.4 mm, typed page one")
    canvas_obj.showPage()
    canvas_obj.showPage()  # blank page, no text layer
    canvas_obj.save()


def upload_path(uploads: Path, filename: str) -> Path:
    path = uploads / "user-001" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


# ------------------------------------------------------------ element identity

def test_element_id_is_stable_and_content_addressed():
    base = make_element_id("sha", 1, "text", "Course C1  13.4", [10, 20, 200, 40])
    # Whitespace collapsing and sub-pixel bbox jitter are not identity: the same
    # region recognised twice must not mint two element ids.
    assert make_element_id("sha", 1, "text", "Course C1 13.4", [10.4, 20.0, 200.2, 40.0]) == base
    # Changing any one input does change identity.
    assert make_element_id("sha", 1, "text", "Course C1 13.5", [10, 20, 200, 40]) != base
    assert make_element_id("sha", 2, "text", "Course C1  13.4", [10, 20, 200, 40]) != base
    assert make_element_id("other", 1, "text", "Course C1  13.4", [10, 20, 200, 40]) != base


def test_from_elements_assigns_order_and_ids_without_mutating_the_caller():
    supplied = [
        ExtractionElement(
            type="text", page=1, text="first", source="ocr",
            bbox=[10, 20, 200, 40], confidence=0.97,
        ),
        ExtractionElement(type="text", page=1, text="second", source="ocr"),
    ]

    extraction = DocumentExtractor().from_elements(
        "doc-1", "scan.pdf", "pdf", supplied, document_sha256="sha"
    )

    assert extraction.schema_version == 2
    assert [element.order for element in extraction.elements] == [0, 1]
    assert all(element.element_id for element in extraction.elements)
    assert supplied[0].order is None and supplied[0].element_id is None
    # Two regions on one page render inside a single page section.
    assert extraction.markdown.count("## Page 1") == 1
    assert "first" in extraction.markdown and "second" in extraction.markdown


def test_v1_extraction_artifact_still_loads(tmp_path):
    root = tmp_path / "extractions"
    path = root / "user-001" / "doc-old.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "document_id": "doc-old",
                "filename": "old.pdf",
                "document_type": "pdf",
                "backend": "pypdf",
                "page_count": 1,
                "elements": [{"type": "text", "page": 1, "text": "legacy"}],
                "markdown": "legacy",
            }
        ),
        encoding="utf-8",
    )

    loaded = JsonExtractionStore(root).get("user-001", "doc-old")

    assert loaded is not None
    assert loaded.elements[0].text == "legacy"
    # The v2 provenance fields simply come back as their defaults.
    assert loaded.schema_version == 2
    for field in ("element_id", "order", "source", "bbox", "confidence"):
        assert getattr(loaded.elements[0], field) is None


# --------------------------------------------------------------- OCR provenance

def test_ocr_regions_keep_their_own_bbox_confidence_and_source(tmp_path):
    ocr = GeometryFakeOCR(
        {
            1: [
                ("Course C1 13.4", [10, 20, 200, 40], 0.97),
                ("Course C2 10.9", [10, 60, 200, 80], 0.91),
            ]
        }
    )
    store = JsonExtractionStore(tmp_path / "extractions")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, extraction_store=store
    )
    path = upload_path(uploads, "scan.pdf")
    make_blank_pdf(path, pages=1)

    doc = run(service.ingest_scanned("user-001", path, "scan.pdf"))
    assert doc.status == "ready"

    extraction = service.knowledge_base.get_extraction("user-001", doc.document_id)
    assert extraction is not None
    assert [element.text for element in extraction.elements] == [
        "Course C1 13.4",
        "Course C2 10.9",
    ]
    assert [element.source for element in extraction.elements] == ["ocr", "ocr"]
    assert [element.bbox for element in extraction.elements] == [
        [10, 20, 200, 40],
        [10, 60, 200, 80],
    ]
    assert [element.confidence for element in extraction.elements] == [0.97, 0.91]
    assert [element.order for element in extraction.elements] == [0, 1]


def test_page_text_layer_yields_no_bbox_and_no_confidence(tmp_path):
    store = JsonExtractionStore(tmp_path / "extractions")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, extraction_store=store
    )
    path = upload_path(uploads, "mixed.pdf")
    make_mixed_page_pdf(path)

    doc = run(service.ingest_pdf("user-001", path, "mixed.pdf"))
    assert doc.status == "ready"

    extraction = service.knowledge_base.get_extraction("user-001", doc.document_id)
    assert extraction is not None
    typed = [element for element in extraction.elements if element.page == 1]
    assert typed and typed[0].source == "text_layer"
    assert "Course C1 thickness 13.4 mm" in typed[0].text
    # A text layer exposes neither, so neither is invented.
    assert typed[0].bbox is None
    assert typed[0].confidence is None


# ------------------------------------------------------------ per-page routing

def test_mixed_pdf_ocring_only_the_pages_with_no_text_layer(tmp_path):
    ocr = GeometryFakeOCR({2: [("SCANNED PAGE TWO", [5, 6, 120, 26], 0.88)]})
    store = JsonExtractionStore(tmp_path / "extractions")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, extraction_store=store
    )
    path = upload_path(uploads, "mixed.pdf")
    make_mixed_page_pdf(path)

    doc = run(service.ingest_pdf("user-001", path, "mixed.pdf"))

    assert doc.status == "ready"
    # Only the page without a text layer was rendered and recognised.
    assert ocr.calls == [2]
    assert doc.metadata["page_count"] == 2
    # ``ocr`` keeps its document-level meaning ("no text layer at all") so the
    # vision path's whole-page decision is unchanged for a document like this.
    assert doc.metadata["ocr"] is False

    extraction = service.knowledge_base.get_extraction("user-001", doc.document_id)
    assert extraction is not None
    by_page: dict[int, list] = {}
    for element in extraction.elements:
        by_page.setdefault(element.page, []).append(element)
    assert [element.source for element in by_page[1]] == ["text_layer"]
    assert [element.source for element in by_page[2]] == ["ocr"]
    assert by_page[2][0].bbox == [5, 6, 120, 26]
    assert by_page[2][0].confidence == 0.88

    # Both pages' text is searchable, so the typed page was not lost to OCR.
    assert run(service.knowledge_base.search("user-001", "typed page one", 3))


def test_fully_scanned_pdf_still_routes_through_ocr(tmp_path):
    ocr = GeometryFakeOCR({1: [("PAGE ONE SCAN", [1, 2, 30, 12], 0.75)]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    path = upload_path(uploads, "scan.pdf")
    make_blank_pdf(path, pages=1)

    doc = run(service.ingest_pdf("user-001", path, "scan.pdf"))

    assert doc.status == "ready"
    assert ocr.calls == [1]
    assert doc.metadata["ocr"] is True


def test_unreadable_pdf_fails_cleanly_through_the_router(tmp_path):
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path)
    path = upload_path(uploads, "broken.pdf")
    path.write_bytes(b"not a real pdf")

    doc = run(service.ingest_pdf("user-001", path, "broken.pdf"))

    assert doc.status == "failed"


# ------------------------------------------------------------------- egress

def test_ingestion_makes_no_external_connection(tmp_path, monkeypatch):
    """The new path is local-only, proved rather than promised.

    External sockets are denied for the duration of the ingestion: a future
    change that quietly adds an upload, a telemetry ping, or a model download
    fails here instead of in the field. Loopback is allowed because the event
    loop's own self-pipe is a loopback socket pair on Windows — machinery, not
    egress.
    """
    ocr = GeometryFakeOCR({2: [("SCANNED PAGE TWO", [5, 6, 120, 26], 0.88)]})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    path = upload_path(uploads, "mixed.pdf")
    make_mixed_page_pdf(path)

    # Built before the socket is patched: the self-pipe pair is created here.
    loop = asyncio.new_event_loop()
    blocked: list = []

    real_connect = socket.socket.connect
    real_create = socket.create_connection

    def deny(address):
        # A non-tuple address is an AF_UNIX path, which is local by
        # construction; a TCP address is external unless it names loopback.
        if not isinstance(address, tuple):
            return
        if address[0] not in LOOPBACK:
            blocked.append(address)
            raise AssertionError(f"external connection attempted: {address!r}")

    def guarded_connect(self, address, *args, **kwargs):
        deny(address)
        return real_connect(self, address, *args, **kwargs)

    def guarded_create(address, *args, **kwargs):
        deny(address)
        return real_create(address, *args, **kwargs)

    monkeypatch.setattr(socket.socket, "connect", guarded_connect)
    monkeypatch.setattr(socket.socket, "connect_ex", guarded_connect)
    monkeypatch.setattr(socket, "create_connection", guarded_create)
    try:
        doc = loop.run_until_complete(service.ingest_pdf("user-001", path, "mixed.pdf"))
    finally:
        loop.close()

    assert doc.status == "ready"
    assert blocked == []
