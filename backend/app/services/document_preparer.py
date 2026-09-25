"""Local document page/image preparation for OCR and vision.

Renders PDF pages to PNG images (``pypdfium2``) and normalizes standalone image
files (Pillow) — a still image into one page, an animated GIF or multi-page
TIFF into one page per frame. Fully local — no cloud converters, external image
processing services, or remote APIs. Rendered pages are written to a
caller-provided temp directory; callers are responsible for cleanup. Failures
(malformed PDF, unreadable page, unsupported image, oversized image, rendering
failure) raise ``DocumentPreparationError`` so the ingestion/job layer can fail
cleanly.

A single PDF page can also be rendered to bytes in memory (``render_page_png``)
— the deliverable generators take a stream, and a job workspace may hold only
``artifacts/``, so a page used as a figure never lands on disk.

Also extracts embedded raster images from within a PDF page (``pypdf``) —
distinct from rendering the whole page: a page that is mostly typed text
with one photo/diagram embedded in it should hand vision just the photo,
not a busy full-page render that OCR already covers.
"""

import asyncio
import io
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader

logger = logging.getLogger("app.document_preparer")

SUPPORTED_IMAGE_TYPES = ("png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp")
_PAGE_FILE_TEMPLATE = "page_{page:04d}.png"
_EMBEDDED_IMAGE_FILE_TEMPLATE = "page_{page:04d}_img{index:02d}.png"
_PAGE_RE = re.compile(r"page_(\d+)")
# Below this, an "embedded image" is more likely a decorative rule, bullet
# glyph, or icon than an actual photo/diagram worth a vision call.
MIN_EMBEDDED_IMAGE_DIMENSION = 64


class DocumentPreparationError(Exception):
    """A document could not be rendered or prepared cleanly."""


@dataclass
class RenderedPage:
    """One rendered page: page number plus its local image file."""

    page: int
    image_path: Path
    width: int
    height: int


def page_number_from_path(path: Path) -> Optional[int]:
    """Extract the page number encoded in a rendered page filename."""
    match = _PAGE_RE.search(Path(path).stem)
    return int(match.group(1)) if match else None


