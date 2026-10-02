"""Client for the local Ollama server.

Sovereignty rule: this service must ONLY ever talk to the locally configured
Ollama endpoint (``OLLAMA_BASE_URL``). No external AI services are used.
"""

import asyncio
import base64
import json
import logging
import re
import time
from pathlib import Path
from typing import Optional, Union

import httpx

logger = logging.getLogger("app.ollama_service")


class OllamaServiceError(Exception):
    """Base class for Ollama-related failures."""


class OllamaUnavailableError(OllamaServiceError):
    """Ollama server could not be reached (connection / transport failure)."""


class OllamaTimeoutError(OllamaServiceError):
    """Ollama request exceeded a deadline the caller configured."""


class OllamaModelNotFoundError(OllamaServiceError):
    """The configured model does not exist on the Ollama server."""


class OllamaRequestError(OllamaServiceError):
    """Ollama returned a non-success response or an invalid payload."""


class OllamaContextOverflowError(OllamaRequestError):
    """The prompt filled the model's context window.

    A *subclass* of :class:`OllamaRequestError`, so every existing handler that
    catches ``OllamaServiceError`` or ``OllamaRequestError`` keeps working; the
    agent loop catches this specific type to trim history and retry rather than
    failing the job on what is a recoverable condition.

    Two shapes reach this: a non-200 whose body or numbers say the input is too
    long, and a 200 whose ``done_reason`` is ``length`` with nothing generated —
    Ollama truncates an oversized prompt silently, so the failure is usually the
    latter, not the former.
    """


class OllamaGenerationLimitError(OllamaRequestError):
    """Generation stopped at its own cap with nothing emitted.

    A sibling of :class:`OllamaContextOverflowError`, not a subclass of it, and
    deliberately so: the two share a shape (``done_reason: "length"`` with no
    output) but need opposite responses. Here the prompt fitted the window, so
    trimming history cannot change the outcome and a retry costs a whole model
    call to reproduce the same empty result. The observed cause is a hybrid
    reasoning model that spent its entire ``num_predict`` budget in its thinking
    pass — the fix is to stop retrying it (and, where the roster declares it,
    to disable thinking for that model), not to trim the prompt.
    """


# Fraction of the window a prompt must fill for a ``done_reason: length`` stall
# to be read as a *context* overflow. Below it the clamp in ``_clamp_num_predict``
# gave generation real room and the model still emitted nothing, which is a
# generation-side limit that trimming cannot fix. Kept in step with
# ``ollama_prompt_trim_ratio``: a prompt under this is one the proactive trim
# would not have touched either, so retrying it would send the same request.
_PROMPT_FULL_RATIO = 0.75


# Secondary signal only (see OllamaContextOverflowError): the numeric check —
# our own token estimate against the configured window, and done_reason=length —
# is what carries the classification, because Ollama truncates far more often
# than it errors and the truncation path returns 200.
_CONTEXT_OVERFLOW_MARKERS = (
    "context length",
    "context size",
    "input length exceeds",
    "exceeds the context",
    "too large for model",
    "prompt is too long",
    "prompt too long",
)


def _is_context_overflow_body(text: str) -> bool:
    lowered = (text or "").lower()
    return any(marker in lowered for marker in _CONTEXT_OVERFLOW_MARKERS)


def estimate_prompt_tokens(
    messages: Optional[list[dict]] = None,
    tools: Optional[list[dict]] = None,
    prompt: Optional[str] = None,
) -> int:
    """Rough token count of everything a model must read before generating.

    ~4 characters per token. The ``tools`` array is counted because it is a
    large fixed cost (roughly half the baseline prompt with ~13 tools) that the
    message list does not show. Shared with the agent loop so the pre-call trim
    decides "too big" on the same arithmetic the service uses to size
    ``num_predict``.
    """
    chars = 0
    for message in messages or []:
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if isinstance(content, str):
            chars += len(content)
    if isinstance(prompt, str):
        chars += len(prompt)
    if tools:
        try:
            chars += len(json.dumps(tools))
        except (TypeError, ValueError):
            pass
    return chars // 4


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


