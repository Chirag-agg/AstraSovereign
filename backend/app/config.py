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

    # Structured (JSON) logging.
    log_level: str = "INFO"
    log_file: str = str(REPO_ROOT / "logs" / "backend.log")


@lru_cache
def get_settings() -> Settings:
    return Settings()