class DocumentPreparer:
    def __init__(
        self,
        render_scale: float = 2.0,
        max_image_dimension: int = 4000,
        max_pages: int = 50,
    ) -> None:
        self._scale = max(1.0, float(render_scale))
        self._max_dim = max(int(max_image_dimension), 1)
        self._max_pages = max(int(max_pages), 1)

    async def prepare(
        self,
        path: Path,
        document_type: str,
        output_dir: Path,
        pages: Optional[list[int]] = None,
    ) -> list[RenderedPage]:
        """Render a PDF (or normalize an image) into PNG page files."""
        document_type = (document_type or "").lower()
        if document_type == "pdf":
            return await asyncio.to_thread(self._render_pdf, path, output_dir, pages)
        if document_type in SUPPORTED_IMAGE_TYPES:
            return await asyncio.to_thread(self._prepare_image, path, output_dir, pages)
        raise DocumentPreparationError(
            f"Unsupported document type for rendering: '{document_type}'"
        )

    async def extract_embedded_images(
        self, path: Path, page: int, output_dir: Path
    ) -> list["RenderedPage"]:
        """Extract embedded raster images from one PDF page as individual
        files (never the whole-page render).

        Best-effort enrichment, not a hard requirement of the pipeline: a
        page with no embedded images (pure text/vector graphics) or one that
        cannot be read this way returns an empty list rather than raising —
        the caller always has the whole-page render and OCR as a fallback.
        """
        return await asyncio.to_thread(self._extract_embedded_images, path, page, output_dir)

    def _extract_embedded_images(
        self, path: Path, page: int, output_dir: Path
    ) -> list["RenderedPage"]:
        try:
            reader = PdfReader(str(path))
            pdf_page = reader.pages[page - 1]
            images = list(pdf_page.images)
        except Exception as exc:
            logger.warning(
                "embedded_image_extraction_failed",
                extra={"event": "embedded_image_extraction_failed", "page": page, "error": str(exc)},
            )
            return []
        output_dir.mkdir(parents=True, exist_ok=True)
        extracted: list[RenderedPage] = []
        for index, image_file in enumerate(images, start=1):
            try:
                pil_image = image_file.image
                if pil_image is None:
                    continue
                if min(pil_image.width, pil_image.height) < MIN_EMBEDDED_IMAGE_DIMENSION:
                    continue
                normalized = self._normalize_image(pil_image)
                out = output_dir / _EMBEDDED_IMAGE_FILE_TEMPLATE.format(page=page, index=index)
                normalized.save(out, format="PNG")
                extracted.append(
                    RenderedPage(
                        page=page,
                        image_path=out,
                        width=normalized.width,
                        height=normalized.height,
                    )
                )
            except Exception as exc:
                # One bad embedded image (unsupported filter, corrupt
                # stream) must not lose the others on the same page.
                logger.warning(
                    "embedded_image_extraction_failed",
                    extra={
                        "event": "embedded_image_extraction_failed",
                        "page": page,
                        "index": index,
                        "error": str(exc),
                    },
                )
                continue
        return extracted

    # -------------------------------------------------------------- PDF

    def _render_pdf(
        self,
        path: Path,
        output_dir: Path,
        pages: Optional[list[int]],
    ) -> list[RenderedPage]:
        try:
            import pypdfium2 as pdfium

            document = pdfium.PdfDocument(str(path))
        except Exception as exc:
            raise DocumentPreparationError(f"Cannot render PDF: {exc}") from exc
        try:
            try:
                page_count = len(document)
            except Exception as exc:
                raise DocumentPreparationError(
                    f"Cannot determine PDF page count: {exc}"
                ) from exc
            target = self._resolve_target_pages(pages, page_count)
            if len(target) > self._max_pages:
                raise DocumentPreparationError(
                    f"Document has {page_count} page(s), exceeding the maximum "
                    f"of {self._max_pages} pages"
                )
            output_dir.mkdir(parents=True, exist_ok=True)
            rendered: list[RenderedPage] = []
            for index in target:
                try:
                    page = document[index - 1]
                    bitmap = page.render(scale=self._scale)
                    image = bitmap.to_pil()
                    image = self._normalize_image(image)
                    out = output_dir / _PAGE_FILE_TEMPLATE.format(page=index)
                    image.save(out, format="PNG")
                    rendered.append(
                        RenderedPage(
                            page=index,
                            image_path=out,
                            width=image.width,
                            height=image.height,
                        )
                    )
                except DocumentPreparationError:
                    raise
                except Exception as exc:
                    raise DocumentPreparationError(
                        f"Cannot render PDF page {index}: {exc}"
                    ) from exc
            if not rendered:
                raise DocumentPreparationError("PDF has no renderable pages")
            return rendered
        finally:
            try:
                document.close()
            except Exception:
                pass

    def _resolve_target_pages(
        self, pages: Optional[list[int]], page_count: int
    ) -> list[int]:
        if page_count < 1:
            raise DocumentPreparationError("PDF has no pages")
        if pages is None:
            return list(range(1, page_count + 1))
        result: list[int] = []
        for page in pages:
            if not isinstance(page, int) or page < 1 or page > page_count:
                raise DocumentPreparationError(
                    f"Page {page} does not exist (document has {page_count} page(s))"
                )
            if page not in result:
                result.append(page)
        return result

    # ------------------------------------------------------------ image

    def _prepare_image(
        self,
        path: Path,
        output_dir: Path,
        pages: Optional[list[int]],
    ) -> list[RenderedPage]:
        """Normalize a standalone image into one PNG page per frame.

        A still image is one page. An animated GIF or a multi-page TIFF is
        several: its frames are the pages a reader would page through, so each
        gets its own rendered file and is addressed by its frame number.
        """
        try:
            with Image.open(path) as opened:
                opened.load()
                frame_count = max(int(getattr(opened, "n_frames", 1) or 1), 1)
                if frame_count == 1 and pages is not None and pages != [1]:
                    raise DocumentPreparationError(
                        "An image document has exactly one page (page 1)"
                    )
                target = self._resolve_target_pages(pages, frame_count)
                if len(target) > self._max_pages:
                    raise DocumentPreparationError(
                        f"Document has {frame_count} page(s), exceeding the maximum "
                        f"of {self._max_pages} pages"
                    )
                frames = []
                for index in target:
                    opened.seek(index - 1)
                    frames.append(opened.copy())
        except DocumentPreparationError:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise DocumentPreparationError(
                f"Cannot read image '{Path(path).name}': {exc}"
            ) from exc
        output_dir.mkdir(parents=True, exist_ok=True)
        rendered: list[RenderedPage] = []
        for index, frame in zip(target, frames):
            image = self._normalize_image(frame)
            out = output_dir / _PAGE_FILE_TEMPLATE.format(page=index)
            image.save(out, format="PNG")
            rendered.append(
                RenderedPage(
                    page=index,
                    image_path=out,
                    width=image.width,
                    height=image.height,
                )
            )
        return rendered

    # ------------------------------------------------------- PDF page to bytes

    def render_page_png(self, path: Path, page: int) -> bytes:
        """Render one PDF page to PNG bytes, entirely in memory.

        The deliverable generators take a path or a stream, and a job's
        workspace may hold only ``artifacts/``, so a page used as a figure is
        returned as bytes rather than written anywhere.
        """
        try:
            import pypdfium2 as pdfium

            document = pdfium.PdfDocument(str(path))
        except Exception as exc:
            raise DocumentPreparationError(f"Cannot render PDF: {exc}") from exc
        try:
            try:
                page_count = len(document)
            except Exception as exc:
                raise DocumentPreparationError(
                    f"Cannot determine PDF page count: {exc}"
                ) from exc
            index = self._resolve_target_pages([page], page_count)[0]
            try:
                bitmap = document[index - 1].render(scale=self._scale)
                image = self._normalize_image(bitmap.to_pil())
            except Exception as exc:
                raise DocumentPreparationError(
                    f"Cannot render PDF page {index}: {exc}"
                ) from exc
        finally:
            try:
                document.close()
            except Exception:
                pass
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    # ---------------------------------------------------------- helpers

    def _normalize_image(self, image: Image.Image) -> Image.Image:
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        if max(image.width, image.height) > self._max_dim:
            ratio = self._max_dim / max(image.width, image.height)
            image = image.resize(
                (max(int(image.width * ratio), 1), max(int(image.height * ratio), 1))
            )
        return image
