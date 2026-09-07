"""Shared fixtures for backend tests."""

import asyncio
import hashlib
import json
import math
import re
import shutil
import subprocess
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas.resources import GpuInfo, ResourceCapacity, ResourceRequirements
from app.services.agent import TASK_MARKER
from app.services.document_preparer import DocumentPreparer
from app.services.embedding import EmbeddingProvider
from app.services.knowledge_base import KnowledgeBase
from app.services.model_registry import ModelConfig, ModelRegistry
from app.services.multimodal import MultimodalService
from app.services.ocr_provider import FakeOCRProvider, OCRProvider
from app.services.resource_provider import InMemoryResourceProvider
from app.services.resource_scheduler import InMemoryResourceScheduler
from app.services.sandbox_runner import ExecutionResult, SandboxRunnerError
from app.services.vector_store import JsonVectorStore
from app.services.vision_provider import FakeVisionProvider, VisionProvider

DEFAULT_HEADERS = {"X-User-ID": "user-001"}

SANDBOX_IMAGE = "python:3.12-alpine"


class FakeEmbeddingProvider(EmbeddingProvider):
    """Deterministic, keyword-overlap embedding provider for tests/demos.

    Vectors encode token presence in a hashed space, so cosine similarity ranks
    chunks that share tokens with the query (e.g. "pump maintenance" matches the
    pump document) without needing a real embedding model.
    """

    DIM = 64

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]

    def _embed_one(self, text: str) -> list[float]:
        vector = [0.0] * self.DIM
        for token in re.findall(r"[a-z0-9]+", (text or "").lower()):
            index = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % self.DIM
            vector[index] += 1.0
        norm = math.sqrt(sum(x * x for x in vector)) or 1.0
        return [x / norm for x in vector]

    def describe(self) -> dict:
        return {"provider": "fake", "model": "keyword-hash"}


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


def make_multimodal_stack(
    tmp_path,
    ocr: OCRProvider = None,
    vision: VisionProvider = None,
    vision_model="vision-model",
    vision_enabled=True,
    vision_resources=None,
    capacity=None,
    vision_wait_rounds=3,
):
    """Build a fully wired MultimodalService for deterministic tests.

    Returns ``(service, scheduler, uploads_root, tmp_root)``.
    """
    from pathlib import Path

    uploads = Path(tmp_path) / "uploads"
    tmproot = Path(tmp_path) / "tmp"
    uploads.mkdir(parents=True, exist_ok=True)
    tmproot.mkdir(parents=True, exist_ok=True)
    kb = KnowledgeBase(
        vector_store=JsonVectorStore(str(Path(tmp_path) / "kb")),
        embedding_provider=FakeEmbeddingProvider(),
    )
    scheduler = InMemoryResourceScheduler(
        InMemoryResourceProvider(capacity or default_capacity())
    )
    service = MultimodalService(
        knowledge_base=kb,
        preparer=DocumentPreparer(),
        ocr_provider=ocr if ocr is not None else FakeOCRProvider(),
        vision_provider=vision if vision is not None else FakeVisionProvider(),
        vision_model=vision_model,
        vision_enabled=vision_enabled,
        vision_requirements=vision_resources or ResourceRequirements(),
        scheduler=scheduler,
        uploads_root=str(uploads),
        tmp_root=str(tmproot),
        vision_wait_rounds=vision_wait_rounds,
    )
    return service, scheduler, uploads, tmproot


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


def make_mutable_scripted_handler(script, delay_seconds: float = 0.0):
    """Mock Ollama that reads a caller-mutated list of model outputs live.

    Used when the scripted agent replies must be assembled after a document is
    uploaded (e.g. ``document_vision`` needs the generated ``document_id``).
    """

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(
                200,
                json={
                    "models": [
                        {"name": "test-model"},
                        {"name": "coder-model"},
                        {"name": "vision-model"},
                    ]
                },
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


def make_text_pdf(path, lines):
    """Generate a text-based PDF with the given lines (reportlab, local only)."""
    from reportlab.pdfgen import canvas

    canvas_obj = canvas.Canvas(str(path))
    y = 760
    for line in lines:
        canvas_obj.drawString(72, y, line)
        y -= 18
    canvas_obj.save()


def make_blank_pdf(path, pages=1):
    """Generate an image-only (no text) PDF — used for OCR-required detection.

    Contains ``pages`` blank pages (no text layer) so it remains renderable by
    pypdfium2 while reporting no extractable text.
    """
    from reportlab.pdfgen import canvas

    canvas_obj = canvas.Canvas(str(path))
    for _ in range(pages):
        canvas_obj.showPage()
    canvas_obj.save()


def make_png(path, lines, width=600, height=220):
    """Generate a PNG image containing the given text lines (Pillow, local only)."""
    from PIL import Image, ImageDraw

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    y = 40
    for line in lines:
        draw.text((20, y), line, fill="black")
        y += 50
    image.save(path)
    return path


def make_image_pdf(path, image_path, page_count=1):
    """Embed a raster image into an otherwise text-less PDF (scanned-style)."""
    from PIL import Image
    from reportlab.pdfgen import canvas

    image = Image.open(image_path)
    c = canvas.Canvas(str(path), pagesize=(image.width, image.height))
    for _ in range(page_count):
        c.drawImage(str(image_path), 0, 0, width=image.width, height=image.height)
        c.showPage()
    c.save()


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
        knowledge_base_root=str(tmp_path / "knowledge"),
        uploads_root=str(tmp_path / "uploads"),
        multimodal_tmp_root=str(tmp_path / "tmp"),
        audit_root=str(tmp_path / "audit"),
        job_store_root=str(tmp_path / "jobs"),
        artifact_store_root=str(tmp_path / "artifacts"),
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
        embedding_provider=None,
        ocr_provider=None,
        vision_provider=None,
        project_root=None,
        file_max_bytes=1_000_000,
    ):
        registry = build_registry(models if models is not None else test_models)
        updates = {}
        if sandbox_enabled:
            updates["sandbox_enabled"] = True
        if project_root is not None:
            updates["cowork_projects_root"] = str(project_root)
        updates["cowork_file_max_bytes"] = file_max_bytes
        settings = app_settings.model_copy(update=updates) if updates else app_settings
        app = create_app(
            settings=settings,
            ollama_transport=httpx.MockTransport(handler),
            model_registry=registry,
            sandbox_runner=sandbox_runner,
            resource_capacity=resource_capacity,
            embedding_provider=embedding_provider or FakeEmbeddingProvider(),
            ocr_provider=ocr_provider or FakeOCRProvider(),
            vision_provider=vision_provider,
        )
        return TestClient(app)

    return _make


@pytest.fixture
def client(client_factory, success_ollama_handler):
    with client_factory(success_ollama_handler) as c:
        yield c
