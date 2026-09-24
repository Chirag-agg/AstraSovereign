"""FastAPI application entry point.

The backend talks only to the locally configured Ollama endpoint
(``OLLAMA_BASE_URL``). No external AI services, no telemetry.

Architecture: HTTP -> Job Manager -> Queue -> Worker -> Task Router ->
Model Registry -> OllamaService -> local model.
"""

import json
import logging
import secrets
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.artifacts import router as artifacts_router
from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.workspace import router as workspace_router
from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.jobs import router as jobs_router
from app.api.sandbox import router as sandbox_router
from app.config import Settings, get_settings
from app.schemas.resources import GpuInfo, ResourceCapacity, ResourceRequirements
from app.services.agent import Agent
from app.services.artifact_store import ArtifactStore, SqliteArtifactStore
from app.services.audit_store import SqliteAuditStore, ensure_audit_handler, set_audit_store
from app.services.auth_store import SqliteUserStore, UserStore
from app.services.session import load_or_create_session_secret
from app.services.document_generator import (
    DocumentGenerator,
    WordDocumentGenerator,
    XlsxDocumentGenerator,
)
from app.services.document_preparer import DocumentPreparer
from app.services.embedding import EmbeddingProvider, OllamaEmbeddingProvider
from app.services.extraction_store import JsonExtractionStore
from app.services.job_manager import JobManager
from app.services.capability_router import CapabilityRouter
from app.services.context import ContextManager
from app.services.presentation_renderer import NodePresentationRenderer
from app.services.job_queue import JobQueue
from app.services.job_store import SqliteJobStore
from app.services.knowledge_base import KnowledgeBase
from app.services.model_registry import ModelRegistry
from app.schemas.job import JobStatus
from app.services.capability_classifier import SemanticCapabilityClassifier
from app.services.multimodal import MultimodalService
from app.services.network_guard import NetworkGuard, make_guarded_transport
from app.services.ocr_provider import OCRProvider, RapidOCREngine
from app.services.ollama_service import OllamaService
from app.services.projects import CoworkProjects, ProjectLocks
from app.services.resource_provider import InMemoryResourceProvider, LocalResourceProvider
from app.services.resource_scheduler import InMemoryResourceScheduler
from app.services.sandbox_runner import DockerSandboxRunner, SandboxRunner
from app.services.nodes import NODE_INPUT_NODES, NODE_TOOLS, NodeAgent
from app.services.tool_config import validate_node_tools
from app.services.tool_registry import ToolRegistry
from app.services.tools import (
    CodeExecutionTool,
    DocumentExactSearchTool,
    DocumentGenerationTool,
    DocumentSearchTool,
    DocumentVisionTool,
    PIDDiagramQATool,
    ReadDocumentTool,
    SubmitFindingsTool,
    ListFilesTool,
    PresentationGenerationTool,
    ReadFileTool,
    WriteFileTool,
)
from app.services.vector_store import JsonVectorStore
from app.services.vision_provider import OllamaVisionProvider, VisionProvider
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
    user_store = app.state.user_store

    if await user_store.count() == 0:
        bootstrap_password = secrets.token_urlsafe(12)
        await user_store.create("admin", bootstrap_password, role="admin")
        password_file = Path(settings.database_path).parent / "bootstrap_admin_password.txt"
        try:
            password_file.parent.mkdir(parents=True, exist_ok=True)
            password_file.write_text(bootstrap_password, encoding="utf-8")
            password_file.chmod(0o600)
            password_note = str(password_file)
        except OSError:
            password_note = "could not be written to disk; see logs (not repeated)"
        logger.warning(
            "bootstrap_admin_created",
            extra={
                "event": "bootstrap_admin_created",
                "username": "admin",
                "password_file": password_note,
            },
        )

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
        missing = registry.missing_models(available)
        resolved = registry.resolved_availability(
            available, app.state.settings.model_fallback_enabled
        )
        substitutions = [
            f"{task}: {state['configured']} MISSING -> will use {state['effective']}"
            for task, state in resolved.items()
            if state["fallback_active"]
        ]
        app.state.model_availability["models"] = available
        if missing:
            logger.warning(
                "model_preflight",
                extra={
                    "event": "model_preflight",
                    "reachable": True,
                    "missing": [f"{m['task_type']}:{m['model']}" for m in missing],
                    "substitutions": substitutions,
                },
            )
        else:
            logger.info(
                "model_preflight",
                extra={
                    "event": "model_preflight",
                    "reachable": True,
                    "missing": [],
                    "substitutions": [],
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


def _base_url_host(url: str) -> str:
    """Extract the hostname of the configured local Ollama endpoint."""
    try:
        from urllib.parse import urlsplit

        host = urlsplit(url).hostname
        return host.lower() if host else ""
    except ValueError:
        return ""


def create_app(
    settings: Optional[Settings] = None,
    ollama_transport: Optional[httpx.AsyncBaseTransport] = None,
    model_registry: Optional[ModelRegistry] = None,
    sandbox_runner: Optional[SandboxRunner] = None,
    resource_capacity: Optional[ResourceCapacity] = None,
    embedding_provider: Optional[EmbeddingProvider] = None,
    ocr_provider: Optional[OCRProvider] = None,
    vision_provider: Optional[VisionProvider] = None,
    classifier: Optional[SemanticCapabilityClassifier] = None,
    cowork_projects: Optional[CoworkProjects] = None,
    cowork_locks: Optional[ProjectLocks] = None,
    presentation_renderer=None,
    user_store: Optional[UserStore] = None,
    dev_header_auth: bool = False,
) -> FastAPI:
    """Build the FastAPI application.

    ``ollama_transport`` / ``model_registry`` / ``sandbox_runner`` /
    ``resource_capacity`` / ``embedding_provider`` / ``ocr_provider`` /
    ``vision_provider`` / ``user_store`` are test seams.

    ``dev_header_auth``: when True, ``deps.get_session`` falls back to
    trusting a raw ``X-User-ID``/``X-Role`` header when no valid session
    cookie is present. This can ONLY be set here, by a call site in source
    (see ``tests/conftest.py``) — never from configuration or environment —
    so the production app (the bare ``create_app()`` below) can never fall
    back to trusting a client-supplied header. Defaults to False.
    """
    settings = settings or get_settings()
    setup_logging(settings)
    audit_store = SqliteAuditStore(settings.database_path)
    set_audit_store(audit_store)
    ensure_audit_handler()

    if user_store is None:
        user_store = SqliteUserStore(settings.database_path)
    session_secret = load_or_create_session_secret(
        settings.session_secret, settings.session_secret_file
    )

    if not settings.default_model:
        logger.warning(
            "DEFAULT_MODEL is not set; jobs will fail until it is configured.",
            extra={"event": "startup_warning"},
        )

    network_guard = NetworkGuard(allowed_hosts={_base_url_host(settings.ollama_base_url)})
    guarded_transport = make_guarded_transport(ollama_transport, network_guard)

    ollama_options = (
        {"temperature": 0.0, "seed": settings.bench_seed}
        if settings.bench_mode
        else None
    )
    ollama_service = OllamaService(
        base_url=settings.ollama_base_url,
        default_model=settings.default_model,
        timeout_seconds=settings.ollama_timeout_seconds,
        transport=guarded_transport,
        options=ollama_options,
        keep_alive=settings.ollama_keep_alive,
    )

    if model_registry is None:
        model_registry = ModelRegistry.from_file(settings.models_config)

    vision_config = model_registry.get("vision")

    tools = [ListFilesTool(), ReadFileTool(), WriteFileTool()]

    embedding = embedding_provider or OllamaEmbeddingProvider(
        base_url=settings.ollama_base_url,
        model=settings.embedding_model,
        transport=guarded_transport,
    )
    classifier = classifier or SemanticCapabilityClassifier(
        embedding, threshold=settings.classifier_threshold
    )
    extraction_store = JsonExtractionStore(settings.extraction_root)
    knowledge_base = KnowledgeBase(
        vector_store=JsonVectorStore(settings.knowledge_base_root),
        embedding_provider=embedding,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        extraction_store=extraction_store,
    )
    tools.append(
        DocumentSearchTool(
            knowledge_base=knowledge_base,
            default_top_k=settings.document_search_default_top_k,
            min_top_k=settings.document_search_min_top_k,
            max_top_k=settings.document_search_max_top_k,
            max_chunk_chars=settings.document_search_max_chunk_chars,
        )
    )
    tools.append(
        ReadDocumentTool(
            extraction_store=extraction_store,
            max_chars=settings.read_document_max_chars,
        )
    )
    tools.append(
        DocumentExactSearchTool(
            knowledge_base=knowledge_base,
            extraction_store=extraction_store,
        )
    )
    tools.append(
        PIDDiagramQATool(
            extraction_store=extraction_store,
        )
    )
    tools.append(SubmitFindingsTool())


    runner = None
    if settings.sandbox_enabled:
        runner = sandbox_runner or DockerSandboxRunner(
            image=settings.sandbox_python_image,
            timeout_seconds=settings.sandbox_timeout_seconds,
            cpu_limit=settings.sandbox_cpu_limit,
            memory_limit=settings.sandbox_memory_limit,
        )
        # Repair rides the reservation the compute node already holds for the
        # "coding" capability (code_execution is only reachable from compute) —
        # no new scheduler interaction needed inside the tool itself.
        coding_config = model_registry.get("coding")
        repair_model = coding_config.model if coding_config is not None else None
        repair_enabled = settings.sandbox_repair_enabled and repair_model is not None
        tools.append(
            CodeExecutionTool(
                runner=runner,
                max_stdout_chars=settings.sandbox_max_stdout_chars,
                max_stderr_chars=settings.sandbox_max_stderr_chars,
                repair_model_client=ollama_service if repair_enabled else None,
                repair_model=repair_model if repair_enabled else None,
                max_repair_attempts=settings.sandbox_repair_max_attempts,
                repair_deadline_seconds=settings.sandbox_repair_deadline_seconds,
            )
        )

    capacity = resource_capacity or build_resource_capacity(settings)
    resource_provider = InMemoryResourceProvider(capacity)
    scheduler = InMemoryResourceScheduler(resource_provider)

    ocr = ocr_provider
    if ocr is None and settings.ocr_enabled:
        ocr = RapidOCREngine()
    vision = vision_provider or OllamaVisionProvider(ollama_service)
    preparer = DocumentPreparer(
        render_scale=settings.ocr_render_scale,
        max_image_dimension=settings.ocr_max_image_dimension,
        max_pages=settings.ocr_max_pages,
    )
    multimodal = MultimodalService(
        knowledge_base=knowledge_base,
        preparer=preparer,
        ocr_provider=ocr,
        vision_provider=vision,
        vision_model=vision_config.model if vision_config else None,
        vision_enabled=vision_config.enabled if vision_config else False,
        vision_requirements=vision_config.resources if vision_config else ResourceRequirements(),
        scheduler=scheduler,
        uploads_root=settings.uploads_root,
        tmp_root=settings.multimodal_tmp_root,
        max_pages=settings.ocr_max_pages,
        vision_max_pages=settings.vision_max_pages,
        vision_wait_rounds=settings.vision_resource_wait_rounds,
        ocr_page_min_text_chars=settings.ocr_page_min_text_chars,
    )
    if vision_config is not None:
        tools.append(DocumentVisionTool(multimodal=multimodal))

    artifact_store = SqliteArtifactStore(settings.database_path)
    document_generators = {
        "word": WordDocumentGenerator(),
        "excel": XlsxDocumentGenerator(),
    }
    tools.append(
        DocumentGenerationTool(
            generators=document_generators,
            artifact_store=artifact_store,
            scheduler=scheduler,
        )
    )
    presentation_renderer = presentation_renderer or NodePresentationRenderer(
        node_command=settings.presentation_node_command,
        script_path=settings.presentation_renderer_script,
        timeout_seconds=settings.presentation_timeout_seconds,
    )
    tools.append(
        PresentationGenerationTool(
            renderer=presentation_renderer,
            artifact_store=artifact_store,
            scheduler=scheduler,
        )
    )

    tool_registry = ToolRegistry(tools)
    validate_node_tools(NODE_TOOLS, NODE_INPUT_NODES, tool_registry)
    workspace_manager = WorkspaceManager(root=settings.workspaces_root)

    store = SqliteJobStore(settings.database_path)
    job_manager = JobManager(store=store, default_model=settings.default_model)
    job_queue = JobQueue()
    agent = Agent(
        manager=job_manager,
        tool_registry=tool_registry,
        model_client=ollama_service,
        max_iterations=settings.max_agent_iterations,
        max_tool_calls=settings.max_agent_tool_calls,
    )

    capability_router = CapabilityRouter(registry=model_registry)

    projects = cowork_projects or CoworkProjects(
        root=settings.cowork_projects_root,
        file_max_bytes=settings.cowork_file_max_bytes,
    )
    project_locks = cowork_locks or ProjectLocks()
    context_manager = ContextManager(projects)
    # Filled by the lifespan preflight; None means "availability unknown".
    model_availability: dict[str, Optional[set[str]]] = {"models": None}

    async def _job_cancelled(check_job_id: str) -> bool:
        current = await job_manager.get_job_for_worker(check_job_id)
        return current is not None and current.status == JobStatus.CANCELLED

    node_agent = NodeAgent(
        agent=agent,
        capability_router=capability_router,
        registry=model_registry,
        scheduler=scheduler,
        available_models_provider=lambda: model_availability["models"],
        fallback_enabled=settings.model_fallback_enabled,
        is_cancelled=_job_cancelled,
        tools=tool_registry,
        ollama_service=ollama_service,
        unload_wait_seconds=settings.ollama_unload_wait_seconds,
    )

    worker = Worker(
        queue=job_queue,
        manager=job_manager,
        ollama=ollama_service,
        classifier=classifier,
        agent=agent,
        workspace_manager=workspace_manager,
        scheduler=scheduler,
        node_agent=node_agent,
        knowledge_base=knowledge_base,
        projects=projects,
        project_locks=project_locks,
        context_manager=context_manager,
    )

    app = FastAPI(
        title="Sovereign On-Premise Agentic AI Workbench",
        description=(
            "Local-only backend. Communicates exclusively with local services. "
            "Requests become jobs classified by task type, routed to a configured "
            "local model, scheduled against declared resource capacity, and executed "
            "by a local agent with workspace-scoped tools, an optional isolated "
            "Docker code-execution sandbox, a per-user local knowledge base "
            "(document_search), a local OCR + vision pipeline (document_vision), "
            "local Word deliverable generation (document_generation), and an "
            "execution trace."
        ),
        version="0.9.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.ollama_service = ollama_service
    app.state.job_manager = job_manager
    app.state.job_queue = job_queue
    app.state.worker = worker
    app.state.model_availability = model_availability
    app.state.model_registry = model_registry
    app.state.classifier = classifier
    app.state.tool_registry = tool_registry
    app.state.workspace_manager = workspace_manager
    app.state.agent = agent
    app.state.scheduler = scheduler
    app.state.projects = projects
    app.state.project_locks = project_locks
    app.state.context_manager = context_manager
    app.state.knowledge_base = knowledge_base
    app.state.embedding_provider = embedding
    app.state.multimodal_service = multimodal
    app.state.artifact_store = artifact_store
    app.state.document_generator = document_generators
    app.state.audit_store = audit_store
    app.state.network_guard = network_guard
    app.state.sandbox_runner = runner
    app.state.user_store = user_store
    app.state.session_secret = session_secret
    app.state.dev_header_auth = dev_header_auth

    cors_origins = [
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    ]
    if cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            # Required for the session cookie to cross the frontend/backend
            # origin pair; allow_origins above is an explicit list (never
            # "*"), which is what credentialed CORS requires.
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "X-User-ID", "X-Role"],
        )

    app.include_router(auth_router)
    app.include_router(chat_router)
    app.include_router(jobs_router)
    app.include_router(documents_router)
    app.include_router(artifacts_router)
    app.include_router(health_router)
    app.include_router(audit_router)
    app.include_router(admin_router)
    app.include_router(projects_router)
    app.include_router(workspace_router)
    app.include_router(sandbox_router)

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
