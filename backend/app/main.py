"""FastAPI application entry point.

The backend talks only to the locally configured Ollama endpoint
(``OLLAMA_BASE_URL``). No external AI services, no telemetry.
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
from app.config import Settings, get_settings
from app.services.ollama_service import OllamaService

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
    logger.info(
        "application_startup",
        extra={
            "event": "application_startup",
            "ollama_url": settings.ollama_base_url,
            "default_model": settings.default_model,
            "host": settings.host,
            "port": settings.port,
        },
    )
    yield
    await service.aclose()


def create_app(
    settings: Optional[Settings] = None,
    ollama_transport: Optional[httpx.AsyncBaseTransport] = None,
) -> FastAPI:
    """Build the FastAPI application.

    ``ollama_transport`` is a test seam for mocking the Ollama server.
    """
    settings = settings or get_settings()
    setup_logging(settings)

    if not settings.default_model:
        logger.warning(
            "DEFAULT_MODEL is not set; /api/chat will fail until it is configured.",
            extra={"event": "startup_warning"},
        )

    service = OllamaService(
        base_url=settings.ollama_base_url,
        default_model=settings.default_model,
        timeout_seconds=settings.ollama_timeout_seconds,
        transport=ollama_transport,
    )

    app = FastAPI(
        title="Sovereign On-Premise Agentic AI Workbench",
        description="Local-only backend. Communicates exclusively with the local Ollama server.",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.ollama_service = service
    app.include_router(chat_router)

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
