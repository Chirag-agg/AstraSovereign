"""P&ID tag extraction pipeline with tiled high-DPI OCR.

Engineering drawings (P&IDs, PFDs, ISOs) feature high spatial density and small
font sizes (6–8pt) across large sheet formats (ANSI D/E, A1/A0). A full-sheet
render at 300+ DPI can exceed PIL image decompression limits (178M pixels).

This service renders pages safely at configurable DPI (default 300 DPI), splits
the render into an overlapping grid of tiles (e.g. 2 rows x 3 cols with 15%
overlap), executes local OCR (RapidOCR) on each tile, projects tile-local bounding
boxes back to page-global coordinates, resolves seam duplicates via IoU
Non-Maximum Suppression, classifies tags according to ISA-5.1 precedence,
extracts cropped visual citations for verified evidence, and identifies
co-occurring neighbor tag elements by content-addressed ID.
"""

import asyncio
from dataclasses import dataclass
import hashlib
import logging
import math
from pathlib import Path
from typing import Any, Optional, Tuple
import yaml

from PIL import Image

from app.schemas.extraction import ExtractionElement
from app.services.extractor import make_element_id
from app.services.ocr_provider import OCRProvider, RapidOCREngine
from app.services.pid_classifier import PIDTagClassifier, TagClassificationResult

logger = logging.getLogger("app.pid_extractor")

DEFAULT_SETTINGS_PATH = Path(__file__).resolve().parent.parent / "config" / "pid_settings.yaml"


class PIDExtractionError(Exception):
    """Raised when P&ID extraction fails during rendering, OCR, or post-processing."""


