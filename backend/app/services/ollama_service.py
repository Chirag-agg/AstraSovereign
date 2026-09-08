"""Client for the local Ollama server.

Sovereignty rule: this service must ONLY ever talk to the locally configured
Ollama endpoint (``OLLAMA_BASE_URL``). No external AI services are used.
"""

import base64
from pathlib import Path
from typing import Optional

import httpx


class OllamaServiceError(Exception):
    """Base class for Ollama-related failures."""


class OllamaUnavailableError(OllamaServiceError):
    """Ollama server could not be reached (connection / transport failure)."""


class OllamaTimeoutError(OllamaServiceError):
    """Ollama request exceeded the configured timeout."""


class OllamaModelNotFoundError(OllamaServiceError):
    """The configured model does not exist on the Ollama server."""


class OllamaRequestError(OllamaServiceError):
    """Ollama returned a non-success response or an invalid payload."""


class OllamaService:
    """Thin, async wrapper around the local Ollama HTTP API."""

    def __init__(
        self,
        base_url: str,
        default_model: str,
        timeout_seconds: float = 120.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout_seconds),
            transport=transport,
        )

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        format: Optional[str] = None,
    ) -> tuple[str, str]:
        """Send a prompt to Ollama's ``/api/generate`` endpoint.

        Returns ``(response_text, model_used)``. The model name echoed by Ollama
        is returned when available, otherwise the requested model name.
        ``format`` may be ``"json"`` to request structured JSON output.
        """
        model_name = (model or self.default_model).strip()
        if not model_name:
            raise OllamaRequestError("No model configured (set DEFAULT_MODEL).")

        payload = {"model": model_name, "prompt": prompt, "stream": False}
        if format:
            payload["format"] = format

        try:
            response = await self._client.post("/api/generate", json=payload)
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                f"Ollama request timed out after {self.timeout_seconds}s"
            ) from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailableError(
                f"Ollama is unreachable at {self.base_url}: {exc.__class__.__name__}"
            ) from exc

        if response.status_code == 404:
            raise OllamaModelNotFoundError(
                f"Model '{model_name}' is not available on the Ollama server at {self.base_url}."
            )
        if response.status_code != 200:
            raise OllamaRequestError(
                f"Ollama returned HTTP {response.status_code} for model '{model_name}'."
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise OllamaRequestError("Ollama returned an invalid (non-JSON) response.") from exc

        response_text = data.get("response")
        if not isinstance(response_text, str) or not response_text.strip():
            raise OllamaRequestError("Ollama response did not contain a 'response' field.")

        model_used = data.get("model") or model_name
        return response_text, model_used

    async def generate_with_image(
        self,
        prompt: str,
        model: str,
        image_path: Path,
    ) -> tuple[str, str]:
        """Send a prompt plus a local image to a multimodal model via Ollama.

        The image is base64-encoded and posted to the local ``/api/generate``
        endpoint only — never to any external service. Returns
        ``(response_text, model_used)``.
        """
        model_name = (model or "").strip()
        if not model_name:
            raise OllamaRequestError("No vision model configured.")
        try:
            image_b64 = base64.b64encode(Path(image_path).read_bytes()).decode("utf-8")
        except OSError as exc:
            raise OllamaRequestError(f"Cannot read image for vision: {exc}") from exc

        payload = {
            "model": model_name,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False,
        }

        try:
            response = await self._client.post("/api/generate", json=payload)
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                f"Ollama request timed out after {self.timeout_seconds}s"
            ) from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailableError(
                f"Ollama is unreachable at {self.base_url}: {exc.__class__.__name__}"
            ) from exc

        if response.status_code == 404:
            raise OllamaModelNotFoundError(
                f"Model '{model_name}' is not available on the Ollama server at {self.base_url}."
            )
        if response.status_code != 200:
            raise OllamaRequestError(
                f"Ollama returned HTTP {response.status_code} for model '{model_name}'."
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise OllamaRequestError("Ollama returned an invalid (non-JSON) response.") from exc

        response_text = data.get("response")
        if not isinstance(response_text, str) or not response_text.strip():
            raise OllamaRequestError("Ollama response did not contain a 'response' field.")

        model_used = data.get("model") or model_name
        return response_text, model_used

    async def list_models(self) -> list[str]:
        """Return the model names currently available on the local Ollama server."""
        try:
            response = await self._client.get("/api/tags")
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError("Timed out listing Ollama models.") from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailableError(
                f"Ollama is unreachable at {self.base_url}: {exc.__class__.__name__}"
            ) from exc

        if response.status_code != 200:
            raise OllamaRequestError(f"Ollama returned HTTP {response.status_code} for /api/tags.")

        try:
            data = response.json()
        except ValueError as exc:
            raise OllamaRequestError("Ollama returned an invalid (non-JSON) response.") from exc

        return [model.get("name") for model in data.get("models", [])]

    async def aclose(self) -> None:
        await self._client.aclose()
