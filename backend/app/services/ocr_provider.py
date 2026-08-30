"""Local OCR provider abstraction.

OCR runs entirely on this machine — never a cloud service and never over HTTP.
The abstraction keeps the multimodal pipeline decoupled from the concrete
engine so it can be replaced later. ``RapidOCREngine`` wraps the fully local
RapidOCR (ONNX runtime) implementation; ``FakeOCRProvider`` gives deterministic
results for tests and demos.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.schemas.multimodal import OCRRegion
from app.services.document_preparer import page_number_from_path

logger = logging.getLogger("app.ocr")


class OCRProviderError(Exception):
    """OCR could not be produced."""


class OCRProvider(ABC):
    @abstractmethod
    async def recognize(self, image_path: Path) -> list[OCRRegion]:
        """Return the recognized regions of one page image."""
        raise NotImplementedError

    def describe(self) -> dict:
        return {"provider": self.__class__.__name__}


class RapidOCREngine(OCRProvider):
    """Fully local OCR via RapidOCR (ONNX runtime). Engine is lazy-initialized."""

    def __init__(self) -> None:
        self._engine = None

    async def recognize(self, image_path: Path) -> list[OCRRegion]:
        result = await self._call(str(image_path))
        regions: list[OCRRegion] = []
        for item in result or []:
            try:
                box, text, confidence = item[0], str(item[1]), float(item[2])
                regions.append(
                    OCRRegion(
                        text=text,
                        bbox=self._flatten_bbox(box),
                        confidence=confidence,
                    )
                )
            except (IndexError, ValueError, TypeError):
                continue
        return regions

    async def _call(self, image_path: str):
        engine = await self._ensure_engine()
        try:
            result, _elapse = await asyncio.to_thread(engine, image_path)
            return result
        except Exception as exc:
            raise OCRProviderError(f"OCR failed: {exc.__class__.__name__}") from exc

    async def _ensure_engine(self):
        if self._engine is None:
            try:
                from rapidocr_onnxruntime import RapidOCR
            except ImportError as exc:
                raise OCRProviderError(
                    "RapidOCR is not installed (run the pipeline with OCR enabled)"
                ) from exc
            self._engine = await asyncio.to_thread(RapidOCR)
        return self._engine

    @staticmethod
    def _flatten_bbox(box) -> list[int]:
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        return [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]

    def describe(self) -> dict:
        return {"provider": "rapidocr", "engine": "rapidocr-onnxruntime"}


class FakeOCRProvider(OCRProvider):
    """Deterministic OCR for tests/demos: scripted text per page.

    The page number is read from the rendered image filename (``page_0001.png``).
    Pages without a scripted entry produce no text (treated as blank), and
    pages listed in ``fail_pages`` raise a clean OCR error.
    """

    def __init__(
        self,
        page_text: Optional[dict[int, str]] = None,
        fail_pages: Optional[set[int]] = None,
    ) -> None:
        self._page_text = dict(page_text or {})
        self._fail_pages = set(fail_pages or [])
        self.calls: list[dict] = []

    async def recognize(self, image_path: Path) -> list[OCRRegion]:
        image_path = Path(image_path)
        self.calls.append({"image": image_path.name})
        page = page_number_from_path(image_path)
        if page in self._fail_pages:
            raise OCRProviderError(f"OCR failed on page {page}")
        text = self._page_text.get(page, "")
        if not text:
            return []
        return [OCRRegion(text=text, bbox=[0, 0, 10, 10], confidence=0.99)]

    def describe(self) -> dict:
        return {"provider": "fake", "engine": "keyword-scripted"}
