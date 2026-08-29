"""HTTP API: job retrieval, listing, and cancellation.

Ownership is enforced by the JobManager; these routes only translate errors.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import get_user_id
from app.schemas.job import Job, JobStatus, JobSummary
from app.services.job_manager import JobNotFoundError, JobPermissionError, JobStateError

logger = logging.getLogger("app.api.jobs")

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> Job:
    """Return a job's full detail, but only to its owner."""
    manager = request.app.state.job_manager
    try:
        return await manager.get_job(user_id, job_id)
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


@router.get("", response_model=list[JobSummary])
async def list_jobs(
    request: Request,
    user_id: str = Depends(get_user_id),
    job_status: Optional[JobStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[JobSummary]:
    """List the caller's own jobs (newest first). Never returns other users' jobs."""
    manager = request.app.state.job_manager
    jobs = await manager.list_jobs(
        user_id,
        status=job_status,
        limit=limit,
        offset=offset,
    )
    return [JobSummary.from_job(job) for job in jobs]


@router.delete("/{job_id}", response_model=Job)
async def cancel_job(
    job_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> Job:
    """Cancel a queued job. Running or terminal jobs cannot be cancelled."""
    manager = request.app.state.job_manager
    try:
        return await manager.cancel_job(user_id, job_id)
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
    except JobStateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "invalid_state", "message": str(exc)},
        )
