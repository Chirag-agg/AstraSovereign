"""FastAPI application entry point.

The backend talks only to the locally configured Ollama endpoint
(``OLLAMA_BASE_URL``). No external AI services, no telemetry.

Architecture: HTTP -> Job Manager -> Queue -> Worker -> Task Router ->
Model Registry -> OllamaService -> local model.
"""

import json
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.config import Settings, get_settings
from app.schemas.resources import GpuInfo, ResourceCapacity
from app.services.agent import Agent
from app.services.embedding import EmbeddingProvider, OllamaEmbeddingProvider
from app.services.job_manager import JobManager
from app.services.job_queue import JobQueue
from app.services.job_store import InMemoryJobStore
from app.services.knowledge_base import KnowledgeBase
from app.services.model_registry import ModelRegistry
from app.services.model_router import ModelRouter
from app.services.ollama_service import OllamaService
from app.services.resource_provider import InMemoryResourceProvider, LocalResourceProvider
from app.services.resource_scheduler import InMemoryResourceScheduler
from app.services.sandbox_runner import DockerSandboxRunner, SandboxRunner
from app.services.task_router import TaskRouter
from app.services.tool_registry import ToolRegistry
from app.services.tools import (
    CodeExecutionTool,
    DocumentSearchTool,
    ListFilesTool,
    ReadFileTool,
    WriteFileTool,
)
from app.services.vector_store import JsonVectorStore
from app.services.worker import Worker
from app.services.workspace import WorkspaceManager

logger = logging.getLogger("app")

# Attributes every logging.LogRecord carries by default. Anything else on the
# record is treated as structured context and included in the JSON log line.
_DEFAULT_RECORD_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "taskName",
    "message",
    "asctime",
}


