import asyncio
import json

import httpx
import pytest

from app.services.ollama_service import (
    OllamaContextOverflowError,
    OllamaGenerationLimitError,
    OllamaModelNotFoundError,
    OllamaRequestError,
    OllamaService,
    OllamaServiceError,
    OllamaTimeoutError,
    OllamaUnavailableError,
)


def make_service(handler, default_model="test-model", options=None):
    return OllamaService(
        base_url="http://ollama.test",
        default_model=default_model,
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
        options=options,
    )


def test_generate_success():
    async def scenario():
        def handler(request):
            return httpx.Response(
                200,
                json={"response": "mock answer", "model": "test-model"},
            )

        service = make_service(handler)
        try:
            text, model = await service.generate("hello")
            assert text == "mock answer"
            assert model == "test-model"
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_no_model_configured():
    async def scenario():
        service = make_service(lambda r: httpx.Response(200, json={"response": "x"}), default_model="")
        try:
            with pytest.raises(OllamaRequestError):
                await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_ollama_unavailable():
    async def scenario():
        def handler(request):
            raise httpx.ConnectError("connection refused")

        service = make_service(handler)
        try:
            with pytest.raises(OllamaUnavailableError):
                await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_timeout():
    async def scenario():
        def handler(request):
            raise httpx.ReadTimeout("timed out")

        service = make_service(handler)
        try:
            with pytest.raises(OllamaTimeoutError):
                await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_model_not_found():
    async def scenario():
        def handler(request):
            return httpx.Response(404, json={"error": "model not found"})

        service = make_service(handler)
        try:
            with pytest.raises(OllamaModelNotFoundError):
                await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_invalid_payload():
    async def scenario():
        def handler(request):
            return httpx.Response(200, json={"unexpected": "shape"})

        service = make_service(handler)
        try:
            with pytest.raises(OllamaRequestError):
                await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_internal_error():
    async def scenario():
        def handler(request):
            return httpx.Response(500, json={"error": "boom"})

        service = make_service(handler)
        try:
            with pytest.raises(OllamaRequestError):
                await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_list_models():
    async def scenario():
        def handler(request):
            return httpx.Response(
                200,
                json={"models": [{"name": "a"}, {"name": "b"}]},
            )

        service = make_service(handler)
        try:
            assert await service.list_models() == ["a", "b"]
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_omits_options_by_default():
    async def scenario():
        def handler(request):
            assert "options" not in json.loads(request.content)
            return httpx.Response(200, json={"response": "ok", "model": "test-model"})

        service = make_service(handler)
        try:
            await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_includes_bench_options():
    async def scenario():
        def handler(request):
            assert json.loads(request.content)["options"] == {
                "temperature": 0.0,
                "seed": 7,
            }
            return httpx.Response(200, json={"response": "ok", "model": "test-model"})

        service = make_service(handler, options={"temperature": 0.0, "seed": 7})
        try:
            await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_chat_includes_bench_options():
    async def scenario():
        def handler(request):
            payload = json.loads(request.content)
            assert payload["options"] == {"temperature": 0.0, "seed": 7}
            return httpx.Response(
                200, json={"message": {"content": "ok"}, "model": "test-model"}
            )

        service = make_service(handler, options={"temperature": 0.0, "seed": 7})
        try:
            await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_sends_default_keep_alive():
    async def scenario():
        def handler(request):
            assert json.loads(request.content)["keep_alive"] == "5m"
            return httpx.Response(200, json={"response": "ok", "model": "test-model"})

        service = make_service(handler)
        try:
            await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_chat_sends_configured_keep_alive():
    async def scenario():
        def handler(request):
            assert json.loads(request.content)["keep_alive"] == "10m"
            return httpx.Response(
                200, json={"message": {"content": "ok"}, "model": "test-model"}
            )

        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5.0,
            transport=httpx.MockTransport(handler),
            keep_alive="10m",
        )
        try:
            await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_with_image_sends_keep_alive(tmp_path):
    async def scenario():
        def handler(request):
            assert json.loads(request.content)["keep_alive"] == "5m"
            return httpx.Response(200, json={"response": "ok", "model": "vision-model"})

        image = tmp_path / "img.png"
        image.write_bytes(b"fake-png-bytes")
        service = make_service(handler)
        try:
            await service.generate_with_image("describe", "vision-model", image)
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_generate_with_image_missing_file_does_not_leak_the_path(tmp_path):
    """A missing/unreadable image raises an OSError whose own message embeds
    the absolute host path — that must never reach the model (it propagates
    through VisionProviderError/MultimodalError/ToolError to the agent)."""

    async def scenario():
        def handler(request):
            raise AssertionError("must not reach Ollama: the read fails first")

        missing = tmp_path / "workspaces" / "user-001" / "job-abc" / "page_1.png"
        service = make_service(handler)
        try:
            with pytest.raises(OllamaRequestError) as excinfo:
                await service.generate_with_image("describe", "vision-model", missing)
        finally:
            await service.aclose()
        message = str(excinfo.value)
        assert str(missing) not in message
        assert "user-001" not in message

    asyncio.run(scenario())


