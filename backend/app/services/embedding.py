"""Local embedding provider abstraction.

The embedding model runs on the local Ollama instance — never an external API.
The abstraction keeps the knowledge-base logic decoupled from the concrete
embedding implementation so it can be replaced later.
"""

import logging
from abc import ABC, abstractmethod
from typing import Optional

import httpx

logger = logging.getLogger("app.embedding")


class EmbeddingError(Exception):
    """Embeddings could not be produced."""


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    async def embed(self, text: str) -> list[float]:
        return (await self.embed_many([text]))[0]

    async def aclose(self) -> None:
        pass

    def describe(self) -> dict:
        return {"provider": self.__class__.__name__}


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Embeddings via the local Ollama server (``/api/embed``)."""

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: float = 30.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout_seconds),
            transport=transport,
        )
        self._model = model

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        payload = {"model": self._model, "input": list(texts)}
        try:
            response = await self._client.post("/api/embed", json=payload)
        except httpx.TimeoutException as exc:
            raise EmbeddingError("Embedding request timed out") from exc
        except httpx.TransportError as exc:
            raise EmbeddingError(
                f"Ollama unreachable for embeddings: {exc.__class__.__name__}"
            ) from exc

        if response.status_code == 404:
            raise EmbeddingError(
                f"Embedding model '{self._model}' is not available locally"
            )
        if response.status_code != 200:
            raise EmbeddingError(
                f"Embedding request failed (HTTP {response.status_code})"
            )

        data = response.json()
        embeddings = data.get("embeddings")
        if not isinstance(embeddings, list) or not embeddings:
            raise EmbeddingError("Embedding response did not contain 'embeddings'")
        return embeddings

    async def aclose(self) -> None:
        await self._client.aclose()

    def describe(self) -> dict:
        return {"provider": "ollama", "model": self._model}
