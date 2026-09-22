"""Structure-aware ingestion: provenance through the seam, and loud loss.

What this pins down:

* an OCR region arrives as its own element, keeping its own bbox and
  confidence (``source="ocr"``) instead of being flattened into page text;
* a PDF text layer contributes ``None`` for both — a text layer exposes
  neither, and inventing them would be a lie the audit trail cannot afford;
* OCR is decided per page, so a mixed PDF keeps the typed pages it has and
  renders only the pages that need recognising;
* a page-scale raster carrying only a stamp ("Page 3") is a scan, not a typed
  page, and is recognised rather than indexed as its stamp;
* a page that was routed to OCR and yielded nothing is named — in the audit
  chain, in the document's status, and in the text every reader sees — so it
  cannot be mistaken for a page that was read and found empty;
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
from app.services.document_ingestion import page_requires_ocr
from app.services.document_preparer import page_number_from_path
from app.services.extractor import DocumentExtractor, make_element_id, unreadable_pages_notice
from app.services.extraction_store import JsonExtractionStore
from app.services.log_context import set_job_context
from app.services.ocr_provider import OCRProvider
from app.services.tools import DocumentExactSearchTool, DocumentSearchTool, ReadDocumentTool
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


def make_raster_page_with_stamp_pdf(path: Path, stamp: str = "Page 3") -> None:
    """A page-scale raster with a small text layer stamped over it.

    The shape that used to lose its content silently: the raster carries the
    real report, the text layer carries only a stamp, and the stamp is not
    what the page says. The raster is A4 at 150 dpi on an A4 page, so it is
    page-scale by pixel area — the same measurement on a real scan.
    """
    from PIL import Image
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    image = Image.new("RGB", (1240, 1754), color=(250, 250, 250))
    canvas_obj = canvas.Canvas(str(path))
    canvas_obj.drawImage(ImageReader(image), 0, 0, width=595, height=842)
    canvas_obj.drawString(72, 800, stamp)
    canvas_obj.showPage()
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
    # Page 2 is routed to OCR and the default fake recognises nothing there, so
    # the document is partial — that page's content is absent, and saying so is
    # the point of the status. Page 1's provenance is what this test is about.
    assert doc.status == "partial"

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


# ------------------------------------------------------------- scan detection

def test_page_requires_ocr_rules():
    """A raster page is judged by its stamp; a typed page by its text."""
    # No text layer at all: recognised, raster or not.
    assert page_requires_ocr("", False, 64) is True
    assert page_requires_ocr("", True, 64) is True
    # A typed page keeps its text layer however short it is — there is no
    # raster to recognise, so a one-line page is not a reason to run OCR.
    assert page_requires_ocr("Page 3", False, 64) is False
    assert page_requires_ocr("Course 1 thickness 13.4 mm", False, 64) is False
    # The same stamp over a page-scale raster is the case this rule exists
    # for: the visible content is the raster, and the stamp is not the page.
    assert page_requires_ocr("Page 3", True, 64) is True
    assert page_requires_ocr("x" * 63, True, 64) is True
    # Enough text to be the page's real content: the text layer wins.
    assert page_requires_ocr("x" * 64, True, 64) is False


def test_raster_page_carrying_only_a_stamp_is_routed_to_ocr(tmp_path):
    """A scanned page with a stamped header is recognised, not read as the stamp."""
    ocr = GeometryFakeOCR({1: [("Course C1 13.4 mm", [10, 20, 200, 40], 0.97)]})
    store = JsonExtractionStore(tmp_path / "extractions")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, extraction_store=store
    )
    path = upload_path(uploads, "stamped_scan.pdf")
    make_raster_page_with_stamp_pdf(path, stamp="Page 3")

    doc = run(service.ingest_pdf("user-001", path, "stamped_scan.pdf"))

    assert doc.status == "ready"
    assert ocr.calls == [1]
    extraction = service.knowledge_base.get_extraction("user-001", doc.document_id)
    assert [element.text for element in extraction.elements] == ["Course C1 13.4 mm"]
    assert [element.source for element in extraction.elements] == ["ocr"]
    # The stamp is nowhere in the indexed text or the artifact: it was the
    # page's furniture, not the page's content.
    assert "Page 3" not in extraction.markdown
    indexed = run(service.knowledge_base.search("user-001", "Course C1 13.4 mm", 3))
    assert indexed
    assert "Course C1 13.4 mm" in indexed[0].text
    assert "Page 3" not in indexed[0].text


def test_upload_routes_a_raster_stamp_page_through_the_api(
    tmp_path, client_factory, success_ollama_handler
):
    """The upload endpoint routes it too — the fix is on every entry point."""
    ocr = GeometryFakeOCR({1: [("Course C1 13.4 mm", [10, 20, 200, 40], 0.97)]})
    path = tmp_path / "stamped_scan.pdf"
    make_raster_page_with_stamp_pdf(path)

    with client_factory(success_ollama_handler, ocr_provider=ocr) as client:
        response = client.post(
            "/api/documents",
            files={"file": ("stamped_scan.pdf", path.read_bytes(), "application/pdf")},
            headers={"X-User-ID": "user-001"},
        )

    assert response.status_code == 201
    assert response.json()["status"] == "ready"
    assert ocr.calls == [1]


# ------------------------------------------------------------- page loss

def _ingest_with_a_lost_page(tmp_path):
    """A mixed PDF whose one OCR page (page 2) recognises nothing.

    Returns ``(service, store, doc)`` for the partially-read document.
    """
    ocr = GeometryFakeOCR({})  # every page comes back with no regions
    store = JsonExtractionStore(tmp_path / "extractions")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, extraction_store=store
    )
    path = upload_path(uploads, "mixed.pdf")
    make_mixed_page_pdf(path)
    doc = run(service.ingest_pdf("user-001", path, "mixed.pdf"))
    return service, store, doc


def test_unreadable_page_marks_the_document_partial_and_names_the_page(tmp_path):
    service, _store, doc = _ingest_with_a_lost_page(tmp_path)

    # The document is still indexed and searchable — it is the only evidence
    # there is for the page that *was* read — but it does not read as complete.
    assert doc.status == "partial"
    assert doc.metadata["unreadable_pages"] == [2]

    extraction = service.knowledge_base.get_extraction("user-001", doc.document_id)
    assert extraction.unreadable_pages == [2]
    assert extraction.markdown.startswith(
        "WARNING: pages 2 of this document could not be read"
    )
    # The readable page is still there, under the warning.
    assert "typed page one" in extraction.markdown
    assert run(service.knowledge_base.search("user-001", "typed page one", 3))


def test_unreadable_pages_are_audited_against_the_document(tmp_path):
    from app.services.audit_store import (
        SqliteAuditStore,
        ensure_audit_handler,
        get_audit_store,
        set_audit_store,
    )

    ocr = GeometryFakeOCR({})
    service, _scheduler, uploads, _tmp = make_multimodal_stack(tmp_path, ocr=ocr)
    path = upload_path(uploads, "mixed.pdf")
    make_mixed_page_pdf(path)

    ensure_audit_handler()
    set_audit_store(SqliteAuditStore(str(tmp_path / "audit.db")))
    try:
        doc = run(service.ingest_pdf("user-001", path, "mixed.pdf"))
        events = get_audit_store().list(user_id="user-001")
    finally:
        set_audit_store(SqliteAuditStore())

    loss = [event for event in events if event.event_type == "DOCUMENT_PAGES_UNREADABLE"]
    assert len(loss) == 1
    assert loss[0].metadata["document_id"] == doc.document_id
    assert loss[0].metadata["file_name"] == "mixed.pdf"
    assert loss[0].metadata["pages"] == "2"
    assert loss[0].status == "partial"


def test_read_document_leads_with_the_unreadable_pages_warning(tmp_path):
    _service, store, doc = _ingest_with_a_lost_page(tmp_path)
    set_job_context(user_id="user-001", job_id="job-loss")

    result = run(
        ReadDocumentTool(store).execute(Path("."), {"document_id": doc.document_id})
    )

    assert result.ok
    assert result.content.startswith(
        "WARNING: pages 2 of this document could not be read"
    )


def test_document_search_warns_on_results_from_a_partial_document(tmp_path):
    service, _store, _doc = _ingest_with_a_lost_page(tmp_path)
    set_job_context(user_id="user-001", job_id="job-search")

    result = run(
        DocumentSearchTool(service.knowledge_base).execute(
            Path("."), {"query": "typed page one"}
        )
    )

    assert result.ok
    assert "typed page one" in result.content
    assert unreadable_pages_notice([2]) in result.content


def test_exact_search_still_finds_a_partial_document_and_flags_it(tmp_path):
    """A partially-read document must not vanish from the exact-match path."""
    service, store, _doc = _ingest_with_a_lost_page(tmp_path)
    set_job_context(user_id="user-001", job_id="job-exact")

    result = run(
        DocumentExactSearchTool(service.knowledge_base, store).execute(
            Path("."), {"pattern": "typed page one"}
        )
    )

    assert result.ok
    assert "typed page one" in result.content
    assert unreadable_pages_notice([2]) in result.content


TABLE_PAGE_REGIONS: dict[int, list[tuple[str, list[int], float]]] = {
    1: [
        ("Course", [100, 100, 160, 140], 0.90),
        ("Thickness (mm)", [400, 100, 500, 140], 0.90),
        ("Remarks", [700, 100, 780, 140], 0.90),
        ("C1", [100, 160, 160, 200], 0.90),
        ("13.4", [400, 160, 470, 200], 0.90),
        ("C2", [100, 220, 160, 260], 0.90),
        ("10.9", [400, 220, 470, 260], 0.90),
        ("C3", [100, 280, 160, 320], 0.90),
        ("11.2", [400, 280, 470, 320], 0.90),
        ("C4", [100, 340, 160, 380], 0.90),
        ("12.8", [400, 340, 470, 380], 0.90),
    ]
}


def _ingest_a_table_page(root: Path, monkeypatch, *, reconstruct: bool):
    """Ingest one table-shaped scan; return (indexed chunk texts, extraction)."""
    from app.services import extractor as extractor_module
    from app.services.vector_store import JsonVectorStore

    captured: list[list[str]] = []
    real_upsert = JsonVectorStore.upsert_chunks

    async def spy(self, user_id, chunks):
        captured.append([chunk.text for chunk in chunks])
        return await real_upsert(self, user_id, chunks)

    monkeypatch.setattr(JsonVectorStore, "upsert_chunks", spy)
    if not reconstruct:
        monkeypatch.setattr(
            extractor_module, "reconstruct_tables", lambda elements: ([], list(elements))
        )

    store = JsonExtractionStore(Path(root) / "extractions")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        Path(root), ocr=GeometryFakeOCR(TABLE_PAGE_REGIONS), extraction_store=store
    )
    path = upload_path(uploads, "scan.pdf")
    make_blank_pdf(path, pages=1)

    doc = run(service.ingest_scanned("user-001", path, "scan.pdf"))
    extraction = service.knowledge_base.get_extraction("user-001", doc.document_id)
    return captured[-1], extraction


def test_indexed_chunk_text_is_unchanged_by_table_reconstruction(tmp_path, monkeypatch):
    """The table is a second reading of the same regions, not a new source.

    Chunks are cut from the page texts the OCR pass produced; the reconstruction
    is written to the extraction artifact ``read_document`` serves. This pins
    that separation. If reconstruction ever starts feeding the index, a change
    to how a document is *displayed* would silently change what it *matches*.
    """
    rebuilt, with_table = _ingest_a_table_page(
        tmp_path / "with", monkeypatch, reconstruct=True
    )
    plain, without_table = _ingest_a_table_page(
        tmp_path / "without", monkeypatch, reconstruct=False
    )

    # The two runs differ in the artifact — which is the point of the pair.
    assert [element for element in with_table.elements if element.type == "table"]
    assert not [element for element in without_table.elements if element.type == "table"]
    assert with_table.markdown != without_table.markdown
    # ...and not in a single character of what was indexed.
    assert rebuilt and rebuilt == plain


def test_a_document_with_no_lost_pages_carries_no_warning(tmp_path):
    """The warning is about a fact, not a decoration on every document."""
    ocr = GeometryFakeOCR({2: [("SCANNED PAGE TWO", [5, 6, 120, 26], 0.88)]})
    store = JsonExtractionStore(tmp_path / "extractions")
    service, _scheduler, uploads, _tmp = make_multimodal_stack(
        tmp_path, ocr=ocr, extraction_store=store
    )
    path = upload_path(uploads, "mixed.pdf")
    make_mixed_page_pdf(path)

    doc = run(service.ingest_pdf("user-001", path, "mixed.pdf"))

    assert doc.status == "ready"
    assert "unreadable_pages" not in doc.metadata
    extraction = service.knowledge_base.get_extraction("user-001", doc.document_id)
    assert extraction.unreadable_pages == []
    assert "WARNING" not in extraction.markdown

    set_job_context(user_id="user-001", job_id="job-clean")
    result = run(
        DocumentSearchTool(service.knowledge_base).execute(
            Path("."), {"query": "typed page one"}
        )
    )
    assert "WARNING" not in result.content
