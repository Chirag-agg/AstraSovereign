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
    """Report backend liveness plus local runtime status (Ollama, models, queue, worker)."""
    settings = request.app.state.settings
    ollama_service = request.app.state.ollama_service
    manager = request.app.state.job_manager
    queue = request.app.state.job_queue
    worker = request.app.state.worker
    registry = request.app.state.model_registry

    ollama = {
        "reachable": False,
        "url": settings.ollama_base_url,
    }
    available_models: set[str] = set()
    try:
        model_list = await ollama_service.list_models()
        ollama["models"] = model_list
        ollama["reachable"] = True
        available_models = set(model_list)
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
    scheduler = request.app.state.scheduler

    return {
        "status": "ok",
        "service": "sovereign-backend",
        "ollama": ollama,
        "models": registry.availability(available_models),
        "default_model": settings.default_model,
        "queue_size": queue.qsize(),
        "jobs": job_stats,
        "scheduler": scheduler.stats(),
        "worker": {"state": worker.state, "active_job_id": worker.active_job_id},
    }
