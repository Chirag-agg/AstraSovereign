"""HTTP API: health / runtime status."""

import logging

from fastapi import APIRouter, Request

from app.services.ollama_service import (
    OllamaRequestError,
    OllamaTimeoutError,
    OllamaUnavailableError,
)

logger = logging.getLogger("app.api.health")

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict:
    """Report backend liveness plus local runtime status (Ollama, queue, worker)."""
    settings = request.app.state.settings
    ollama_service = request.app.state.ollama_service
    manager = request.app.state.job_manager
    queue = request.app.state.job_queue
    worker = request.app.state.worker

    ollama = {
        "reachable": False,
        "url": settings.ollama_base_url,
    }
    try:
        ollama["models"] = await ollama_service.list_models()
        ollama["reachable"] = True
    except (OllamaUnavailableError, OllamaTimeoutError) as exc:
        logger.warning(
            "health_ollama_unreachable",
            extra={"event": "health_ollama_unreachable", "reason": str(exc)},
        )
        ollama["error"] = str(exc)
    except OllamaRequestError as exc:
        logger.warning(
            "health_ollama_error",
            extra={"event": "health_ollama_error", "reason": str(exc)},
        )
        ollama["error"] = str(exc)

    job_stats = await manager.stats()

    return {
        "status": "ok",
        "service": "sovereign-backend",
        "ollama": ollama,
        "default_model": settings.default_model,
        "queue_size": queue.qsize(),
        "jobs": job_stats,
        "worker": {"state": worker.state, "active_job_id": worker.active_job_id},
    }
