"""Semantic capability classifier.

Replaces the keyword ``TaskRouter`` with local-embedding nearest-exemplar
routing: a user message is embedded with the local embedding model and matched
against a curated exemplar set per capability (coding/document/vision). The
best label wins when its cosine similarity clears a threshold; otherwise the
message is ``general``.

The classifier degrades to ``general`` on any embedding failure — a job must
never fail because classification embeddings are unavailable.
"""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("app.classifier")

TASK_GENERAL = "general"
TASK_CODING = "coding"
TASK_DOCUMENT = "document"
TASK_VISION = "vision"

# Curated exemplars. "general" is a real class (conceptual Q&A / chit-chat) so a
# domain-vocabulary question is not captured by "document"; it is also the
# fallback when no class clears the threshold. Keep utterances short and
# intent-bearing.
CAPABILITY_EXEMPLARS: dict[str, list[str]] = {
    "coding": [
        "Change the helper so it computes 21 times 2 and run it.",
        "Run the code and tell me what it prints.",
        "Fix the bug in this function.",
        "Write a Python function that reads a CSV and returns the mean.",
        "Refactor the parser so it handles empty lines.",
        "Why does this loop go out of bounds?",
        "Add unit tests for the calculation module.",
        "Debug the failing script and explain the error.",
        "Implement a SQL query that joins the readings table.",
        "Write a shell command to find the largest files.",
        "Turn this pseudocode into working Python.",
        "Port this routine from JavaScript to Python.",
        "Translate this pseudocode into a working script.",
    ],
    "document": [
        "Compare the inspection report with the maintenance procedure.",
        "Summarize the attached vessel report.",
        "Create an approval note from the current and previous inspections.",
        "What does the nameplate say about the design pressure?",
        "Read the attached PDF and list the shell-course thicknesses.",
        "Produce a spreadsheet of the calculated corrosion rates.",
        "Extract the survey dates from these inspection reports.",
        "Build a short deck summarizing the findings for the review meeting.",
        "Which revision of the procedure applies to this inspection?",
        "Check the attached documents against the current standard.",
    ],
    "vision": [
        "What does the handwritten note on page 2 say?",
        "Read the gauge in this photo.",
        "Describe what is shown in this image.",
        "Look at the screenshot and tell me the error message.",
        "What is written on the attached nameplate image?",
    ],
    "general": [
        "Explain the difference between two standards.",
        "What does a technical term mean?",
        "Give me a high-level overview of a concept.",
        "Hello, what can you do?",
        "Tell me a joke.",
        "Who are you?",
        "What is the weather like today?",
    ],
}


def _cosine(a: list[float], b: list[float]) -> float:
    """Plain-Python cosine similarity; 0.0 for empty/mismatched/zero vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


class CapabilityClassification(BaseModel):
    """The classified capability for a user message."""

    task_type: str
    reason: str
    confidence: float
    runner_up: str = ""
    scores: dict[str, float] = Field(default_factory=dict)


class SemanticCapabilityClassifier:
    """Embedding nearest-exemplar classifier over the capability labels."""

    def __init__(
        self,
        embedding_provider,
        threshold: float = 0.55,
        exemplars: Optional[dict[str, list[str]]] = None,
    ) -> None:
        self._embedder = embedding_provider
        self._threshold = threshold
        self._exemplars = exemplars if exemplars is not None else CAPABILITY_EXEMPLARS
        self._labels = list(self._exemplars.keys())
        self._exemplar_vectors: dict[str, list[list[float]]] = {}
        self._lock = asyncio.Lock()

    async def preload(self) -> None:
        """Embed every exemplar once (idempotent, single batch, lock-guarded)."""
        if self._exemplar_vectors:
            return
        async with self._lock:
            if self._exemplar_vectors:
                return
            labels: list[str] = []
            texts: list[str] = []
            for label in self._labels:
                for text in self._exemplars[label]:
                    labels.append(label)
                    texts.append(text)
            vectors = await self._embedder.embed_many(texts)
            grouped: dict[str, list[list[float]]] = {label: [] for label in self._labels}
            for label, vector in zip(labels, vectors):
                grouped[label].append(list(vector))
            self._exemplar_vectors = grouped

    async def classify(self, message: str) -> CapabilityClassification:
        try:
            await self.preload()
            vector = await self._embedder.embed(message)
        except Exception as exc:  # degrade, never fail the job
            logger.warning(
                "capability_classifier_unavailable",
                extra={
                    "event": "capability_classifier_unavailable",
                    "error": exc.__class__.__name__,
                },
            )
            return CapabilityClassification(
                task_type=TASK_GENERAL,
                reason=(
                    f"classifier unavailable ({exc.__class__.__name__}); "
                    "defaulting to general"
                ),
                confidence=0.0,
            )

        scores = {
            label: max((_cosine(vector, exemplar) for exemplar in vectors), default=0.0)
            for label, vectors in self._exemplar_vectors.items()
        }
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        best_label, best_score = ranked[0] if ranked else (TASK_GENERAL, 0.0)
        runner_up = ranked[1][0] if len(ranked) > 1 else ""

        if best_score < self._threshold:
            return CapabilityClassification(
                task_type=TASK_GENERAL,
                reason=(
                    f"no capability matched above threshold {self._threshold:.2f} "
                    f"(best '{best_label}' at {best_score:.2f})"
                ),
                confidence=best_score,
                runner_up=best_label,
                scores=scores,
            )
        return CapabilityClassification(
            task_type=best_label,
            reason=(
                f"semantic match '{best_label}' at {best_score:.2f} "
                f"(runner-up '{runner_up}')"
            ),
            confidence=best_score,
            runner_up=runner_up,
            scores=scores,
        )
