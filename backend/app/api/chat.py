"""HTTP API: chat job submission."""

import logging

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_user_id
from app.schemas.chat import ChatRequest
from app.schemas.job import JobSubmitResponse

logger = logging.getLogger("app.api.chat")

router = APIRouter(tags=["chat"])


@router.post("/api/chat", response_model=JobSubmitResponse, status_code=202)
async def chat(
    payload: ChatRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> JobSubmitResponse:
    """Accept a chat request as a job, enqueue it, and return immediately."""
    manager = request.app.state.job_manager
    queue = request.app.state.job_queue

    logger.info(
        "chat_request_received",
        extra={
            "event": "chat_request",
            "user_id": user_id,
            "message_chars": len(payload.message),
            "task_type": payload.task_type,
        },
    )

    job = await manager.create_job(
        user_id=user_id,
        message=payload.message,
        task_type=payload.task_type,
        priority=payload.priority,
    )
    await queue.enqueue(job.job_id)

    return JobSubmitResponse(job_id=job.job_id, status=job.status)
