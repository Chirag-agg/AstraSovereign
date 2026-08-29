"""Shared fixtures for backend tests."""

import asyncio
import json
import shutil
import subprocess
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas.resources import GpuInfo, ResourceCapacity
from app.services.agent import TASK_MARKER
from app.services.model_registry import ModelConfig, ModelRegistry
from app.services.sandbox_runner import ExecutionResult, SandboxRunnerError

DEFAULT_HEADERS = {"X-User-ID": "user-001"}

SANDBOX_IMAGE = "python:3.12-alpine"


def default_capacity() -> ResourceCapacity:
    """Default test capacity: 8 cores, 16 GB RAM, one 16 GB GPU."""
    return ResourceCapacity(
        cpu_cores=8.0,
        memory_mb=16384,
        gpus=[GpuInfo(gpu_id="GPU-0", vram_mb=16384)],
    )


def docker_ready() -> bool:
    """True when the Docker daemon is reachable AND the sandbox image exists."""
    if shutil.which("docker") is None:
        return False
    try:
        info = subprocess.run(
            ["docker", "info"], capture_output=True, timeout=10, text=True
        )
        if info.returncode != 0:
            return False
        inspect = subprocess.run(
            ["docker", "image", "inspect", SANDBOX_IMAGE],
            capture_output=True,
            timeout=10,
            text=True,
        )
        return inspect.returncode == 0
    except Exception:
        return False


class FakeSandboxRunner:
    """Scriptable sandbox runner for deterministic tests (no Docker required)."""

    def __init__(self, results=None, error=None):
        self.results = list(results or [])
        self.error = error
        self.calls = []

    async def run(self, code, language="python", stdin=""):
        self.calls.append({"code": code, "language": language, "stdin": stdin})
        if self.error:
            raise self.error
        if self.results:
            return self.results.pop(0)
        return ExecutionResult(
            success=True, exit_code=0, stdout="", stderr="", timed_out=False, duration_ms=1
        )


def ok_result(stdout="", stderr="", exit_code=0, timed_out=False, duration_ms=10):
    return ExecutionResult(
        success=exit_code == 0 and not timed_out,
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        timed_out=timed_out,
        duration_ms=duration_ms,
    )


def build_registry(models: dict[str, dict]) -> ModelRegistry:
    """Build a ModelRegistry from a plain-dict mapping for tests."""
    return ModelRegistry(
        models={name: ModelConfig(**cfg) for name, cfg in models.items()}
    )


def _extract_task(prompt: str) -> str:
    """Extract the user task from an agent prompt for mock echo replies."""
    if TASK_MARKER in prompt:
        tail = prompt.split(TASK_MARKER, 1)[1].strip()
        if tail:
            return tail.splitlines()[0].strip()
    return prompt


def make_ollama_handler(available_models, delay_seconds: float = 0.0):
    """Mock Ollama: /api/tags lists ``available_models``, /api/generate replies
    only for known models (404 otherwise, matching real Ollama)."""

    available = set(available_models or set())

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(
                200, json={"models": [{"name": name} for name in sorted(available)]}
            )
        if request.url.path == "/api/generate":
            if delay_seconds:
                await asyncio.sleep(delay_seconds)
            payload = json.loads(request.content)
            model = payload.get("model")
            if model not in available:
                return httpx.Response(
                    404, json={"error": f"model '{model}' not found"}
                )
            task = _extract_task(payload["prompt"])
            return httpx.Response(
                200,
                json={
                    "response": f"mocked reply to: {task}",
                    "model": model,
                },
            )
        return httpx.Response(404, json={"error": "not found"})

    return handler


def make_scripted_handler(responses, delay_seconds: float = 0.0):
    """Mock Ollama that plays back a scripted list of model outputs.

    Calling the model more times than scripted raises an AssertionError, which
    fails the job (used to prove the agent does not exceed its budget).
    """

    script = list(responses)

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(
                200, json={"models": [{"name": "test-model"}, {"name": "coder-model"}]}
            )
        if request.url.path == "/api/generate":
            if delay_seconds:
                await asyncio.sleep(delay_seconds)
            if not script:
                raise AssertionError("model called more times than scripted")
            text = script.pop(0)
            return httpx.Response(200, json={"response": text, "model": "test-model"})
        return httpx.Response(404, json={"error": "not found"})

    return handler


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
def app_settings(tmp_path):
    return Settings(
        ollama_base_url="http://ollama.test",
        default_model="test-model",
        log_level="ERROR",
        log_file="",
        workspaces_root=str(tmp_path / "workspaces"),
    )


@pytest.fixture
def test_models():
    """Default test registry: general + coding enabled, document/vision disabled."""
    return {
        "general": {
            "provider": "ollama",
            "model": "test-model",
            "enabled": True,
            "capabilities": ["general", "reasoning", "summarization"],
        },
        "coding": {
            "provider": "ollama",
            "model": "coder-model",
            "enabled": True,
            "capabilities": ["coding", "debugging", "code_review"],
        },
        "document": {
            "provider": "ollama",
            "model": "doc-model",
            "enabled": False,
            "capabilities": ["document", "summarization"],
        },
        "vision": {
            "provider": "ollama",
            "model": "vision-model",
            "enabled": False,
            "capabilities": ["vision", "image"],
        },
    }


@pytest.fixture
def available_models():
    return {"test-model", "coder-model"}


@pytest.fixture
def success_ollama_handler(available_models):
    return make_ollama_handler(available_models)


@pytest.fixture
def delayed_ollama_handler(available_models):
    def _make(delay_seconds: float = 0.2):
        return make_ollama_handler(available_models, delay_seconds=delay_seconds)

    return _make


@pytest.fixture
def client_factory(app_settings, test_models):
    def _make(
        handler,
        models=None,
        sandbox_enabled=False,
        sandbox_runner=None,
        resource_capacity=None,
    ):
        registry = build_registry(models if models is not None else test_models)
        settings = app_settings
        if sandbox_enabled:
            settings = app_settings.model_copy(update={"sandbox_enabled": True})
        app = create_app(
            settings=settings,
            ollama_transport=httpx.MockTransport(handler),
            model_registry=registry,
            sandbox_runner=sandbox_runner,
            resource_capacity=resource_capacity,
        )
        return TestClient(app)

    return _make


@pytest.fixture
def client(client_factory, success_ollama_handler):
    with client_factory(success_ollama_handler) as c:
        yield c
