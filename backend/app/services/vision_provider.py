"""Local vision provider abstraction.

The vision model is a local multimodal model served by the local Ollama server.
The model name comes from the model registry configuration — never hardcoded.
The provider stays independent of the Agent: it takes an image, an optional OCR
text context, a question, and the configured model, and returns structured
observations.
"""

import logging
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.schemas.multimodal import VisionPageResult
from app.services.document_preparer import page_number_from_path
from app.services.ollama_service import OllamaService, OllamaServiceError

logger = logging.getLogger("app.vision")

MAX_OCR_CONTEXT_CHARS = 3000


class VisionProviderError(Exception):
    """Vision analysis could not be produced."""


class VisionProvider(ABC):
    @abstractmethod
    async def analyze(
        self,
        image_path: Path,
        question: str,
        ocr_text: str,
        model: str,
    ) -> VisionPageResult:
        raise NotImplementedError

    def describe(self) -> dict:
        return {"provider": self.__class__.__name__}


class OllamaVisionProvider(VisionProvider):
    """Vision inference via the local Ollama server (multimodal model)."""

    def __init__(self, ollama_service: OllamaService) -> None:
        self._ollama = ollama_service

    async def analyze(
        self,
        image_path: Path,
        question: str,
        ocr_text: str,
        model: str,
    ) -> VisionPageResult:
        start = time.monotonic()
        logger.info(
            "model_call_started",
            extra={"event": "model_call_started", "model": model},
        )
        prompt = _build_vision_prompt(question, ocr_text)
        try:
            response, _used = await self._ollama.generate_with_image(
                prompt, model=model, image_path=image_path
            )
        except OllamaServiceError as exc:
            logger.error(
                "model_call_completed",
                extra={
                    "event": "model_call_completed",
                    "model": model,
                    "status": "failed",
                    "duration_ms": int((time.monotonic() - start) * 1000),
                    "error": str(exc),
                },
            )
            raise VisionProviderError(str(exc)) from exc
        logger.info(
            "model_call_completed",
            extra={
                "event": "model_call_completed",
                "model": model,
                "status": "completed",
                "duration_ms": int((time.monotonic() - start) * 1000),
            },
        )
        observations = _split_observations(response)
        page = page_number_from_path(image_path) or 1
        return VisionPageResult(
            page=page, text=response, observations=observations, model=model
        )

    def describe(self) -> dict:
        return {"provider": "ollama", "model": "multimodal (registry-configured)"}


class FakeVisionProvider(VisionProvider):
    """Deterministic vision provider for tests/demos: scripted observations.

    Observations are keyed by page number (read from the rendered image
    filename). Pages without a scripted entry fall back to ``default`` when
    provided, otherwise produce no observations.
    """

    def __init__(
        self,
        observations_by_page: Optional[dict[int, list[str]]] = None,
        default: Optional[list[str]] = None,
        model: str = "vision-model",
    ) -> None:
        self._by_page = dict(observations_by_page or {})
        self._default = default
        self._model = model
        self.calls: list[dict] = []

    async def analyze(
        self,
        image_path: Path,
        question: str,
        ocr_text: str,
        model: str,
    ) -> VisionPageResult:
        page = page_number_from_path(image_path) or 1
        obs = self._by_page.get(page)
        if obs is None and self._default is not None:
            obs = self._default
        observations = [str(o) for o in obs] if obs is not None else []
        self.calls.append(
            {"page": page, "question": question, "ocr_text": ocr_text, "model": model}
        )
        return VisionPageResult(
            page=page,
            text="\n".join(observations),
            observations=observations,
            model=model or self._model,
        )

    def describe(self) -> dict:
        return {"provider": "fake", "model": self._model}


def _build_vision_prompt(question: str, ocr_text: str) -> str:
    lines = [
        "You are a local vision assistant analyzing one page of a document for the "
        "Sovereign On-Premise AI Workbench.",
        f"Question: {question}",
    ]
    if ocr_text and ocr_text.strip():
        lines.append(
            "OCR text extracted from this page (use it as context):\n"
            + ocr_text[:MAX_OCR_CONTEXT_CHARS]
        )
    lines.append("Describe only what is actually visible. Do not invent observations.")
    return "\n".join(lines)


def _split_observations(text: str) -> list[str]:
    observations = [
        line.strip("-•*").strip() for line in (text or "").splitlines() if line.strip()
    ]
    return [o for o in observations if o]
