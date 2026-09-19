import asyncio
import json

import httpx
import pytest

from app.services.ollama_service import (
    OllamaModelNotFoundError,
    OllamaRequestError,
    OllamaService,
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
