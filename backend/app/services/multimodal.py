"""Local multimodal pipeline: OCR + vision over images and scanned PDFs.

Runs entirely on-premise. Coordinates:

  document -> page preparation (render) -> OCR -> vision

and produces structured evidence the agent consumes through the
``document_vision`` tool. Also ingests scanned/image documents into the
knowledge base (the OCR text is embedded so ``document_search`` can find it
too). The vision model's declared resources flow through the existing
``ResourceScheduler`` — the scheduler is never bypassed.

Security: only metadata is logged. Image contents, OCR text, and full vision
responses are never logged.
"""

import hashlib
import logging
import shutil
import time
from pathlib import Path
from typing import Optional

from app.schemas.document import DocumentRecord, DocumentStatus
from app.schemas.extraction import ExtractionElement
from app.schemas.multimodal import (
    OCRPageResult,
    OCRRegion,
    PageEvidence,
    VisionAnalysisResult,
    VisionPageResult,
)
from app.schemas.resources import ResourceRequirements
from app.services.document_ingestion import (
    EMBEDDED_IMAGES_KEY,
    DocumentIngestionError,
    EmbeddedMedia,
    document_type_for,
    extract_document_pages,
    extract_embedded_media,
    extract_pdf_page_layouts,
    page_requires_ocr,
)
from app.services.document_preparer import DocumentPreparationError, DocumentPreparer, RenderedPage
from app.services.knowledge_base import KnowledgeBase
from app.services.log_context import get_job_context
from app.services.ocr_provider import OCRProvider, OCRProviderError
from app.services.resource_scheduler import ResourceScheduler
from app.services.vision_provider import VisionProvider, VisionProviderError
from app.services.workspace import WorkspaceManager

logger = logging.getLogger("app.multimodal")

MAX_OCR_TEXT_CHARS_PER_PAGE = 3000
# A page with more embedded images than this (rare - most report pages have
# 0 or 1 figures) is capped rather than making one vision call per image.
MAX_EMBEDDED_IMAGES_PER_PAGE = 3


def _remove_empty_ancestors(path: Path, root: Path) -> None:
    """Remove now-empty ancestor directories up to (not including) ``root``."""
    current = path
    while current != root and current.is_dir():
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def _merge_figure_text(
    pages: list[tuple[Optional[int], str]],
    additions: dict[Optional[int], list[str]],
) -> list[tuple[Optional[int], str]]:
    """Fold each figure's recognised text into the page it sits on.

    The text belongs to the page a reader would find the picture on, so it is
    appended there rather than becoming a page of its own. A figure no page
    could be attributed to (a master slide's logo, say) is credited to the
    document as a page-less block instead of being dropped.
    """
    remaining = {page: list(texts) for page, texts in additions.items()}
    merged: list[tuple[Optional[int], str]] = []
    for page, text in pages:
        extra = remaining.pop(page, None)
        if not extra:
            merged.append((page, text))
            continue
        merged.append((page, "\n\n".join([text, *extra]) if text.strip() else "\n\n".join(extra)))
    for page, texts in remaining.items():
        merged.append((page, "\n\n".join(texts)))
    return merged


class MultimodalError(Exception):
    """Multimodal analysis or ingestion failed cleanly."""