class JsonFormatter(logging.Formatter):
    """Format log records as single-line JSON with structured context."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _DEFAULT_RECORD_ATTRS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def setup_logging(settings: Settings) -> None:
    """Install JSON structured logging to console and (optionally) a file.

    Only configures once per process; repeated calls are idempotent.
    """
    root = logging.getLogger()
    if root.handlers:
        return

    root.setLevel(settings.log_level.upper())
    formatter = JsonFormatter()

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    root.addHandler(console)

    if settings.log_file:
        log_path = Path(settings.log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)

    # Silence noisy third-party loggers.
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = app.state.settings
    service = app.state.ollama_service
    worker = app.state.worker
    registry = app.state.model_registry
    embedding_provider = app.state.embedding_provider

    worker.start()
    try:
        available = set(await service.list_models())
        reachable = True
    except Exception as exc:  # Ollama down at startup: report availability as unknown
        available = set()
        reachable = False
        logger.warning(
            "model_availability_unreachable",
            extra={
                "event": "model_availability",
                "reachable": False,
                "reason": f"{exc.__class__.__name__}: {exc}",
            },
        )
    if reachable:
        logger.info(
            "model_availability",
            extra={
                "event": "model_availability",
                "reachable": True,
                "availability": registry.availability(available),
            },
        )

    logger.info(
        "application_startup",
        extra={
            "event": "application_startup",
            "ollama_url": settings.ollama_base_url,
            "default_model": settings.default_model,
            "host": settings.host,
            "port": settings.port,
            "worker": worker.state,
            "models_config": settings.models_config,
        },
    )
    try:
        yield
    finally:
        await worker.stop()
        await service.aclose()
        await embedding_provider.aclose()


def build_resource_capacity(settings: Settings) -> ResourceCapacity:
    """Build the scheduler capacity from config (or local discovery in auto mode)."""
    if settings.resource_capacity_mode == "auto":
        try:
            return LocalResourceProvider().capacity()
        except Exception:
            pass  # fall through to configured values
    return ResourceCapacity(
        cpu_cores=settings.resource_cpu_cores,
        memory_mb=settings.resource_memory_mb,
        gpus=[
            GpuInfo(gpu_id=f"GPU-{i}", vram_mb=settings.resource_gpu_vram_mb)
            for i in range(settings.resource_gpu_count)
        ],
    )


def create_app(
    settings: Optional[Settings] = None,
    ollama_transport: Optional[httpx.AsyncBaseTransport] = None,
    model_registry: Optional[ModelRegistry] = None,
    sandbox_runner: Optional[SandboxRunner] = None,
    resource_capacity: Optional[ResourceCapacity] = None,
    embedding_provider: Optional[EmbeddingProvider] = None,
) -> FastAPI:
    """Build the FastAPI application.

    ``ollama_transport`` / ``model_registry`` / ``sandbox_runner`` /
    ``resource_capacity`` / ``embedding_provider`` are test seams.
    """
    settings = settings or get_settings()
    setup_logging(settings)

    if not settings.default_model:
        logger.warning(
            "DEFAULT_MODEL is not set; jobs will fail until it is configured.",
            extra={"event": "startup_warning"},
        )

    ollama_service = OllamaService(
        base_url=settings.ollama_base_url,
        default_model=settings.default_model,
        timeout_seconds=settings.ollama_timeout_seconds,
        transport=ollama_transport,
    )

    if model_registry is None:
        model_registry = ModelRegistry.from_file(settings.models_config)

    task_router = TaskRouter()
    model_router = ModelRouter(registry=model_registry)

    tools = [ListFilesTool(), ReadFileTool(), WriteFileTool()]

    embedding = embedding_provider or OllamaEmbeddingProvider(
        base_url=settings.ollama_base_url,
        model=settings.embedding_model,
        transport=ollama_transport,
    )
    knowledge_base = KnowledgeBase(
        vector_store=JsonVectorStore(settings.knowledge_base_root),
        embedding_provider=embedding,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    tools.append(
        DocumentSearchTool(
            knowledge_base=knowledge_base,
            default_top_k=settings.document_search_default_top_k,
            max_top_k=settings.document_search_max_top_k,
            max_chunk_chars=settings.document_search_max_chunk_chars,
        )
    )

    if settings.sandbox_enabled:
        runner = sandbox_runner or DockerSandboxRunner(
            image=settings.sandbox_python_image,
            timeout_seconds=settings.sandbox_timeout_seconds,
            cpu_limit=settings.sandbox_cpu_limit,
            memory_limit=settings.sandbox_memory_limit,
        )
        tools.append(
            CodeExecutionTool(
                runner=runner,
                max_stdout_chars=settings.sandbox_max_stdout_chars,
                max_stderr_chars=settings.sandbox_max_stderr_chars,
            )
        )
    tool_registry = ToolRegistry(tools)
    workspace_manager = WorkspaceManager(root=settings.workspaces_root)

    capacity = resource_capacity or build_resource_capacity(settings)
    resource_provider = InMemoryResourceProvider(capacity)
    scheduler = InMemoryResourceScheduler(resource_provider)

    store = InMemoryJobStore()
    job_manager = JobManager(store=store, default_model=settings.default_model)
    job_queue = JobQueue()
    agent = Agent(
        manager=job_manager,
        tool_registry=tool_registry,
        model_client=ollama_service,
        max_iterations=settings.max_agent_iterations,
        max_tool_calls=settings.max_agent_tool_calls,
    )
    worker = Worker(
        queue=job_queue,
        manager=job_manager,
        ollama=ollama_service,
        task_router=task_router,
        model_router=model_router,
        agent=agent,
        workspace_manager=workspace_manager,
        scheduler=scheduler,
    )

    app = FastAPI(
        title="Sovereign On-Premise Agentic AI Workbench",
        description=(
            "Local-only backend. Communicates exclusively with local services. "
            "Requests become jobs classified by task type, routed to a configured "
            "local model, scheduled against declared resource capacity, and executed "
            "by a local agent with workspace-scoped tools, an optional isolated "
            "Docker code-execution sandbox, a per-user local knowledge base "
            "(document_search), and an execution trace."
        ),
        version="0.7.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.ollama_service = ollama_service
    app.state.job_manager = job_manager
    app.state.job_queue = job_queue
    app.state.worker = worker
    app.state.model_registry = model_registry
    app.state.task_router = task_router
    app.state.model_router = model_router
    app.state.tool_registry = tool_registry
    app.state.workspace_manager = workspace_manager
    app.state.agent = agent
    app.state.scheduler = scheduler
    app.state.knowledge_base = knowledge_base
    app.state.embedding_provider = embedding
    app.include_router(chat_router)
    app.include_router(jobs_router)
    app.include_router(documents_router)
    app.include_router(health_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_config=None,
    )
