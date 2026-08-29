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

    # Docker code-execution sandbox (Phase 5). Disabled by default; enabling it
    # registers the code_execution tool. The image must already exist locally —
    # the backend never pulls images.
    sandbox_enabled: bool = False
    sandbox_python_image: str = "python:3.12-alpine"
    sandbox_timeout_seconds: float = 10.0
    sandbox_cpu_limit: str = "0.5"
    sandbox_memory_limit: str = "128m"
    sandbox_max_stdout_chars: int = 4096
    sandbox_max_stderr_chars: int = 4096

    # Structured (JSON) logging.
    log_level: str = "INFO"
    log_file: str = str(REPO_ROOT / "logs" / "backend.log")


@lru_cache
def get_settings() -> Settings:
    return Settings()
