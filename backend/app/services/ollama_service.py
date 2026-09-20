"""Client for the local Ollama server.

Sovereignty rule: this service must ONLY ever talk to the locally configured
Ollama endpoint (``OLLAMA_BASE_URL``). No external AI services are used.
"""

import asyncio
import base64
import json
import logging
import time
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger("app.ollama_service")


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


def normalize_tool_calls(raw: object) -> list[dict]:
    """Normalise Ollama native ``tool_calls`` to ``[{name, arguments, id}]``.

    Ollama emits ``arguments`` as an object, but some model templates emit a JSON
    string; both are accepted. Unparseable arguments become ``{}`` so the tool's
    own schema validation surfaces the problem and the agent can recover.
    """
    normalized: list[dict] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        function = item.get("function") if isinstance(item.get("function"), dict) else item
        name = function.get("name")
        arguments = function.get("arguments")
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except (ValueError, json.JSONDecodeError):
                arguments = {}
        if not isinstance(arguments, dict):
            arguments = {}
        if isinstance(name, str) and name:
            normalized.append(
                {"name": name, "arguments": arguments, "id": item.get("id")}
            )
    return normalized


class OllamaService:
    """Thin, async wrapper around the local Ollama HTTP API."""

    def __init__(
        self,
        base_url: str,
        default_model: str,
        timeout_seconds: float = 120.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        options: Optional[dict] = None,
        keep_alive: Optional[str] = "5m",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds
        # Model options (e.g. {"temperature": 0.0, "seed": 7} in benchmark mode)
        # merged into every generation call, so determinism is set in one place.
        self._options = dict(options) if options else {}
        # Ollama's own residency hint, sent on every request; "5m" reproduces
        # Ollama's default idle-unload behavior unchanged. See unload_and_wait()
        # for the explicit force-unload-now path used on a real model switch.
        self._keep_alive = keep_alive
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout_seconds),
            transport=transport,
        )

    def _with_options(self, payload: dict) -> dict:
        if self._options:
            payload["options"] = {**self._options, **payload.get("options", {})}
        return payload

    def _with_keep_alive(self, payload: dict) -> dict:
        if self._keep_alive is not None:
            payload["keep_alive"] = self._keep_alive
        return payload

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
        payload = self._with_options(self._with_keep_alive(payload))

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

    async def chat(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        tools: Optional[list[dict]] = None,
        format: Optional[str] = None,
    ) -> tuple[str, list[dict], str]:
        """Native chat completion via ``/api/chat`` with optional tool schemas.

        Returns ``(content, tool_calls, model_used)`` where ``tool_calls`` is a
        normalised list of ``{name, arguments, id}``. This is the path that lets
        the agent use Ollama's native tool calling instead of a hand-rolled JSON
        envelope.
        """
        model_name = (model or self.default_model).strip()
        if not model_name:
            raise OllamaRequestError("No model configured (set DEFAULT_MODEL).")

        payload: dict = {"model": model_name, "messages": messages, "stream": False}
        if tools:
            payload["tools"] = tools
        if format:
            payload["format"] = format
        payload = self._with_options(self._with_keep_alive(payload))

        try:
            response = await self._client.post("/api/chat", json=payload)
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

        message = data.get("message")
        if not isinstance(message, dict):
            raise OllamaRequestError(
                "Ollama chat response did not contain a 'message' object."
            )
        content = message.get("content")
        if not isinstance(content, str):
            content = "" if content is None else str(content)
        tool_calls = normalize_tool_calls(message.get("tool_calls"))
        model_used = data.get("model") or model_name
        return content, tool_calls, model_used

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
            # str(exc) embeds the absolute host path (an OSError's own
            # message format) — log it server-side only; this propagates
            # through VisionProviderError/MultimodalError/ToolError to the
            # model, which must never see internal filesystem layout.
            logger.error(
                "vision_image_read_failed",
                extra={"event": "vision_image_read_failed", "error": str(exc)},
            )
            raise OllamaRequestError("Cannot read image for vision") from exc

        payload = {
            "model": model_name,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False,
        }
        payload = self._with_options(self._with_keep_alive(payload))

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

    async def list_running_models(self) -> list[dict]:
        """Ollama's own ``/api/ps``: models currently resident in memory.

        This is the ground truth for VRAM residency — everything else (the
        resource scheduler's declared budgets, ``unload_and_wait``'s own POST)
        either causes or observes this state, never asserts it. Each entry
        carries at least ``name``/``model`` and a ``size`` in bytes, per
        Ollama's documented ``/api/ps`` response shape.
        """
        try:
            response = await self._client.get("/api/ps")
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError("Timed out listing running Ollama models.") from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailableError(
                f"Ollama is unreachable at {self.base_url}: {exc.__class__.__name__}"
            ) from exc

        if response.status_code != 200:
            raise OllamaRequestError(f"Ollama returned HTTP {response.status_code} for /api/ps.")

        try:
            data = response.json()
        except ValueError as exc:
            raise OllamaRequestError("Ollama returned an invalid (non-JSON) response.") from exc

        return list(data.get("models", []))

    async def unload_and_wait(self, model: str, timeout: float = 2.0) -> bool:
        """Force ``model`` out of VRAM now, and wait (bounded) until it's gone.

        Ollama evicts asynchronously, so a 200 from the unload request is not
        itself proof the memory is free — this polls ``/api/ps`` until the
        model is actually absent or ``timeout`` elapses. Returns whether it
        left within the deadline; never raises past a transport/API failure
        (best-effort — a stuck unload must never fail the job that's waiting
        on the next model).
        """
        model_name = (model or "").strip()
        if not model_name:
            return True
        payload = {"model": model_name, "keep_alive": 0}
        try:
            response = await self._client.post("/api/generate", json=payload)
            if response.status_code not in (200, 404):
                return False
        except (httpx.TimeoutException, httpx.TransportError):
            return False

        deadline = time.monotonic() + max(timeout, 0.0)
        while time.monotonic() < deadline:
            try:
                running = await self.list_running_models()
            except OllamaServiceError:
                return False
            names = {entry.get("name") or entry.get("model") for entry in running}
            if model_name not in names:
                return True
            await asyncio.sleep(0.2)
        return False

    async def aclose(self) -> None:
        await self._client.aclose()
