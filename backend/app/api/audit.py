"""HTTP API: audit trail + sovereignty status (Phase 11).

The audit API is user-scoped: callers only ever see audit events that carry
their own ``user_id``. There is deliberately no generic log-file download.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import get_user_id
from app.services.job_manager import JobNotFoundError, JobPermissionError
from app.services.sovereignty import build_sovereignty_status

logger = logging.getLogger("app.api.audit")

router = APIRouter(tags=["audit"])


def _event_view(event) -> dict:
    return {
        "event_id": event.event_id,
        "timestamp": event.timestamp.isoformat(),
        "event_type": event.event_type,
        "component": event.component,
        "status": event.status,
        "job_id": event.job_id,
        "user_id": event.user_id,
        "metadata": event.metadata,
    }


@router.get("/api/sovereignty")
async def sovereignty(request: Request) -> dict:
    """Trustworthy sovereignty status assembled from real backend state."""
    settings = request.app.state.settings
    return build_sovereignty_status(
        request.app.state.audit_store,
        request.app.state.network_guard,
        ollama_url=settings.ollama_base_url,
    )


@router.get("/api/audit")
async def list_audit(
    request: Request,
    user_id: str = Depends(get_user_id),
    job_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    """Audit events scoped to the current user (optionally filtered by job)."""
    events = request.app.state.audit_store.list(
        user_id=user_id, job_id=job_id, limit=limit, offset=offset
    )
    return [_event_view(event) for event in events]


@router.get("/api/audit/verify")
async def verify_audit_chain(request: Request) -> dict:
    """Verify the tamper-evident hash chain of the local audit trail."""
    store = request.app.state.audit_store
    verify = getattr(store, "verify_chain", None)
    if verify is None:
        return {"intact": True, "first_bad_seq": None}
    intact, first_bad_seq = verify()
    return {"intact": intact, "first_bad_seq": first_bad_seq}


@router.get("/api/jobs/{job_id}/audit")
async def job_audit(
    job_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    """Audit timeline for one of the caller's jobs (ownership enforced)."""
    manager = request.app.state.job_manager
    try:
        await manager.get_job(user_id, job_id)
    except JobNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "job_not_found", "message": "Job not found."},
        )
    except JobPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "forbidden", "message": "You do not have access to this job."},
        )
    events = request.app.state.audit_store.list(user_id=user_id, job_id=job_id)
    return [_event_view(event) for event in events]