def test_keep_alive_omitted_when_none():
    async def scenario():
        def handler(request):
            assert "keep_alive" not in json.loads(request.content)
            return httpx.Response(200, json={"response": "ok", "model": "test-model"})

        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5.0,
            transport=httpx.MockTransport(handler),
            keep_alive=None,
        )
        try:
            await service.generate("hello")
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_list_running_models():
    async def scenario():
        def handler(request):
            assert request.url.path == "/api/ps"
            return httpx.Response(
                200,
                json={"models": [{"name": "qwen2.5-coder:7b", "size": 4_000_000_000}]},
            )

        service = make_service(handler)
        try:
            running = await service.list_running_models()
            assert running == [{"name": "qwen2.5-coder:7b", "size": 4_000_000_000}]
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_unload_and_wait_sends_zero_keep_alive_and_no_prompt():
    async def scenario():
        calls = []

        def handler(request):
            if request.url.path == "/api/generate":
                payload = json.loads(request.content)
                calls.append(payload)
                assert payload == {"model": "llama3.1:latest", "keep_alive": 0}
                return httpx.Response(200, json={})
            if request.url.path == "/api/ps":
                return httpx.Response(200, json={"models": []})
            return httpx.Response(404)

        service = make_service(handler)
        try:
            result = await service.unload_and_wait("llama3.1:latest", timeout=1.0)
            assert result is True
            assert len(calls) == 1
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_unload_and_wait_polls_until_model_leaves():
    async def scenario():
        ps_calls = {"count": 0}

        def handler(request):
            if request.url.path == "/api/generate":
                return httpx.Response(200, json={})
            if request.url.path == "/api/ps":
                ps_calls["count"] += 1
                # present for the first two polls, gone on the third
                if ps_calls["count"] < 3:
                    return httpx.Response(200, json={"models": [{"name": "coder"}]})
                return httpx.Response(200, json={"models": []})
            return httpx.Response(404)

        service = make_service(handler)
        try:
            result = await service.unload_and_wait("coder", timeout=5.0)
            assert result is True
            assert ps_calls["count"] >= 3
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_unload_and_wait_returns_false_on_deadline():
    async def scenario():
        def handler(request):
            if request.url.path == "/api/generate":
                return httpx.Response(200, json={})
            if request.url.path == "/api/ps":
                return httpx.Response(200, json={"models": [{"name": "stuck-model"}]})
            return httpx.Response(404)

        service = make_service(handler)
        try:
            result = await service.unload_and_wait("stuck-model", timeout=0.5)
            assert result is False
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_unload_and_wait_treats_404_as_already_gone():
    async def scenario():
        def handler(request):
            if request.url.path == "/api/generate":
                return httpx.Response(404, json={"error": "not found"})
            if request.url.path == "/api/ps":
                return httpx.Response(200, json={"models": []})
            return httpx.Response(404)

        service = make_service(handler)
        try:
            result = await service.unload_and_wait("never-loaded", timeout=1.0)
            assert result is True
        finally:
            await service.aclose()

    asyncio.run(scenario())


def test_unload_and_wait_never_raises_on_transport_failure():
    async def scenario():
        def handler(request):
            raise httpx.ConnectError("connection refused")

        service = make_service(handler)
        try:
            result = await service.unload_and_wait("any-model", timeout=1.0)
            assert result is False
        finally:
            await service.aclose()

    asyncio.run(scenario())


# --------------------------------------------------------------------------
# Context window: options, overflow classification, telemetry
# --------------------------------------------------------------------------


def test_overflow_error_is_a_request_error():
    """The subclass must not break existing ``except OllamaRequestError`` sites."""
    assert issubclass(OllamaContextOverflowError, OllamaRequestError)
    assert issubclass(OllamaContextOverflowError, OllamaServiceError)


