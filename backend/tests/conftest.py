"""Shared fixtures for backend tests."""

import asyncio
import json
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

DEFAULT_HEADERS = {"X-User-ID": "user-001"}


def wait_for_job(
    client: TestClient,
    job_id: str,
    user_id: str = "user-001",
    terminal=("completed", "failed", "cancelled"),
    timeout: float = 5.0,
) -> dict:
    """Poll a job until it reaches a terminal state. Used because the worker
    processes jobs asynchronously in the background."""
    deadline = time.monotonic() + timeout
    last_body = None
    while time.monotonic() < deadline:
        resp = client.get(f"/api/jobs/{job_id}", headers={"X-User-ID": user_id})
        assert resp.status_code == 200, resp.text
        last_body = resp.json()
        if last_body["status"] in terminal:
            return last_body
        time.sleep(0.02)
    raise AssertionError(
        f"job {job_id} did not reach a terminal state within {timeout}s "
        f"(last status: {last_body and last_body['status']})"
    )


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
def delayed_ollama_handler():
    """Factory for a mock Ollama that delays /api/generate by ``delay_seconds``."""

    def _make(delay_seconds: float = 0.2):
        async def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/api/tags":
                return httpx.Response(200, json={"models": [{"name": "test-model"}]})
            if request.url.path == "/api/generate":
                await asyncio.sleep(delay_seconds)
                payload = json.loads(request.content)
                return httpx.Response(
                    200,
                    json={
                        "response": f"mocked reply to: {payload['prompt']}",
                        "model": "test-model",
                    },
                )
            return httpx.Response(404, json={"error": "not found"})

        return handler

    return _make


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