def rescue_tool_call_from_raw_error(
    error_body: str, tools: Optional[list[dict]] = None
) -> list[dict]:
    """Recover tool calls when Ollama's native parser returns HTTP 500 'error parsing tool call: raw=...'.

    When local models generate large JSON payloads (such as extracted table rows)
    or subtle schema variations, Ollama's Go parser may fail to unmarshal into its
    internal struct and return HTTP 500 embedding the model's generation in `raw='...'`.
    This helper recovers and normalises those tool calls.
    """
    if not isinstance(error_body, str) or "error parsing tool call" not in error_body:
        return []

    raw_str = ""
    try:
        data = json.loads(error_body)
        if isinstance(data, dict):
            err_msg = data.get("error", "")
        else:
            err_msg = error_body
    except Exception:
        err_msg = error_body

    match = re.search(r"raw=(?:'|\")(.*)(?:'|\")\s*\}?$", err_msg, re.DOTALL)
    if match:
        raw_str = match.group(1).strip()
    else:
        start = err_msg.find("{")
        end = err_msg.rfind("}")
        if start != -1 and end > start:
            raw_str = err_msg[start : end + 1]

    if not raw_str:
        return []

    parsed = None
    candidates = [
        raw_str,
        raw_str.encode("utf-8").decode("unicode_escape", errors="ignore"),
        raw_str.replace('\\"', '"').replace("\\n", "\n"),
    ]
    for cand in candidates:
        try:
            parsed = json.loads(cand)
            if parsed:
                break
        except Exception:
            pass

    if parsed is None:
        start = raw_str.find("{")
        end = raw_str.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(raw_str[start : end + 1])
            except Exception:
                pass

    if not parsed:
        return []

    items = parsed if isinstance(parsed, list) else [parsed]
    raw_tool_calls: list[dict] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if isinstance(name, str) and name:
            args = item.get("arguments")
            if args is None:
                args = item.get("parameters")
            if not isinstance(args, dict):
                args = {k: v for k, v in item.items() if k not in ("name", "id")}
            raw_tool_calls.append({"name": name, "arguments": args, "id": item.get("id")})
        else:
            matched_tool = None
            if tools:
                for t in tools:
                    fn = t.get("function") if isinstance(t.get("function"), dict) else t
                    t_name = fn.get("name") if isinstance(fn, dict) else None
                    props = fn.get("parameters", {}).get("properties", {}) if isinstance(fn, dict) else {}
                    if t_name and len(set(props) & set(item)) >= 2:
                        matched_tool = t_name
                        break
                if not matched_tool and len(tools) == 1:
                    fn = tools[0].get("function") if isinstance(tools[0].get("function"), dict) else tools[0]
                    matched_tool = fn.get("name") if isinstance(fn, dict) else None
            if not matched_tool:
                if "sections" in item or ("type" in item and "filename" in item):
                    matched_tool = "document_generation"
            if matched_tool:
                raw_tool_calls.append({"name": matched_tool, "arguments": item, "id": None})

    return normalize_tool_calls(raw_tool_calls)