def test_num_ctx_and_num_predict_are_sent_on_chat():
    async def scenario():
        seen = {}

        def handler(request):
            seen.update(json.loads(request.content))
            return httpx.Response(
                200, json={"message": {"content": "ok"}, "model": "test-model"}
            )

        service = make_service(handler, options={"num_ctx": 8192, "num_predict": 1024})
        try:
            await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

        assert seen["options"]["num_ctx"] == 8192
        assert seen["options"]["num_predict"] == 1024

    asyncio.run(scenario())


def test_num_ctx_and_num_predict_are_sent_on_generate():
    async def scenario():
        seen = {}

        def handler(request):
            seen.update(json.loads(request.content))
            return httpx.Response(200, json={"response": "ok", "model": "test-model"})

        service = make_service(handler, options={"num_ctx": 4096, "num_predict": 512})
        try:
            await service.generate("hello")
        finally:
            await service.aclose()

        assert seen["options"] == {"num_ctx": 4096, "num_predict": 512}

    asyncio.run(scenario())


def test_per_model_options_override_the_global_value_for_that_model_only():
    async def scenario():
        seen = []

        def handler(request):
            payload = json.loads(request.content)
            seen.append((payload["model"], payload["options"]["num_ctx"]))
            return httpx.Response(
                200, json={"message": {"content": "ok"}, "model": payload["model"]}
            )

        service = OllamaService(
            base_url="http://ollama.test",
            default_model="plain",
            timeout_seconds=5.0,
            transport=httpx.MockTransport(handler),
            options={"num_ctx": 4096},
            model_options={"wide": {"num_ctx": 32768}},
        )
        try:
            await service.chat([{"role": "user", "content": "hi"}], model="wide")
            await service.chat([{"role": "user", "content": "hi"}], model="plain")
        finally:
            await service.aclose()

        assert seen == [("wide", 32768), ("plain", 4096)]

    asyncio.run(scenario())


def test_num_ctx_for_reports_the_effective_window():
    async def scenario():
        def handler(request):
            return httpx.Response(200, json={})

        service = OllamaService(
            base_url="http://ollama.test",
            default_model="plain",
            timeout_seconds=5.0,
            transport=httpx.MockTransport(handler),
            options={"num_ctx": 4096},
            model_options={"wide": {"num_ctx": 32768}},
        )
        try:
            assert service.num_ctx_for("wide") == 32768
            assert service.num_ctx_for("plain") == 4096
            assert service.num_ctx_for("unknown") == 4096
        finally:
            await service.aclose()

        bare = OllamaService(
            base_url="http://ollama.test",
            default_model="plain",
            transport=httpx.MockTransport(handler),
        )
        try:
            assert bare.num_ctx_for("plain") is None
        finally:
            await bare.aclose()

    asyncio.run(scenario())


def test_num_predict_is_clamped_to_the_room_left_in_the_window():
    async def scenario():
        seen = {}

        def handler(request):
            seen.update(json.loads(request.content)["options"])
            return httpx.Response(
                200, json={"message": {"content": "ok"}, "model": "test-model"}
            )

        # A ~4000-character prompt is ~1000 tokens against a 2048 window, so the
        # declared 4096-token cap cannot fit and must come down.
        service = make_service(handler, options={"num_ctx": 2048, "num_predict": 4096})
        try:
            await service.chat([{"role": "user", "content": "x" * 4000}])
        finally:
            await service.aclose()

        assert 512 <= seen["num_predict"] < 4096

    asyncio.run(scenario())


def test_num_predict_clamp_never_goes_below_the_floor():
    async def scenario():
        seen = {}

        def handler(request):
            seen.update(json.loads(request.content)["options"])
            return httpx.Response(
                200, json={"message": {"content": "ok"}, "model": "test-model"}
            )

        # The prompt alone is larger than the window; the floor still applies so
        # a reasoning model gets a non-zero budget to answer with.
        service = make_service(handler, options={"num_ctx": 1024, "num_predict": 4096})
        try:
            await service.chat([{"role": "user", "content": "x" * 20000}])
        finally:
            await service.aclose()

        assert seen["num_predict"] == 512

    asyncio.run(scenario())


def test_chat_500_naming_the_context_raises_the_overflow_subclass():
    async def scenario():
        def handler(request):
            return httpx.Response(
                500, text="error: the input length exceeds the context size"
            )

        service = make_service(handler)
        try:
            with pytest.raises(OllamaContextOverflowError) as excinfo:
                await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

        # The body is kept — dropping it is what made this failure undiagnosable.
        assert "input length exceeds" in str(excinfo.value)

    asyncio.run(scenario())


