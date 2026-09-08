import asyncio

import httpx
import pytest

from app.services.ollama_service import (
    OllamaModelNotFoundError,
    OllamaRequestError,
    OllamaService,
    OllamaTimeoutError,
    OllamaUnavailableError,
)


def make_service(handler, default_model="test-model"):
    return OllamaService(
        base_url="http://ollama.test",
        default_model=default_model,
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
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
