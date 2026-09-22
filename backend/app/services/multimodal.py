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
    DocumentIngestionError,
    document_type_for,
    extract_pdf_page_texts,
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
        ocr_page_min_text_chars: int = 1,
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
        if doc.status != DocumentStatus.READY:
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
            has_text = any(text.strip() for _, text in pages)
            if not has_text:
                return await self._kb.ingest_pages(
                    user_id, path, filename, [],
                    metadata={"page_count": len(rendered), "ocr": True},
                    empty_text_error="Document requires OCR",
                )
            return await self._kb.ingest_pages(
                user_id, path, filename, pages,
                metadata={"page_count": len(rendered), "ocr": True},
                elements=elements,
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            _remove_empty_ancestors(tmp_dir.parent, self._tmp_root)

    async def ingest_pdf(self, user_id: str, path: Path, filename: str) -> DocumentRecord:
        """Ingest a PDF page by page, OCR-ing only the pages that need it.

        A page whose text layer carries usable text is indexed from that text
        layer (``source="text_layer"``, no bbox and no confidence — a PDF text
        layer exposes neither, and inventing them would be a lie the audit trail
        cannot afford). A page with no usable text layer is rendered and routed
        to OCR, whose regions each keep their own bbox and confidence
        (``source="ocr"``). Only the pages needing OCR are rendered.

        This is the mixed-PDF path: a page-perfect text PDF and a fully scanned
        PDF each keep their existing path (``ingest_document`` /
        ``ingest_scanned``); this covers the case those two cannot express.
        """
        if self._ocr is None:
            raise MultimodalError("OCR is not enabled on this deployment")
        document_type = document_type_for(filename)
        try:
            page_texts = extract_pdf_page_texts(path)
        except DocumentIngestionError:
            # Unreadable PDF: let the knowledge base fail it cleanly and
            # consistently with the text path rather than raising here.
            return await self._kb.ingest_document(user_id, path, filename)

        ocr_pages = [
            page for page, text in page_texts if len(text) < self._ocr_min_text_chars
        ]
        tmp_dir = self._tmp_root / WorkspaceManager.safe_component(user_id) / "ingest"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        try:
            ocr_text: dict[int, str] = {}
            ocr_elements: dict[int, list[ExtractionElement]] = {}
            skipped_pages: list[int] = []
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
                    skipped_pages = list(ocr_pages)
                    rendered = []
                for rp in rendered:
                    regions = await self._recognize(rp, user_id)
                    ocr_text[rp.page] = "\n".join(region.text for region in regions)
                    ocr_elements[rp.page] = self._ocr_elements(rp.page, regions)

            pages: list[tuple[Optional[int], str]] = []
            elements: list[ExtractionElement] = []
            for page, text in page_texts:
                if page in ocr_elements:
                    pages.append((page, ocr_text[page]))
                    elements.extend(ocr_elements[page])
                elif text:
                    pages.append((page, text))
                    elements.append(
                        ExtractionElement(
                            type="text", page=page, text=text, source="text_layer"
                        )
                    )
            metadata: dict = {
                "page_count": len(page_texts),
                # ``ocr`` keeps its document-level meaning — "this document had
                # no text layer at all" — because that is what the vision path
                # reads to choose whole-page over figure-only analysis. Per-page
                # OCR provenance lives on the elements' ``source`` instead.
                "ocr": not any(text for _, text in page_texts),
            }
            if skipped_pages:
                metadata["ocr_skipped_pages"] = skipped_pages
            if not any(text.strip() for _, text in pages):
                return await self._kb.ingest_pages(
                    user_id, path, filename, [],
                    metadata=metadata,
                    empty_text_error="Document requires OCR",
                )
            return await self._kb.ingest_pages(
                user_id, path, filename, pages,
                metadata=metadata,
                elements=elements,
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
