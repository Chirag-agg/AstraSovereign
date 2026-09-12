"""HTTP API: health / runtime status."""

import logging

from fastapi import APIRouter, Request

from app.services.ollama_service import (
    OllamaRequestError,
    OllamaTimeoutError,
    OllamaUnavailableError,
)
from app.services.sovereignty import build_sovereignty_status

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
    knowledge_base = request.app.state.knowledge_base
    multimodal = request.app.state.multimodal_service
    artifact_store = request.app.state.artifact_store
    document_generator = request.app.state.document_generator

    document_generation = {
        "available": True,
        "word": "available",
        "artifacts": artifact_store.stats(),
    }
    if not document_generator.supported_types:
        document_generation = {"available": False, "word": "unavailable", "artifacts": artifact_store.stats()}

    return {
        "status": "ok",
        "service": "sovereign-backend",
        "ollama": ollama,
        "models": registry.availability(available_models),
        "models_missing": registry.missing_models(available_models),
        "models_resolved": registry.resolved_availability(
            available_models, settings.model_fallback_enabled
        ),
        "default_model": settings.default_model,
        "queue_size": queue.qsize(),
        "jobs": job_stats,
        "scheduler": scheduler.stats(),
        "knowledge_base": {
            **knowledge_base.stats(),
            "embedding": knowledge_base.describe_embedding(),
            "vector_store": "json",
        },
        "multimodal": multimodal.describe_status(available_models),
        "document_generation": document_generation,
        "sovereignty": build_sovereignty_status(
            request.app.state.audit_store,
            request.app.state.network_guard,
            ollama_url=settings.ollama_base_url,
        ),
        "worker": {"state": worker.state, "active_job_id": worker.active_job_id},
    }
