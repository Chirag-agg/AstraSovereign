"""Shared fixtures for backend tests."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def app_settings():
    return Settings(
        ollama_base_url="http://ollama.test",
        default_model="test-model",
        log_level="ERROR",
        log_file="",
    )


@pytest.fixture
def success_ollama_handler():
    """Default mock Ollama: /api/tags lists the model, /api/generate replies."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "test-model"}]})
        if request.url.path == "/api/generate":
            payload = json.loads(request.content)
            return httpx.Response(
                200,
                json={"response": f"mocked reply to: {payload['prompt']}", "model": "test-model"},
            )
        return httpx.Response(404, json={"error": "not found"})

    return handler


@pytest.fixture
def client_factory(app_settings):
    def _make(handler):
        app = create_app(
            settings=app_settings,
            ollama_transport=httpx.MockTransport(handler),
        )
        return TestClient(app)

    return _make


@pytest.fixture
def client(client_factory, success_ollama_handler):
    with client_factory(success_ollama_handler) as c:
        yield c