class OllamaService:
    """Thin, async wrapper around the local Ollama HTTP API."""

    def __init__(
        self,
        base_url: str,
        default_model: str,
        timeout_seconds: Optional[float] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        options: Optional[dict] = None,
        keep_alive: Optional[str] = "5m",
        model_options: Optional[dict[str, dict]] = None,
        min_num_predict: int = 512,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds
        # Model options (e.g. {"temperature": 0.0, "seed": 7} in benchmark mode)
        # merged into every generation call, so determinism is set in one place.
        self._options = dict(options) if options else {}
        # Per-model overrides, keyed by model name (from the registry's
        # ``model_options()``). A model whose KV cache is unusually cheap or
        # expensive gets its own window here rather than the global default.
        self._model_options = dict(model_options) if model_options else {}
        # Floor for the per-call num_predict clamp. Below this a reasoning model
        # spends the whole budget thinking and returns empty content, which is
        # worse than a truncated answer.
        self._min_num_predict = max(int(min_num_predict), 1)
        # Ollama's own residency hint, sent on every request; "5m" reproduces
        # Ollama's default idle-unload behavior unchanged. See unload_and_wait()
        # for the explicit force-unload-now path used on a real model switch.
        self._keep_alive = keep_alive
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            # None means wait as long as the model takes. A local model on CPU can
            # spend minutes on one tool-calling turn, and a cap that fires
            # mid-generation loses the whole job, so there is no default deadline;
            # a caller that needs one passes timeout_seconds explicitly.
            timeout=(
                httpx.Timeout(timeout_seconds) if timeout_seconds is not None else None
            ),
            transport=transport,
        )

    def _timeout_note(self) -> str:
        """Suffix naming the deadline for a timeout error, empty when unbounded."""
        if self.timeout_seconds is None:
            return ""
        return f" after {self.timeout_seconds:g}s"

    @staticmethod
    def _estimate_prompt_tokens(payload: dict) -> int:
        return estimate_prompt_tokens(
            messages=payload.get("messages"),
            tools=payload.get("tools"),
            prompt=payload.get("prompt"),
        )

    def num_ctx_for(self, model_name: str) -> Optional[int]:
        """The context window this model will actually be run at, if known.

        Exposed so the agent loop can size its pre-call history trim against the
        same window the service will pass to Ollama, rather than guessing.
        """
        options = {
            **self._options,
            **self._model_options.get((model_name or "").strip(), {}),
        }
        num_ctx = options.get("num_ctx")
        return num_ctx if isinstance(num_ctx, int) and num_ctx > 0 else None

    def _effective_options(self, payload: dict, model_name: str) -> dict:
        """Global options, then this model's own, then the caller's.

        Later layers win. Only explicitly-declared per-model options appear in
        ``model_options``, so they override the global defaults rather than
        restating them.
        """
        options = {**self._options, **self._model_options.get(model_name, {})}
        options.update(payload.get("options", {}))
        return options

    def _clamp_num_predict(self, options: dict, payload: dict) -> dict:
        """Bound generation to the room actually left in this model's window.

        The window is a per-model value but the prompt length is only known at
        call time, so a fixed ``num_predict`` cannot by itself prevent a
        generation-side overflow. Floored at ``min_num_predict`` so a tight
        window still leaves a reasoning model room to answer at all.
        """
        num_ctx = options.get("num_ctx")
        num_predict = options.get("num_predict")
        if not isinstance(num_ctx, int) or num_ctx <= 0:
            return options
        if not isinstance(num_predict, int) or num_predict <= 0:
            return options
        room = num_ctx - self._estimate_prompt_tokens(payload)
        options["num_predict"] = max(min(num_predict, room), self._min_num_predict)
        return options

    def _with_options(self, payload: dict, model_name: str) -> dict:
        if self._options or self._model_options:
            options = self._effective_options(payload, model_name)
            if options:
                payload["options"] = self._clamp_num_predict(options, payload)
        return payload

    def _with_keep_alive(self, payload: dict) -> dict:
        if self._keep_alive is not None:
            payload["keep_alive"] = self._keep_alive
        return payload

    def _raise_for_status(self, response: httpx.Response, model_name: str, payload: dict) -> None:
        """Raise the right error for a non-200, keeping Ollama's own words.

        The body is included in the message because it is where the real reason
        lives — dropping it is what made the original HTTP 500 undiagnosable
        from the app without opening Ollama's server log.
        """
        if response.status_code == 404:
            raise OllamaModelNotFoundError(
                f"Model '{model_name}' is not available on the Ollama server at {self.base_url}."
            )
        if response.status_code != 200:
            body = (response.text or "")[:400]
            if self._looks_like_overflow(response.status_code, body, payload):
                raise OllamaContextOverflowError(
                    f"Ollama context window exceeded for model '{model_name}': {body}"
                )
            raise OllamaRequestError(
                f"Ollama returned HTTP {response.status_code} for model "
                f"'{model_name}'. {body}"
            )

    def _looks_like_overflow(self, status_code: int, body: str, payload: dict) -> bool:
        """Whether a failed request is best explained by the prompt length."""
        if _is_context_overflow_body(body):
            return True
        # Numeric signal: our own estimate already fills this model's window, so
        # a server error is more likely the prompt than a distinct fault. This is
        # a heuristic, and the cost of a false positive is one wasted retry, not
        # a wrong result.
        if status_code >= 500:
            num_ctx = payload.get("options", {}).get("num_ctx")
            if isinstance(num_ctx, int) and num_ctx > 0:
                return self._estimate_prompt_tokens(payload) >= num_ctx
        return False

    @staticmethod
    def _raise_if_generation_hit_the_limit(
        data: dict, model_name: str, payload: dict
    ) -> None:
        """Turn a silent truncation into a named, correctly-classified error.

        Ollama answers 200 with ``done_reason: "length"`` and nothing generated
        when generation stopped before anything was emitted. Two different
        failures look like this and they need opposite responses, so the
        classifier uses the prompt's own token count rather than the shape:

        - the prompt filled the window (Ollama truncates it silently and
          ``_clamp_num_predict`` left generation no room) — trimming history is
          the fix, so this is a recoverable
          :class:`OllamaContextOverflowError`;
        - the prompt sat well inside the window and generation still emitted
          nothing — a reasoning model that spent its whole budget thinking.
          Trimming cannot help, so this is a
          :class:`OllamaGenerationLimitError` and the job fails naming the cause
          instead of paying for a retry that must reproduce it.

        When the window is unknown (no ``num_ctx`` configured) the prompt cannot
        be judged, so the recoverable classification is kept.
        """
        if data.get("done_reason") != "length":
            return
        prompt_tokens = data.get("prompt_eval_count")
        num_ctx = (payload.get("options") or {}).get("num_ctx")
        detail = (
            f"done_reason=length, prompt_eval_count={prompt_tokens}, "
            f"eval_count={data.get('eval_count')}, num_ctx={num_ctx}"
        )
        if (
            isinstance(num_ctx, int)
            and num_ctx > 0
            and isinstance(prompt_tokens, int)
            and prompt_tokens < num_ctx * _PROMPT_FULL_RATIO
        ):
            raise OllamaGenerationLimitError(
                f"Model '{model_name}' generated no output within its generation "
                f"budget and the prompt fitted the window ({detail}), so trimming "
                "history cannot help. A reasoning model that spends its whole "
                "budget thinking produces exactly this; disable thinking for the "
                "model or give it more room to answer."
            )
        raise OllamaContextOverflowError(
            f"Ollama stopped at the context limit for model '{model_name}' "
            f"({detail}, no output generated). The prompt filled the window."
        )

    @staticmethod
    def _log_token_counts(data: dict, model_name: str) -> None:
        """Record Ollama's own token accounting for this call.

        This is the signal that shows a window filling up turn by turn, and how
        a prompt-size change is proved to have helped.
        """
        logger.info(
            "ollama_generation_completed",
            extra={
                "event": "ollama_generation_completed",
                "model": data.get("model") or model_name,
                "prompt_eval_count": data.get("prompt_eval_count"),
                "eval_count": data.get("eval_count"),
                "done_reason": data.get("done_reason"),
            },
        )

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        format: Optional[Union[str, dict]] = None,
    ) -> tuple[str, str]:
        """Send a prompt to Ollama's ``/api/generate`` endpoint.

        Returns ``(response_text, model_used)``. The model name echoed by Ollama
        is returned when available, otherwise the requested model name.
        ``format`` may be ``"json"`` to request structured JSON output, or a JSON
        Schema object to *constrain* generation to that shape (Ollama's
        structured outputs) — which is what makes a small model usable for the
        job plan: the fields must appear, rather than being asked for in prose.
        """
        model_name = (model or self.default_model).strip()
        if not model_name:
            raise OllamaRequestError("No model configured (set DEFAULT_MODEL).")

        payload = {"model": model_name, "prompt": prompt, "stream": False}
        if format:
            payload["format"] = format
        payload = self._with_options(self._with_keep_alive(payload), model_name)

        try:
            response = await self._client.post("/api/generate", json=payload)
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                f"Ollama request timed out{self._timeout_note()}"
            ) from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailableError(
                f"Ollama is unreachable at {self.base_url}: {exc.__class__.__name__}"
            ) from exc

        self._raise_for_status(response, model_name, payload)

        try:
            data = response.json()
        except ValueError as exc:
            raise OllamaRequestError("Ollama returned an invalid (non-JSON) response.") from exc

        response_text = data.get("response")
        if not isinstance(response_text, str) or not response_text.strip():
            self._raise_if_generation_hit_the_limit(data, model_name, payload)
            raise OllamaRequestError("Ollama response did not contain a 'response' field.")

        self._log_token_counts(data, model_name)
        model_used = data.get("model") or model_name
        return response_text, model_used

    async def chat(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        tools: Optional[list[dict]] = None,
        format: Optional[Union[str, dict]] = None,
        think: Optional[bool] = None,
    ) -> tuple[str, list[dict], str]:
        """Native chat completion via ``/api/chat`` with optional tool schemas.

        Returns ``(content, tool_calls, model_used)`` where ``tool_calls`` is a
        normalised list of ``{name, arguments, id}``. This is the path that lets
        the agent use Ollama's native tool calling instead of a hand-rolled JSON
        envelope.

        ``format`` may carry a JSON Schema (Ollama's structured outputs) to
        constrain the response to that shape. ``think=False`` disables a hybrid
        reasoning model's thinking pass, which for the one-shot planner call is
        most of the latency (measured 12.6s -> 3.3s on ``qwen3:1.7b``) and
        nothing of the answer.
        """
        model_name = (model or self.default_model).strip()
        if not model_name:
            raise OllamaRequestError("No model configured (set DEFAULT_MODEL).")

        payload: dict = {"model": model_name, "messages": messages, "stream": False}
        if tools:
            payload["tools"] = tools
        if format:
            payload["format"] = format
        if think is not None:
            payload["think"] = think
        payload = self._with_options(self._with_keep_alive(payload), model_name)

        try:
            response = await self._client.post("/api/chat", json=payload)
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                f"Ollama request timed out{self._timeout_note()}"
            ) from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailableError(
                f"Ollama is unreachable at {self.base_url}: {exc.__class__.__name__}"
            ) from exc

        if response.status_code == 500 and "error parsing tool call" in response.text:
            rescued_calls = rescue_tool_call_from_raw_error(response.text, tools)
            if rescued_calls:
                logger.warning(
                    "ollama_tool_call_rescued_from_500",
                    extra={
                        "event": "ollama_tool_call_rescued_from_500",
                        "model": model_name,
                        "tool_calls_count": len(rescued_calls),
                    },
                )
                return "", rescued_calls, model_name

        self._raise_for_status(response, model_name, payload)

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
        if not tool_calls and not content.strip():
            self._raise_if_generation_hit_the_limit(data, model_name, payload)
        self._log_token_counts(data, model_name)
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
        payload = self._with_options(self._with_keep_alive(payload), model_name)

        try:
            response = await self._client.post("/api/generate", json=payload)
        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                f"Ollama request timed out{self._timeout_note()}"
            ) from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailableError(
                f"Ollama is unreachable at {self.base_url}: {exc.__class__.__name__}"
            ) from exc

        self._raise_for_status(response, model_name, payload)

        try:
            data = response.json()
        except ValueError as exc:
            raise OllamaRequestError("Ollama returned an invalid (non-JSON) response.") from exc

        response_text = data.get("response")
        if not isinstance(response_text, str) or not response_text.strip():
            self._raise_if_generation_hit_the_limit(data, model_name, payload)
            raise OllamaRequestError("Ollama response did not contain a 'response' field.")

        self._log_token_counts(data, model_name)
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