@dataclass(frozen=True)
class PIDSettings:
    """Runtime numeric tuning parameters for P&ID extraction."""

    render_dpi: int = 300
    render_scale: float = 4.167
    tile_grid_rows: int = 2
    tile_grid_cols: int = 3
    tile_overlap_ratio: float = 0.15
    low_confidence_threshold: float = 0.70
    vlm_escalation_threshold: float = 0.50
    crop_margin_pixels: int = 80
    dedup_iou_threshold: float = 0.50
    neighbor_distance_threshold: float = 400.0
    structural_invalid_confidence_multiplier: float = 0.50
    max_render_pixels: int = 100_000_000

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "PIDSettings":
        """Load settings from YAML or return default parameters."""
        target = Path(path) if path else DEFAULT_SETTINGS_PATH
        if not target.is_file():
            return cls()
        try:
            with open(target, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            settings_dict = data.get("settings", {})
            return cls(
                render_dpi=int(settings_dict.get("render_dpi", 300)),
                render_scale=float(settings_dict.get("render_scale", 4.167)),
                tile_grid_rows=int(settings_dict.get("tile_grid_rows", 2)),
                tile_grid_cols=int(settings_dict.get("tile_grid_cols", 3)),
                tile_overlap_ratio=float(settings_dict.get("tile_overlap_ratio", 0.15)),
                low_confidence_threshold=float(settings_dict.get("low_confidence_threshold", 0.70)),
                vlm_escalation_threshold=float(settings_dict.get("vlm_escalation_threshold", 0.50)),
                crop_margin_pixels=int(settings_dict.get("crop_margin_pixels", 80)),
                dedup_iou_threshold=float(settings_dict.get("dedup_iou_threshold", 0.50)),
                neighbor_distance_threshold=float(settings_dict.get("neighbor_distance_threshold", 400.0)),
                structural_invalid_confidence_multiplier=float(
                    settings_dict.get("structural_invalid_confidence_multiplier", 0.50)
                ),
                max_render_pixels=int(settings_dict.get("max_render_pixels", 100_000_000)),
            )
        except Exception as exc:
            logger.warning("pid_settings_load_failed", extra={"path": str(target), "error": str(exc)})
            return cls()


@dataclass(frozen=True)
class TileBox:
    """A tile coordinate rectangle within a full page render."""

    row: int
    col: int
    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0

    @property
    def height(self) -> int:
        return self.y1 - self.y0


@dataclass
class RawTagDetection:
    """Intermediate OCR detection before deduplication and element packaging."""

    text: str
    tile_bbox: list[int]  # [x0, y0, x1, y1] local to tile
    global_bbox: list[int]  # [x0, y0, x1, y1] on full render
    page_bbox: list[float]  # [x0, y0, x1, y1] in PDF page units
    confidence: float
    classification: TagClassificationResult


def compute_tile_grid(
    image_width: int,
    image_height: int,
    rows: int,
    cols: int,
    overlap_ratio: float,
) -> list[TileBox]:
    """Compute an overlapping grid of tiles covering the entire image area.

    Guarantees complete coverage: every pixel (x, y) falls inside at least one
    tile. Edge tiles are anchored to image boundaries without overflow.

    Parameters
    ----------
    image_width : int
        Width of the rendered image in pixels.
    image_height : int
        Height of the rendered image in pixels.
    rows : int
        Number of tile rows (vertical partitions).
    cols : int
        Number of tile columns (horizontal partitions).
    overlap_ratio : float
        Fractional overlap between adjacent tiles (e.g. 0.15 for 15%).

    Returns
    -------
    list[TileBox]
        List of computed tile boundaries covering [0, 0, image_width, image_height].
    """
    rows = max(1, int(rows))
    cols = max(1, int(cols))
    overlap_ratio = max(0.0, min(0.5, float(overlap_ratio)))

    if cols == 1:
        tile_w = image_width
        step_x = 0
    else:
        # tile_w * (1 + (cols - 1)*(1 - overlap_ratio)) = image_width
        denom_x = 1.0 + (cols - 1) * (1.0 - overlap_ratio)
        tile_w = max(10, int(math.ceil(image_width / denom_x)))
        step_x = max(1, int(tile_w * (1.0 - overlap_ratio)))

    if rows == 1:
        tile_h = image_height
        step_y = 0
    else:
        denom_y = 1.0 + (rows - 1) * (1.0 - overlap_ratio)
        tile_h = max(10, int(math.ceil(image_height / denom_y)))
        step_y = max(1, int(tile_h * (1.0 - overlap_ratio)))

    tiles: list[TileBox] = []
    for r in range(rows):
        if r == rows - 1:
            y1 = image_height
            y0 = max(0, image_height - tile_h)
        else:
            y0 = r * step_y
            y1 = min(image_height, y0 + tile_h)

        for c in range(cols):
            if c == cols - 1:
                x1 = image_width
                x0 = max(0, image_width - tile_w)
            else:
                x0 = c * step_x
                x1 = min(image_width, x0 + tile_w)

            tiles.append(TileBox(row=r, col=c, x0=x0, y0=y0, x1=x1, y1=y1))

    return tiles


def project_tile_bbox_to_global(tile: TileBox, local_bbox: list[int]) -> list[int]:
    """Map tile-local bounding box coordinates to full-sheet pixel coordinates.

    Parameters
    ----------
    tile : TileBox
        The parent tile containing the detection.
    local_bbox : list[int]
        [x0, y0, x1, y1] relative to the tile's top-left corner.

    Returns
    -------
    list[int]
        [gx0, gy0, gx1, gy1] absolute pixel coordinates on the rendered page.
    """
    return [
        tile.x0 + local_bbox[0],
        tile.y0 + local_bbox[1],
        tile.x0 + local_bbox[2],
        tile.y0 + local_bbox[3],
    ]


def compute_iou(box_a: list[int], box_b: list[int]) -> float:
    """Compute Intersection over Union (IoU) of two axis-aligned bounding boxes."""
    x0 = max(box_a[0], box_b[0])
    y0 = max(box_a[1], box_b[1])
    x1 = min(box_a[2], box_b[2])
    y1 = min(box_a[3], box_b[3])

    inter_w = max(0, x1 - x0)
    inter_h = max(0, y1 - y0)
    inter_area = inter_w * inter_h
    if inter_area == 0:
        return 0.0

    area_a = max(0, box_a[2] - box_a[0]) * max(0, box_a[3] - box_a[1])
    area_b = max(0, box_b[2] - box_b[0]) * max(0, box_b[3] - box_b[1])
    union_area = area_a + area_b - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / union_area


def deduplicate_detections(
    detections: list[RawTagDetection],
    iou_threshold: float = 0.50,
) -> list[RawTagDetection]:
    """Deduplicate tag detections across overlapping tile seams via Non-Maximum Suppression.

    When adjacent tiles capture the same tag in their overlap region, retains
    the higher-confidence detection and expands the bounding box to encapsulate
    both detections.

    Parameters
    ----------
    detections : list[RawTagDetection]
        All raw detections across all tiles.
    iou_threshold : float
        Minimum IoU to consider two detections identical (default 0.50).

    Returns
    -------
    list[RawTagDetection]
        Deduplicated detections.
    """
    if not detections:
        return []

    # Sort descending by confidence
    sorted_dets = sorted(detections, key=lambda d: d.confidence, reverse=True)
    kept: list[RawTagDetection] = []

    for candidate in sorted_dets:
        duplicate = False
        for index, existing in enumerate(kept):
            # Same tag subtype and normalized string, or significant spatial overlap
            same_tag = (
                candidate.classification.normalized_tag == existing.classification.normalized_tag
                and candidate.classification.subtype == existing.classification.subtype
            )
            iou = compute_iou(candidate.global_bbox, existing.global_bbox)

            if (same_tag and iou > 0.15) or iou >= iou_threshold:
                # Merge into existing: keep highest confidence, enclose union box
                merged_global = [
                    min(existing.global_bbox[0], candidate.global_bbox[0]),
                    min(existing.global_bbox[1], candidate.global_bbox[1]),
                    max(existing.global_bbox[2], candidate.global_bbox[2]),
                    max(existing.global_bbox[3], candidate.global_bbox[3]),
                ]
                merged_page = [
                    min(existing.page_bbox[0], candidate.page_bbox[0]),
                    min(existing.page_bbox[1], candidate.page_bbox[1]),
                    max(existing.page_bbox[2], candidate.page_bbox[2]),
                    max(existing.page_bbox[3], candidate.page_bbox[3]),
                ]
                existing.global_bbox = merged_global
                existing.page_bbox = merged_page
                existing.confidence = max(existing.confidence, candidate.confidence)
                duplicate = True
                break

        if not duplicate:
            kept.append(candidate)

    return kept


class PIDExtractor:
    """Extracts P&ID tags from engineering drawings via high-DPI tiled OCR."""

    def __init__(
        self,
        settings: Optional[PIDSettings] = None,
        classifier: Optional[PIDTagClassifier] = None,
        ocr_provider: Optional[OCRProvider] = None,
    ) -> None:
        self.settings = settings or PIDSettings.load()
        self.classifier = classifier or PIDTagClassifier()
        self.ocr = ocr_provider or RapidOCREngine()

    async def extract_page(
        self,
        image_or_pdf_path: Path,
        page_number: int = 1,
        output_dir: Optional[Path] = None,
        document_sha256: str = "",
    ) -> list[ExtractionElement]:
        """Extract P&ID tags from a single drawing page.

        Parameters
        ----------
        image_or_pdf_path : Path
            Path to the source drawing file (PDF or image).
        page_number : int
            1-based page number (for PDFs).
        output_dir : Optional[Path]
            Directory where cropped citation images are persisted.
        document_sha256 : str
            Document content hash for deterministic element ID generation.

        Returns
        -------
        list[ExtractionElement]
            Extracted tag elements with bounding boxes, confidence, cropped image
            citations, and linked neighbor tag IDs.
        """
        path = Path(image_or_pdf_path)
        if not path.is_file():
            raise PIDExtractionError(f"Source file not found: {path}")

        # Render or load high-DPI PIL image
        full_image, (page_w_pt, page_h_pt) = await asyncio.to_thread(
            self._render_or_load_image, path, page_number
        )

        img_w, img_h = full_image.width, full_image.height
        scale_x = page_w_pt / img_w
        scale_y = page_h_pt / img_h

        # Compute overlapping tile grid
        tiles = compute_tile_grid(
            image_width=img_w,
            image_height=img_h,
            rows=self.settings.tile_grid_rows,
            cols=self.settings.tile_grid_cols,
            overlap_ratio=self.settings.tile_overlap_ratio,
        )

        tmp_dir = output_dir or (path.parent / "crops")
        tmp_dir.mkdir(parents=True, exist_ok=True)

        raw_detections: list[RawTagDetection] = []

        # OCR each tile
        for tile in tiles:
            tile_image = full_image.crop((tile.x0, tile.y0, tile.x1, tile.y1))
            tile_path = tmp_dir / f"_tile_{page_number}_{tile.row}_{tile.col}.png"
            await asyncio.to_thread(tile_image.save, tile_path, "PNG")
            try:
                regions = await self.ocr.recognize(tile_path)
            except Exception as exc:
                logger.warning(
                    f"Tile OCR failed for page {page_number} tile ({tile.row},{tile.col}): {exc}. Continuing remaining tiles."
                )
                regions = []
            finally:
                if tile_path.exists():
                    tile_path.unlink()

            for region in regions:
                text = region.text.strip()
                if not text:
                    continue
                # Classify recognized text against P&ID patterns
                classification = self.classifier.classify(text)
                if not classification:
                    continue

                global_bbox = project_tile_bbox_to_global(tile, region.bbox)
                page_bbox = [
                    round(global_bbox[0] * scale_x, 2),
                    round(global_bbox[1] * scale_y, 2),
                    round(global_bbox[2] * scale_x, 2),
                    round(global_bbox[3] * scale_y, 2),
                ]
                raw_conf = float(region.confidence) if region.confidence is not None else 0.90
                if not classification.is_structurally_valid:
                    final_conf = max(0.0, min(1.0, raw_conf * self.settings.structural_invalid_confidence_multiplier))
                else:
                    final_conf = max(0.0, min(1.0, raw_conf))

                raw_detections.append(
                    RawTagDetection(
                        text=text,
                        tile_bbox=region.bbox,
                        global_bbox=global_bbox,
                        page_bbox=page_bbox,
                        confidence=final_conf,
                        classification=classification,
                    )
                )

        # Deduplicate overlapping seam detections
        deduped = deduplicate_detections(raw_detections, self.settings.dedup_iou_threshold)

        # Construct ExtractionElements with stable IDs
        elements: list[ExtractionElement] = []
        for index, det in enumerate(deduped):
            element_id = make_element_id(
                document_sha256,
                page_number,
                "pid_tag",
                det.classification.normalized_tag,
                det.page_bbox,
            )

            # Generate cropped visual evidence image asynchronously
            crop_path = await asyncio.to_thread(
                self._generate_crop,
                full_image=full_image,
                global_bbox=det.global_bbox,
                output_dir=tmp_dir,
                page_number=page_number,
                element_id=element_id,
            )

            elem = ExtractionElement(
                type="pid_tag",
                page=page_number,
                bbox=det.page_bbox,
                text=det.classification.normalized_tag,
                confidence=round(max(0.0, min(1.0, float(det.confidence))), 4),
                is_structurally_valid=det.classification.is_structurally_valid,
                element_id=element_id,
                order=index,
                subtype=det.classification.subtype,
                source="ocr",
                image_path=str(crop_path) if crop_path else None,
            )
            elements.append(elem)

        # Compute topological neighbor links (storing element_ids)
        self._link_neighbor_tags(elements)

        return elements

    @staticmethod
    def link_cross_page_tags(elements: list[ExtractionElement]) -> None:
        """Find identical normalized tags occurring across multiple pages within the same document.

        Populates ``continues_on_pages`` with sorted page numbers of other sheets
        where the same normalized tag identifier appears.
        """
        tag_to_pages: dict[str, set[int]] = {}
        for elem in elements:
            if elem.text and elem.page is not None:
                tag_to_pages.setdefault(elem.text, set()).add(elem.page)

        for elem in elements:
            if elem.text and elem.page is not None:
                other_pages = sorted(p for p in tag_to_pages.get(elem.text, set()) if p != elem.page)
                elem.continues_on_pages = other_pages

    def _render_or_load_image(
        self, path: Path, page_number: int
    ) -> Tuple[Image.Image, Tuple[float, float]]:
        """Render a PDF page at high DPI or open a raster image file."""
        suffix = path.suffix.lower().lstrip(".")
        if suffix == "pdf":
            try:
                import pypdfium2 as pdfium

                doc = pdfium.PdfDocument(str(path))
            except Exception as exc:
                raise PIDExtractionError(f"Cannot open PDF: {exc}") from exc

            try:
                if page_number > len(doc) or page_number < 1:
                    raise PIDExtractionError(f"Page {page_number} out of range (total: {len(doc)})")
                page = doc[page_number - 1]
                w_pt, h_pt = page.get_size()
                scale = self.settings.render_scale
                # Guard against decompression bombs
                est_pixels = (w_pt * scale) * (h_pt * scale)
                if est_pixels > self.settings.max_render_pixels:
                    scale = math.sqrt(self.settings.max_render_pixels / (w_pt * h_pt))
                    logger.warning(
                        "pid_render_scale_clamped",
                        extra={"requested_scale": self.settings.render_scale, "clamped_scale": scale},
                    )

                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil().convert("RGB")
                return pil_image, (w_pt, h_pt)
            finally:
                doc.close()
        else:
            try:
                pil_image = Image.open(path).convert("RGB")
                w, h = pil_image.width, pil_image.height
                return pil_image, (float(w), float(h))
            except Exception as exc:
                raise PIDExtractionError(f"Cannot open image file: {exc}") from exc

    def _generate_crop(
        self,
        full_image: Image.Image,
        global_bbox: list[int],
        output_dir: Path,
        page_number: int,
        element_id: str,
    ) -> Optional[Path]:
        """Crop the bounding box with margin padding to produce a visual citation."""
        margin = self.settings.crop_margin_pixels
        x0 = max(0, global_bbox[0] - margin)
        y0 = max(0, global_bbox[1] - margin)
        x1 = min(full_image.width, global_bbox[2] + margin)
        y1 = min(full_image.height, global_bbox[3] + margin)

        if x1 <= x0 or y1 <= y0:
            return None

        crop = full_image.crop((x0, y0, x1, y1))
        out_path = output_dir / f"pid_crop_p{page_number}_{element_id}.png"
        crop.save(out_path, format="PNG")
        return out_path

    def _link_neighbor_tags(self, elements: list[ExtractionElement]) -> None:
        """Find spatially proximate tags and record their element_id hashes.

        Never records raw tag strings. Uses euclidean distance between bounding
        box centers in page coordinate units.
        """
        radius = self.settings.neighbor_distance_threshold
        for i, elem_i in enumerate(elements):
            if not elem_i.bbox or len(elem_i.bbox) < 4:
                continue
            center_ix = (elem_i.bbox[0] + elem_i.bbox[2]) / 2.0
            center_iy = (elem_i.bbox[1] + elem_i.bbox[3]) / 2.0

            neighbors: list[str] = []
            for j, elem_j in enumerate(elements):
                if i == j or not elem_j.bbox or len(elem_j.bbox) < 4:
                    continue
                center_jx = (elem_j.bbox[0] + elem_j.bbox[2]) / 2.0
                center_jy = (elem_j.bbox[1] + elem_j.bbox[3]) / 2.0

                dist = math.hypot(center_ix - center_jx, center_iy - center_jy)
                if dist <= radius and elem_j.element_id:
                    neighbors.append(elem_j.element_id)

            elem_i.neighbor_tag_ids = neighbors