def test_chat_500_with_an_unrelated_body_stays_a_plain_request_error():
    async def scenario():
        def handler(request):
            return httpx.Response(500, text="error: unable to load model")

        service = make_service(handler)
        try:
            with pytest.raises(OllamaRequestError) as excinfo:
                await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

        assert not isinstance(excinfo.value, OllamaContextOverflowError)
        assert "unable to load model" in str(excinfo.value)

    asyncio.run(scenario())


def test_generate_500_keeps_the_body_in_the_message():
    async def scenario():
        def handler(request):
            return httpx.Response(503, text="error: server busy")

        service = make_service(handler)
        try:
            with pytest.raises(OllamaRequestError) as excinfo:
                await service.generate("hello")
        finally:
            await service.aclose()

        assert "503" in str(excinfo.value)
        assert "server busy" in str(excinfo.value)

    asyncio.run(scenario())


def test_chat_length_stop_with_no_output_is_an_overflow_not_an_empty_answer():
    """A silent truncation must be named, not reported as an empty response.

    Reproduced live against gpt-oss:20b: Ollama answers 200 with
    ``done_reason: "length"`` and nothing generated when the prompt filled the
    window. Without this the cause surfaces as an unexplained empty answer.
    """
    async def scenario():
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "model": "test-model",
                    "message": {"content": "", "tool_calls": []},
                    "done_reason": "length",
                    "prompt_eval_count": 4096,
                },
            )

        service = make_service(handler)
        try:
            with pytest.raises(OllamaContextOverflowError) as excinfo:
                await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

        assert "context limit" in str(excinfo.value)

    asyncio.run(scenario())


def test_length_stop_with_a_prompt_that_fitted_is_a_generation_limit():
    """The other shape of ``done_reason: length``: the prompt was fine and the
    model still emitted nothing.

    A thinking model can spend its whole ``num_predict`` budget in its reasoning
    pass. Trimming history cannot change that, so this must NOT be classified as
    a recoverable context overflow — the agent would pay for a retry (a full
    model call, ~20 minutes on a CPU-offloaded vision model) that reproduces the
    same empty result.
    """
    async def scenario():
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "model": "test-model",
                    "message": {"content": "", "tool_calls": []},
                    "done_reason": "length",
                    "prompt_eval_count": 2000,   # 2000 of a 32768 window
                    "eval_count": 4096,
                },
            )

        service = make_service(handler, options={"num_ctx": 32768, "num_predict": 4096})
        try:
            with pytest.raises(OllamaGenerationLimitError) as excinfo:
                await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

        message = str(excinfo.value)
        assert not isinstance(excinfo.value, OllamaContextOverflowError)
        assert "prompt fitted the window" in message
        assert "32768" in message

    asyncio.run(scenario())


def test_a_generation_limit_error_is_still_a_request_error():
    """Every existing ``except OllamaRequestError`` site keeps working."""
    assert issubclass(OllamaGenerationLimitError, OllamaRequestError)
    assert issubclass(OllamaGenerationLimitError, OllamaServiceError)


def test_chat_with_tool_calls_and_no_content_is_not_an_overflow():
    """gpt-oss returns empty content *with* tool calls on a normal turn."""
    async def scenario():
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "model": "test-model",
                    "message": {
                        "content": "",
                        "tool_calls": [
                            {"function": {"name": "list_files", "arguments": {}}}
                        ],
                    },
                    "done_reason": "stop",
                },
            )

        service = make_service(handler)
        try:
            content, calls, _ = await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

        assert content == ""
        assert [c["name"] for c in calls] == ["list_files"]

    asyncio.run(scenario())


def test_successful_chat_logs_the_token_counts(caplog):
    import logging

    async def scenario():
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "model": "test-model",
                    "message": {"content": "ok"},
                    "prompt_eval_count": 1234,
                    "eval_count": 56,
                    "done_reason": "stop",
                },
            )

        service = make_service(handler)
        try:
            with caplog.at_level(logging.INFO, logger="app.ollama_service"):
                await service.chat([{"role": "user", "content": "hi"}])
        finally:
            await service.aclose()

    asyncio.run(scenario())

    records = [r for r in caplog.records if r.message == "ollama_generation_completed"]
    assert records, "expected a token-count log line"
    assert records[0].prompt_eval_count == 1234
    assert records[0].eval_count == 56
