"""Vision provider tests: abstraction, fake provider, Ollama multimodal mapping."""

import asyncio
import base64
import json

import httpx
import pytest

from app.services.ollama_service import OllamaService
from app.services.vision_provider import (
    FakeVisionProvider,
    OllamaVisionProvider,
    VisionProviderError,
)


def run(coro):
    return asyncio.run(coro)


def make_image(path):
    img = path
    img.write_bytes(b"fake image bytes")
    return img


def test_fake_vision_returns_scripted_observations(tmp_path):
    img = make_image(tmp_path / "page_0001.png")
    provider = FakeVisionProvider(observations_by_page={1: ["Handwritten date visible"]})
    result = run(provider.analyze(img, "What is visible?", "ocr context", "vision-model"))
    assert result.page == 1
    assert result.observations == ["Handwritten date visible"]
    assert provider.calls and provider.calls[0]["ocr_text"] == "ocr context"
    assert provider.calls[0]["model"] == "vision-model"


def test_fake_vision_default_observations(tmp_path):
    img = make_image(tmp_path / "page_0002.png")
    provider = FakeVisionProvider(default=["Generic observation"])
    result = run(provider.analyze(img, "q", "", "vision-model"))
    assert result.observations == ["Generic observation"]


def test_fake_vision_blank_page_no_observations(tmp_path):
    img = make_image(tmp_path / "page_0003.png")
    result = run(FakeVisionProvider().analyze(img, "q", "", "vision-model"))
    assert result.observations == []


def test_ollama_vision_posts_image_and_parses_response(tmp_path):
    img = make_image(tmp_path / "page_0001.png")

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["model"] == "llava:7b"
        assert payload["images"][0] == base64.b64encode(b"fake image bytes").decode()
        return httpx.Response(
            200, json={"response": "- seal worn\n- date visible", "model": "llava:7b"}
        )

    service = OllamaService(
        base_url="http://ollama.test", default_model="x", transport=httpx.MockTransport(handler)
    )
    provider = OllamaVisionProvider(service)
    result = run(provider.analyze(img, "q", "", "llava:7b"))
    assert result.observations == ["seal worn", "date visible"]
    assert result.model == "llava:7b"


def test_ollama_vision_missing_model_fails_cleanly(tmp_path):
    img = make_image(tmp_path / "page_0001.png")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "model not found"})

    service = OllamaService(
        base_url="http://ollama.test", default_model="x", transport=httpx.MockTransport(handler)
    )
    provider = OllamaVisionProvider(service)
    with pytest.raises(VisionProviderError, match="not available"):
        run(provider.analyze(img, "q", "", "ghost-model"))


def test_ollama_vision_unreachable_fails_cleanly(tmp_path):
    img = make_image(tmp_path / "page_0001.png")

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    service = OllamaService(
        base_url="http://ollama.test", default_model="x", transport=httpx.MockTransport(handler)
    )
    provider = OllamaVisionProvider(service)
    with pytest.raises(VisionProviderError, match="unreachable"):
        run(provider.analyze(img, "q", "", "llava:7b"))


def test_ollama_vision_describe():
    service = OllamaService(
        base_url="http://ollama.test", default_model="x", transport=httpx.MockTransport(lambda r: None)
    )
    assert OllamaVisionProvider(service).describe()["provider"] == "ollama"
    assert FakeVisionProvider().describe()["provider"] == "fake"