class MultimodalService:
    def __init__(
        self,
        knowledge_base: KnowledgeBase,
        preparer: DocumentPreparer,
        ocr_provider: Optional[OCRProvider],
        vision_provider: VisionProvider,
        vision_model: Optional[str],
        vision_enabled: bool,
        vision_requirements: ResourceRequirements,
        scheduler: ResourceScheduler,
        uploads_root: str,
        tmp_root: str,
        max_pages: int = 50,
        vision_max_pages: int = 5,
        vision_wait_rounds: int = 5,
        # Kept in step with Settings.ocr_page_min_text_chars: a caller that
        # wires settings explicitly (the app) and a caller that does not (a
        # test harness) must route the same pages to OCR.
        ocr_page_min_text_chars: int = 64,
    ) -> None:
        self._kb = knowledge_base
        self._preparer = preparer
        self._ocr = ocr_provider
        self._vision = vision_provider
        self._vision_model = vision_model
        self._vision_enabled = vision_enabled
        self._vision_requirements = vision_requirements
        self._scheduler = scheduler
        self._uploads_root = Path(uploads_root).resolve()
        self._tmp_root = Path(tmp_root).resolve()
        self._max_pages = max_pages
        self._vision_max_pages = vision_max_pages
        self._vision_wait_rounds = max(vision_wait_rounds, 1)
        self._ocr_min_text_chars = max(int(ocr_page_min_text_chars), 1)

    @property
    def knowledge_base(self) -> KnowledgeBase:
        return self._kb

    @property
    def ocr_available(self) -> bool:
        return self._ocr is not None

    async def analyze(
        self,
        user_id: str,
        document_id: str,
        pages: Optional[list[int]],
        question: str,
    ) -> VisionAnalysisResult:
        """Analyze the requested pages of the user's document with OCR + vision."""
        if self._ocr is None:
            raise MultimodalError("OCR is not enabled on this deployment")
        if not self._vision_enabled or not self._vision_model:
            raise MultimodalError(
                "Vision model is not configured or is disabled in the model registry"
            )

        doc = await self._kb.get_document(user_id, document_id)
        if doc is None:
            raise MultimodalError(
                f"document_not_found: document '{document_id}' does not exist for this user"
            )
        if doc.status not in (DocumentStatus.READY, DocumentStatus.PARTIAL):
            raise MultimodalError(
                f"document '{document_id}' is not ready (status: {doc.status})"
            )

        path = self._resolve_document_path(doc)
        ctx = get_job_context()
        job_id = ctx.get("job_id") or "job"
        tmp_dir = (
            self._tmp_root
            / WorkspaceManager.safe_component(user_id)
            / WorkspaceManager.safe_component(job_id)
        )
        tmp_dir.mkdir(parents=True, exist_ok=True)
        try:
            rendered = await self._preparer.prepare(path, doc.document_type, tmp_dir, pages=pages)
            if len(rendered) > self._vision_max_pages:
                raise MultimodalError(
                    f"Requested {len(rendered)} page(s), exceeding the maximum of "
                    f"{self._vision_max_pages} per analysis"
                )
            page_evidence: list[PageEvidence] = []
            for rp in rendered:
                ocr_page = await self._run_ocr(rp, doc)
                vision = await self._run_vision_for_page(
                    rp, doc, path, question, ocr_page.text, tmp_dir
                )
                page_evidence.append(
                    PageEvidence(
                        page=rp.page,
                        ocr_text=ocr_page.text[:MAX_OCR_TEXT_CHARS_PER_PAGE],
                        ocr_regions=ocr_page.regions,
                        vision_text=vision.text,
                        observations=vision.observations,
                        vision_model=vision.model,
                    )
                )
            return VisionAnalysisResult(
                document_id=doc.document_id,
                filename=doc.filename,
                document_type=doc.document_type,
                pages=page_evidence,
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            _remove_empty_ancestors(tmp_dir.parent, self._tmp_root)

    # -------------------------------------------------- scanned-doc ingestion

    async def ingest_scanned(
        self, user_id: str, path: Path, filename: str
    ) -> DocumentRecord:
        """OCR an image-only PDF / image file and index its text into the KB."""
        if self._ocr is None:
            raise MultimodalError("OCR is not enabled on this deployment")
        document_type = document_type_for(filename)
        tmp_dir = (
            self._tmp_root / WorkspaceManager.safe_component(user_id) / "ingest"
        )
        tmp_dir.mkdir(parents=True, exist_ok=True)
        try:
            try:
                rendered = await self._preparer.prepare(path, document_type, tmp_dir)
            except DocumentPreparationError as exc:
                return await self._kb.ingest_pages(
                    user_id, path, filename, [],
                    metadata={"ocr": True},
                    empty_text_error=str(exc),
                )
            pages = []
            elements: list[ExtractionElement] = []
            for rp in rendered:
                regions = await self._recognize(rp, user_id)
                text = "\n".join(region.text for region in regions)
                pages.append((rp.page, text))
                elements.extend(self._ocr_elements(rp.page, regions))
            # Rendered but recognised as nothing: the page's content is absent
            # from this document, and the reader is told so rather than left to
            # read a silence as an absence of findings.
            unreadable_pages = [page for page, text in pages if not text.strip()]
            has_text = any(text.strip() for _, text in pages)
            if not has_text:
                return await self._kb.ingest_pages(
                    user_id, path, filename, [],
                    metadata={"page_count": len(rendered), "ocr": True},
                    unreadable_pages=unreadable_pages,
                    empty_text_error="Document requires OCR",
                )
            metadata: dict = {"page_count": len(rendered), "ocr": True}
            if unreadable_pages:
                metadata["unreadable_pages"] = unreadable_pages
            return await self._kb.ingest_pages(
                user_id, path, filename, pages,
                metadata=metadata,
                elements=elements,
                unreadable_pages=unreadable_pages,
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            _remove_empty_ancestors(tmp_dir.parent, self._tmp_root)

    async def ingest_container(
        self, user_id: str, path: Path, filename: str
    ) -> DocumentRecord:
        """Ingest a container document (Office/OpenDocument) with its pictures.

        The container's own text is the searchable content and is read by the
        same family extractor as before. On top of that:

        - each raster picture inside it is OCR-ed (when OCR is available) and its
          text is merged into the page the picture sits on, so wording that
          exists only inside a figure is still found by search — no page is
          added, because a document's page numbering must not shift because a
          picture had a caption;
        - each picture is registered as its own image document, so it can be
          named as a figure in a Word/Excel/PowerPoint deliverable.

        A container with no pictures keeps the plain path exactly: it delegates
        to ``ingest_document``, so nothing about an image-free document changes.
        """
        document_type = document_type_for(filename)
        media = extract_embedded_media(path, document_type)
        if not media:
            return await self._kb.ingest_document(user_id, path, filename)
        try:
            pages = extract_document_pages(path, document_type)
        except DocumentIngestionError:
            # Unreadable container: let the knowledge base fail it cleanly and
            # consistently with the plain path rather than raising here.
            return await self._kb.ingest_document(user_id, path, filename)

        tmp_dir = self._tmp_root / WorkspaceManager.safe_component(user_id) / "ingest"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        try:
            additions = await self._figure_text(media=media, user_id=user_id, tmp_dir=tmp_dir)
            merged = _merge_figure_text(pages, additions)
            if not any(text.strip() for _, text in merged):
                return await self._kb.ingest_pages(
                    user_id, path, filename, [],
                    metadata={"page_count": len(pages)},
                    empty_text_error="No extractable text found",
                )
            images = await self._register_embedded_images(user_id, filename, media)
            metadata: dict = {"page_count": len(pages)}
            if images:
                metadata[EMBEDDED_IMAGES_KEY] = images
            return await self._kb.ingest_pages(
                user_id, path, filename, merged, metadata=metadata
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            _remove_empty_ancestors(tmp_dir.parent, self._tmp_root)

    async def _figure_text(
        self,
        *,
        media: list[EmbeddedMedia],
        user_id: str,
        tmp_dir: Path,
    ) -> dict[Optional[int], list[str]]:
        """OCR each embedded picture, keyed by the page it belongs to.

        A picture is written to the job's temp area to be recognised — OCR
        providers take a file — and named for its page so the recognised text
        and the rendered page line up. Best-effort throughout: a picture that
        cannot be written or read contributes nothing rather than losing the
        document's own text.
        """
        if self._ocr is None:
            return {}
        additions: dict[Optional[int], list[str]] = {}
        for index, item in enumerate(media, start=1):
            target = tmp_dir / f"page_{(item.page or 1):04d}_img{index:02d}{item.suffix}"
            try:
                target.write_bytes(item.data)
            except OSError:
                continue
            regions = await self._recognize(
                RenderedPage(
                    page=item.page or 1, image_path=target, width=0, height=0
                ),
                user_id,
            )
            text = "\n".join(region.text for region in regions).strip()
            if text:
                additions.setdefault(item.page, []).append(
                    text[:MAX_OCR_TEXT_CHARS_PER_PAGE]
                )
        return additions

    async def _register_embedded_images(
        self, user_id: str, filename: str, media: list["EmbeddedMedia"]
    ) -> list[dict]:
        """Give each embedded picture its own knowledge-base image document.

        The file is named from the container's stem plus a digest of the
        picture's own bytes, so re-uploading the same container reuses the same
        file and the same document id, while a *different* picture of the same
        name cannot overwrite it.
        """
        user_dir = self._uploads_root / WorkspaceManager.safe_component(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)
        stem = WorkspaceManager.safe_component(Path(filename).stem)[:60]
        registered: list[dict] = []
        for index, item in enumerate(media, start=1):
            digest = hashlib.sha256(item.data).hexdigest()[:8]
            child_name = f"{stem}_image{index:02d}_{digest}{item.suffix}"
            child_path = user_dir / child_name
            try:
                child_path.write_bytes(item.data)
            except OSError:
                continue
            child = await self._kb.register_image_document(
                user_id,
                child_path,
                child_name,
                metadata={"extracted_from": Path(filename).name, "page": item.page},
            )
            registered.append(
                {
                    "doc_id": child.document_id,
                    "filename": child.filename,
                    "page": item.page,
                }
            )
        return registered

    async def ingest_pid(
        self, user_id: str, path: Path, filename: str
    ) -> DocumentRecord:
        """Ingest a P&ID / engineering drawing using tiled high-DPI OCR.

        Extracts text tags (instrument loops, line numbers, equipment tags,
        revisions) using an overlapping tile grid to read fine-grain text
        accurately, projects bounding boxes to page coordinates, resolves seam
        duplicates, generates cropped visual citations, and records neighbor
        tag IDs.
        """
        if self._ocr is None:
            raise MultimodalError("OCR is not enabled on this deployment")

        from app.services.pid_extractor import PIDExtractor, PIDExtractionError
        from app.services.document_ingestion import _hash_file

        content_hash = _hash_file(path)
        existing = await self._kb._find_by_content_hash(user_id, content_hash)
        if existing is not None and (existing.metadata or {}).get("document_kind") == "pid":
            return existing

        user_crop_dir = (
            self._uploads_root / WorkspaceManager.safe_component(user_id) / "crops"
        )
        user_crop_dir.mkdir(parents=True, exist_ok=True)

        extractor = PIDExtractor(ocr_provider=self._ocr)
        suffix = path.suffix.lower().lstrip(".")
        page_count = 1
        if suffix == "pdf":
            try:
                import pypdfium2 as pdfium
                doc = pdfium.PdfDocument(str(path))
                page_count = len(doc)
                doc.close()
            except Exception as exc:
                raise MultimodalError(f"Cannot inspect PDF: {exc}") from exc

        elements: list[ExtractionElement] = []
        pages: list[tuple[Optional[int], str]] = []

        try:
            for p in range(1, page_count + 1):
                page_elements = await extractor.extract_page(
                    image_or_pdf_path=path,
                    page_number=p,
                    output_dir=user_crop_dir,
                    document_sha256=content_hash,
                )
                elements.extend(page_elements)

                tag_summaries = [
                    f"- {elem.text} ({elem.subtype}, confidence: {elem.confidence})"
                    for elem in page_elements
                ]
                text = (
                    f"P&ID Drawing — Page {p}\n" + "\n".join(tag_summaries)
                    if tag_summaries
                    else f"P&ID Drawing — Page {p} (No text tags detected)"
                )
                pages.append((p, text))

            # Resolve cross-page tag continuity (e.g. process lines continuing on next sheet)
            extractor.link_cross_page_tags(elements)

            metadata: dict = {
                "document_kind": "pid",
                "page_count": page_count,
                "tag_count": len(elements),
                "ocr": True,
            }
            return await self._kb.ingest_pages(
                user_id,
                path,
                filename,
                pages,
                metadata=metadata,
                elements=elements,
            )
        except PIDExtractionError as exc:
            raise MultimodalError(f"P&ID extraction failed: {exc}") from exc


    async def ingest_pdf(self, user_id: str, path: Path, filename: str) -> DocumentRecord:
        """Ingest a PDF page by page, OCR-ing only the pages that need it.

        A page whose text layer carries usable text is indexed from that text
        layer (``source="text_layer"``, no bbox and no confidence — a PDF text
        layer exposes neither, and inventing them would be a lie the audit trail
        cannot afford). A page that is a page-scale raster carrying no usable
        text layer is rendered and routed to OCR, whose regions each keep their
        own bbox and confidence (``source="ocr"``). Only the pages needing OCR
        are rendered.

        A page routed to OCR that yields no text is *unreadable*, not silently
        blank: the pages are named in ``metadata["unreadable_pages"]``, the
        document is given ``status="partial"``, and the ingestion emits an audit
        event — a page the system could not read must not look like a page that
        was read and found empty.

        This is the mixed-PDF path: a page-perfect text PDF and a fully scanned
        PDF each keep their existing path (``ingest_document`` /
        ``ingest_scanned``); this covers the case those two cannot express.
        """
        if self._ocr is None:
            raise MultimodalError("OCR is not enabled on this deployment")
        document_type = document_type_for(filename)
        try:
            layouts = extract_pdf_page_layouts(path)
        except DocumentIngestionError:
            # Unreadable PDF: let the knowledge base fail it cleanly and
            # consistently with the text path rather than raising here.
            return await self._kb.ingest_document(user_id, path, filename)

        ocr_pages = [
            layout.page
            for layout in layouts
            if page_requires_ocr(
                layout.text, layout.raster_dominant, self._ocr_min_text_chars
            )
        ]
        tmp_dir = self._tmp_root / WorkspaceManager.safe_component(user_id) / "ingest"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        try:
            ocr_text: dict[int, str] = {}
            ocr_elements: dict[int, list[ExtractionElement]] = {}
            if ocr_pages:
                try:
                    rendered = await self._preparer.prepare(
                        path, document_type, tmp_dir, pages=ocr_pages
                    )
                except DocumentPreparationError as exc:
                    # Rendering legitimately fails sometimes (page cap, corrupt
                    # page). Losing the readable text layer along with it would
                    # be worse, so the OCR pages are dropped and named in the
                    # document's metadata rather than hidden.
                    logger.error(
                        "ocr_render_failed",
                        extra={
                            "event": "ocr_render_failed",
                            "user_id": user_id,
                            "pages": ocr_pages,
                            "error": str(exc),
                        },
                    )
                    rendered = []
                for rp in rendered:
                    regions = await self._recognize(rp, user_id)
                    ocr_text[rp.page] = "\n".join(region.text for region in regions)
                    ocr_elements[rp.page] = self._ocr_elements(rp.page, regions)

            pages: list[tuple[Optional[int], str]] = []
            elements: list[ExtractionElement] = []
            for layout in layouts:
                if layout.page in ocr_elements:
                    pages.append((layout.page, ocr_text[layout.page]))
                    elements.extend(ocr_elements[layout.page])
                elif layout.text:
                    pages.append((layout.page, layout.text))
                    elements.append(
                        ExtractionElement(
                            type="text",
                            page=layout.page,
                            text=layout.text,
                            source="text_layer",
                        )
                    )

            # A page sent to OCR that came back with nothing was neither
            # rendered nor recognised: that page's content is absent from this
            # document, and the reader is told which pages rather than left to
            # assume the document said nothing there.
            unreadable_pages = sorted(
                page for page in ocr_pages if not (ocr_text.get(page) or "").strip()
            )
            metadata: dict = {
                "page_count": len(layouts),
                # ``ocr`` keeps its document-level meaning — "this document had
                # no text layer at all" — because that is what the vision path
                # reads to choose whole-page over figure-only analysis. Per-page
                # OCR provenance lives on the elements' ``source`` instead.
                "ocr": not any(layout.text for layout in layouts),
            }
            if unreadable_pages:
                metadata["unreadable_pages"] = unreadable_pages
            if not any(text.strip() for _, text in pages):
                return await self._kb.ingest_pages(
                    user_id, path, filename, [],
                    metadata=metadata,
                    unreadable_pages=unreadable_pages,
                    empty_text_error="Document requires OCR",
                )
            return await self._kb.ingest_pages(
                user_id, path, filename, pages,
                metadata=metadata,
                elements=elements,
                unreadable_pages=unreadable_pages,
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            _remove_empty_ancestors(tmp_dir.parent, self._tmp_root)

    # ------------------------------------------------------------- internals

    async def _recognize(self, rp: RenderedPage, user_id: str) -> list[OCRRegion]:
        """OCR one rendered page.

        A page that fails to OCR degrades to no regions (logged against the
        page) instead of losing the rest of the document — the same contract
        ``analyze`` already relies on.
        """
        try:
            return await self._ocr.recognize(rp.image_path)
        except OCRProviderError as exc:
            logger.error(
                "ocr_failed",
                extra={
                    "event": "ocr_failed",
                    "user_id": user_id,
                    "document_id": None,
                    "page": rp.page,
                    "provider": self._ocr.describe().get("provider"),
                    "error": str(exc),
                },
            )
            return []

    @staticmethod
    def _ocr_elements(page: int, regions: list[OCRRegion]) -> list[ExtractionElement]:
        """One extraction element per OCR region.

        Regions are never joined here: each keeps its own bbox and confidence,
        so a consumer can tell which recognised text came from which part of the
        page and trace a misread value back to where it was read.
        """
        return [
            ExtractionElement(
                type="text",
                page=page,
                text=region.text,
                bbox=list(region.bbox) if region.bbox else None,
                confidence=region.confidence,
                source="ocr",
            )
            for region in regions
        ]

    def _resolve_document_path(self, doc: DocumentRecord) -> Path:
        user_dir = self._uploads_root / WorkspaceManager.safe_component(doc.user_id)
        path = (user_dir / Path(doc.filename).name).resolve()
        if not path.is_relative_to(self._uploads_root):
            raise MultimodalError("document source path escapes the uploads root")
        if not path.is_file():
            raise MultimodalError(
                f"source file for document '{doc.document_id}' is missing"
            )
        return path

    async def _run_ocr(self, rp: RenderedPage, doc: DocumentRecord) -> OCRPageResult:
        ctx = get_job_context()
        start = time.monotonic()
        provider = self._ocr.describe().get("provider", "unknown") if self._ocr else None
        logger.info(
            "ocr_started",
            extra={
                "event": "ocr_started",
                "job_id": ctx.get("job_id"),
                "user_id": ctx.get("user_id"),
                "document_id": doc.document_id,
                "page": rp.page,
                "provider": provider,
            },
        )
        try:
            regions = await self._ocr.recognize(rp.image_path)
        except OCRProviderError as exc:
            logger.error(
                "ocr_failed",
                extra={
                    "event": "ocr_failed",
                    "job_id": ctx.get("job_id"),
                    "user_id": ctx.get("user_id"),
                    "document_id": doc.document_id,
                    "page": rp.page,
                    "provider": provider,
                    "error": str(exc),
                },
            )
            return OCRPageResult(page=rp.page, text="", regions=[])
        text = "\n".join(region.text for region in regions)
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "ocr_completed",
            extra={
                "event": "ocr_completed",
                "job_id": ctx.get("job_id"),
                "user_id": ctx.get("user_id"),
                "document_id": doc.document_id,
                "page": rp.page,
                "provider": provider,
                "chars": len(text),
                "regions": len(regions),
                "duration_ms": duration_ms,
                "status": "completed",
            },
        )
        return OCRPageResult(page=rp.page, text=text, regions=regions)

    async def _run_vision_for_page(
        self,
        rp: RenderedPage,
        doc: DocumentRecord,
        path: Path,
        question: str,
        ocr_text: str,
        tmp_dir: Path,
    ) -> VisionPageResult:
        """Route a page to the vision model that actually needs it.

        A text-based PDF page is mostly typed text that OCR already covers,
        plus (sometimes) an embedded photo/diagram that OCR cannot read.
        Rather than always vision-analyzing the whole busy page render,
        extract any embedded images and analyze those specifically; a page
        with none is a pure text/vector-graphics page and skips the vision
        call entirely.

        This does NOT apply to a scanned document (``doc.metadata["ocr"]``
        — ingested via ``ingest_scanned`` because it had no extractable text
        layer at all): there, the whole page genuinely IS the image, there
        is no separate typed-text portion to split it from, and skipping
        vision would just lose the analysis entirely. A standalone image
        upload has the same reasoning — the whole file IS the thing to
        analyze. Both keep the original whole-page behavior unchanged.
        """
        if doc.document_type != "pdf" or doc.metadata.get("ocr"):
            return await self._run_vision(rp, doc, question, ocr_text)
        embedded = await self._preparer.extract_embedded_images(
            path, rp.page, tmp_dir / "embedded"
        )
        if not embedded:
            return VisionPageResult(page=rp.page, text="", observations=[], model="")
        return await self._run_vision_on_images(
            embedded[:MAX_EMBEDDED_IMAGES_PER_PAGE], rp.page, doc, question, ocr_text
        )

    async def _run_vision_on_images(
        self,
        images: list[RenderedPage],
        page: int,
        doc: DocumentRecord,
        question: str,
        ocr_text: str,
    ) -> VisionPageResult:
        """Vision-analyze each embedded image individually and merge the
        results into one VisionPageResult for the page."""
        texts: list[str] = []
        observations: list[str] = []
        model_used = ""
        multiple = len(images) > 1
        for index, image_rp in enumerate(images, start=1):
            result = await self._run_vision(image_rp, doc, question, ocr_text)
            model_used = result.model or model_used
            prefix = f"[figure {index}]" if multiple else "[figure]"
            if result.text:
                texts.append(f"{prefix} {result.text}")
            observations.extend(f"{prefix} {obs}" for obs in result.observations)
        return VisionPageResult(
            page=page, text="\n".join(texts), observations=observations, model=model_used
        )

    async def _run_vision(
        self, rp: RenderedPage, doc: DocumentRecord, question: str, ocr_text: str
    ) -> VisionPageResult:
        ctx = get_job_context()
        job_id = ctx.get("job_id") or "job"
        start = time.monotonic()
        logger.info(
            "vision_started",
            extra={
                "event": "vision_started",
                "job_id": job_id,
                "user_id": ctx.get("user_id"),
                "document_id": doc.document_id,
                "page": rp.page,
                "model": self._vision_model,
            },
        )
        try:
            if self._vision_requirements.is_empty:
                result = await self._vision.analyze(
                    rp.image_path, question, ocr_text, self._vision_model
                )
            else:
                result = await self._run_vision_scheduled(job_id, rp, question, ocr_text)
        except VisionProviderError as exc:
            logger.error(
                "vision_failed",
                extra={
                    "event": "vision_failed",
                    "job_id": job_id,
                    "user_id": ctx.get("user_id"),
                    "document_id": doc.document_id,
                    "page": rp.page,
                    "model": self._vision_model,
                    "error": str(exc),
                },
            )
            raise MultimodalError(f"vision analysis failed: {exc}") from exc
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "vision_completed",
            extra={
                "event": "vision_completed",
                "job_id": job_id,
                "user_id": ctx.get("user_id"),
                "document_id": doc.document_id,
                "page": rp.page,
                "model": result.model or self._vision_model,
                "observations": len(result.observations),
                "duration_ms": duration_ms,
                "status": "completed",
            },
        )
        return result

    async def _run_vision_scheduled(
        self, job_id: str, rp: RenderedPage, question: str, ocr_text: str
    ) -> VisionPageResult:
        """Run vision under a scheduler allocation (never bypassed)."""
        user_id = get_job_context().get("user_id") or "user"
        sub_key = f"{job_id}:vision"
        for _ in range(self._vision_wait_rounds + 1):
            decision = await self._scheduler.request(
                sub_key, user_id, self._vision_model, self._vision_requirements
            )
            if decision.decision == "grant":
                try:
                    return await self._vision.analyze(
                        rp.image_path, question, ocr_text, self._vision_model
                    )
                finally:
                    await self._scheduler.release(sub_key)
            if decision.decision == "reject":
                await self._scheduler.cancel(sub_key)
                raise MultimodalError(f"vision resources rejected: {decision.reason}")
            await self._scheduler.wait_until_available(timeout=1.0)
        await self._scheduler.cancel(sub_key)
        raise MultimodalError("vision resources not available within the wait limit")

    # -------------------------------------------------------------- status

    def describe_status(self, available_models: Optional[set[str]]) -> dict:
        available = (
            self._vision_enabled
            and bool(self._vision_model)
            and self._vision_model in set(available_models or set())
        )
        status = "ok" if (self._ocr is not None and self._vision_enabled) else "disabled"
        return {
            "status": status,
            "ocr": {
                "enabled": self._ocr is not None,
                "provider": self._ocr.describe() if self._ocr else None,
            },
            "vision": {
                "model": self._vision_model or None,
                "enabled": self._vision_enabled,
                "available": available,
                "provider": self._vision.describe(),
                "resources": self._vision_requirements.model_dump(),
            },
        }
