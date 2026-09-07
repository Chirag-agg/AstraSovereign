"""Application configuration, driven entirely by environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> parents[0]=backend/app, parents[1]=backend, parents[2]=repo root
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime settings. Every value can be overridden via environment variables
    or a local `.env` file (see `.env.example`). Nothing here is hardcoded in code."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Local Ollama endpoint. The backend must ONLY ever talk to this address.
    ollama_base_url: str = "http://localhost:11434"

    # Model used by POST /api/chat. Must be set in the environment / .env.
    default_model: str = ""

    # Uvicorn bind settings.
    host: str = "127.0.0.1"
    port: int = 8000

    # Per-request timeout for calls to Ollama (seconds).
    ollama_timeout_seconds: float = 120.0

    # Path to the models configuration file (task type -> model mapping).
    models_config: str = str(REPO_ROOT / "config" / "models.yaml")

    # Agent loop limits (bounded, deterministic termination).
    max_agent_iterations: int = 10
    max_agent_tool_calls: int = 20

    # Per-job workspace root (data/workspaces/<user>/<job>/).
    workspaces_root: str = str(REPO_ROOT / "data" / "workspaces")

    # Docker code-execution sandbox (Phase 5). Enabled by default so the
    # code_execution tool is always registered; if Docker is unavailable the
    # tool reports a clean runtime error instead of failing silently. The image
    # must already exist locally — the backend never pulls images.
    sandbox_enabled: bool = True
    sandbox_python_image: str = "python:3.12-alpine"
    sandbox_timeout_seconds: float = 10.0
    sandbox_cpu_limit: str = "0.5"
    sandbox_memory_limit: str = "128m"
    sandbox_max_stdout_chars: int = 4096
    sandbox_max_stderr_chars: int = 4096

    # Resource scheduler capacity (Phase 6). Mode "configured" uses the values
    # below; mode "auto" discovers local CPU/memory/GPU (informational).
    resource_capacity_mode: str = "configured"
    resource_cpu_cores: float = 8.0
    resource_memory_mb: int = 16384
    resource_gpu_vram_mb: int = 16384
    resource_gpu_count: int = 1

    # Local document knowledge base (Phase 7). All storage stays under the
    # knowledge base root (per-user subdirectories).
    knowledge_base_root: str = str(REPO_ROOT / "data" / "knowledge")
    uploads_root: str = str(REPO_ROOT / "data" / "uploads")

    # Deterministic text chunking.
    chunk_size: int = 800
    chunk_overlap: int = 100

    # Local embedding model (served by the local Ollama instance).
    embedding_model: str = "nomic-embed-text"

    # document_search tool limits.
    document_search_default_top_k: int = 5
    document_search_max_top_k: int = 10
    document_search_max_chunk_chars: int = 1000

    # Multimodal OCR + vision (Phase 8). Everything runs locally — the OCR
    # engine (RapidOCR) and PDF rendering (pypdfium2) are local libraries, and
    # the vision model is the registry-configured local multimodal model.
    ocr_enabled: bool = True
    ocr_max_pages: int = 50
    ocr_max_image_dimension: int = 4000
    ocr_render_scale: float = 2.0
    vision_max_pages: int = 5
    vision_resource_wait_rounds: int = 5
    multimodal_tmp_root: str = str(REPO_ROOT / "data" / "tmp")

    # Structured (JSON) logging.
    log_level: str = "INFO"
    log_file: str = str(REPO_ROOT / "logs" / "backend.log")

    # Frontend cross-origin allow-list (comma-separated). Only local dev
    # origins by default; the backend never talks to external services.
    cors_origins: str = "http://localhost:3000"

    # Local audit trail (Phase 11): append-only JSONL under this root.
    audit_root: str = str(REPO_ROOT / "data" / "audit")

    # Durable store snapshots so job/artifact history survives restarts.
    job_store_root: str = str(REPO_ROOT / "data" / "jobs")
    artifact_store_root: str = str(REPO_ROOT / "data" / "artifacts")

    # Multi-model pipeline (decompose complex tasks into capability stages).
    # Every capability executed by a stage must be on the server-side allowlist
    # in ``app.services.pipeline.ALLOWED_PIPELINE_CAPABILITIES``.
    pipeline_enabled: bool = True
    pipeline_planner_capability: str = "reasoning"
    pipeline_max_stages: int = 4
    pipeline_stage_max_iterations: int = 4
    pipeline_stage_max_tool_calls: int = 8
    pipeline_attempts: int = 2
    pipeline_min_prompt_chars: int = 40
    # Hard truncation caps for stage-output chaining (never silent).
    pipeline_max_stage_output_chars: int = 12000
    pipeline_max_context_chars: int = 16000
@lru_cache
def get_settings() -> Settings:
    return Settings()
