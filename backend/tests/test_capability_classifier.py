"""Unit tests for the semantic capability classifier (deterministic, no network)."""

import asyncio

from app.services.capability_classifier import (
    CAPABILITY_EXEMPLARS,
    SemanticCapabilityClassifier,
)
from app.services.embedding import EmbeddingError, EmbeddingProvider

KNOWN_MISS = "Change the helper so it computes 21 times 2 and run it."


class StubEmbeddingProvider(EmbeddingProvider):
    """Maps each exemplar to its capability axis; test phrases via keywords."""

    AXES = {
        "coding": [1.0, 0.0, 0.0, 0.0],
        "document": [0.0, 1.0, 0.0, 0.0],
        "vision": [0.0, 0.0, 1.0, 0.0],
        "general": [0.0, 0.0, 0.0, 1.0],
    }

    def __init__(self) -> None:
        self.calls = 0
        self.batch_sizes: list[int] = []
        self.fail = False
        self._explicit = {
            text: label
            for label, texts in CAPABILITY_EXEMPLARS.items()
            for text in texts
        }
        self.exemplar_count = len(self._explicit)

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        self.calls += 1
        self.batch_sizes.append(len(texts))
        if self.fail:
            raise EmbeddingError("stub embedding failure")
        return [self._vector(text) for text in texts]

    def _vector(self, text: str) -> list[float]:
        label = self._explicit.get(text)
        if label is None:
            low = text.lower()
            if any(word in low for word in ("report", "document", "inspection")):
                label = "document"
            elif any(word in low for word in ("photo", "image", "handwritten")):
                label = "vision"
            elif any(word in low for word in ("code", "run", "bug", "helper")):
                label = "coding"
        if label is None:
            return [0.0, 0.0, 0.0, 0.0]
        return list(self.AXES[label])


def classify(message: str, provider: StubEmbeddingProvider | None = None, threshold: float = 0.55):
    provider = provider or StubEmbeddingProvider()
    classifier = SemanticCapabilityClassifier(provider, threshold=threshold)
    return asyncio.run(classifier.classify(message)), provider


def test_known_miss_phrase_is_an_exemplar():
    assert KNOWN_MISS in CAPABILITY_EXEMPLARS["coding"]


def test_coding_phrase_classifies_coding():
    result, _ = classify(KNOWN_MISS)
    assert result.task_type == "coding"
    assert result.confidence >= 0.55


def test_document_phrase_classifies_document():
    result, _ = classify("Compare the inspection report with the procedure.")
    assert result.task_type == "document"


def test_vision_phrase_classifies_vision():
    result, _ = classify("What does the handwritten note say?")
    assert result.task_type == "vision"


def test_unrelated_message_falls_back_to_general():
    result, _ = classify("Tell me a joke about the weather.")
    assert result.task_type == "general"
    assert "threshold" in result.reason


def test_match_reports_scores_and_runner_up():
    result, _ = classify(KNOWN_MISS)
    assert result.scores
    assert result.confidence == max(result.scores.values())
    assert result.runner_up and result.runner_up != result.task_type


def test_embedding_failure_degrades_to_general():
    provider = StubEmbeddingProvider()
    provider.fail = True
    result, _ = classify("anything at all", provider=provider)
    assert result.task_type == "general"
    assert "unavailable" in result.reason
    assert result.confidence == 0.0
    assert result.scores == {}


def test_exemplars_are_preloaded_once():
    provider = StubEmbeddingProvider()
    classifier = SemanticCapabilityClassifier(provider, threshold=0.55)

    async def run_twice():
        await classifier.classify(KNOWN_MISS)
        await classifier.classify("Compare the inspection report with the procedure.")

    asyncio.run(run_twice())
    # one exemplar batch + two message embeddings
    assert provider.calls == 3
    assert provider.batch_sizes.count(provider.exemplar_count) == 1
    assert provider.batch_sizes[0] == provider.exemplar_count
