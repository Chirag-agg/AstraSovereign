"""HTTP API: health check and chat."""

import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ollama_service import (
    OllamaModelNotFoundError,
    OllamaRequestError,
    OllamaTimeoutError,
    OllamaUnavailableError,
)

logger = logging.getLogger("app.api.chat")

router = APIRouter(tags=["chat"])


@router.get("/health", tags=["health"])
async def health(request: Request) -> dict:
    """Report backend liveness and the configured Ollama destination."""
    settings = request.app.state.settings
    service = request.app.state.ollama_service

    ollama = {
        "reachable": False,
        "url": settings.ollama_base_url,
    }
    try:
        ollama["models"] = await service.list_models()
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

    return {
        "status": "ok",
        "service": "sovereign-backend",
        "ollama": ollama,
        "default_model": settings.default_model,
    }


@router.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    """Forward a user message to the locally configured Ollama model."""
    service = request.app.state.ollama_service
    settings = request.app.state.settings
    message = payload.message.strip()

    logger.info(
        "chat_request_received",
        extra={
            "event": "chat_request",
            "model": service.default_model,
            "message_chars": len(message),
        },
    )
    logger.info(
        "ollama_request_start",
        extra={
            "event": "ollama_request_start",
            "url": settings.ollama_base_url,
            "model": service.default_model,
        },
    )

    try:
        response_text, model_used = await service.generate(message)
    except OllamaTimeoutError as exc:
        logger.error("ollama_timeout", extra={"event": "ollama_request_failed", "reason": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={"error": "ollama_timeout", "message": str(exc)},
        ) from exc
    except OllamaUnavailableError as exc:
        logger.error(
            "ollama_unavailable",
            extra={"event": "ollama_request_failed", "reason": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "ollama_unavailable", "message": str(exc)},
        ) from exc
    except OllamaModelNotFoundError as exc:
        logger.error(
            "ollama_model_not_found",
            extra={"event": "ollama_request_failed", "reason": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "model_not_found", "message": str(exc)},
        ) from exc
    except OllamaRequestError as exc:
        logger.error(
            "ollama_request_error",
            extra={"event": "ollama_request_failed", "reason": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "ollama_request_error", "message": str(exc)},
        ) from exc
    except Exception as exc:  # catch-all, unexpected backend failure
        logger.exception(
            "unexpected_backend_error",
            extra={"event": "ollama_request_failed"},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "An unexpected backend error occurred."},
        ) from exc

    logger.info(
        "ollama_request_success",
        extra={
            "event": "ollama_request_success",
            "model": model_used,
            "response_chars": len(response_text),
        },
    )
    return ChatResponse(response=response_text, model=model_used, status="success")
