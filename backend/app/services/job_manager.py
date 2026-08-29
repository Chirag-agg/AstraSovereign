"""Job Manager: job lifecycle, storage, and user ownership.

All ownership checks live here so API routes never have to re-implement them.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from app.schemas.job import Job, JobStatus
from app.services.job_store import JobStore

logger = logging.getLogger("app.job_manager")


class JobNotFoundError(Exception):
    """A job with the given id does not exist."""


class JobPermissionError(Exception):
    """The requesting user does not own the job."""


class JobStateError(Exception):
    """A job cannot transition to the requested state."""


class JobManager:
    def __init__(self, store: JobStore, default_model: str = "") -> None:
        self._store = store
        self._default_model = default_model

    async def create_job(
        self,
        user_id: str,
        message: str,
        task_type: str = "general",
        priority: int = 0,
    ) -> Job:
        job = await self._store.create(
            Job(
                user_id=user_id,
                message=message,
                task_type=task_type or "general",
                priority=priority,
                model=self._default_model or None,
                status=JobStatus.QUEUED,
            )
        )
        logger.info(
            "job_created",
            extra={
                "event": "job_created",
                "job_id": job.job_id,
                "user_id": job.user_id,
                "status": job.status.value,
                "task_type": job.task_type,
                "priority": job.priority,
            },
        )
        return job

    async def get_job(self, user_id: str, job_id: str) -> Job:
        """Fetch a job, enforcing that it belongs to ``user_id``."""
        job = await self._store.get(job_id)
        if job is None:
            raise JobNotFoundError(job_id)
        if job.user_id != user_id:
            raise JobPermissionError(job_id)
        return job

    async def get_job_for_worker(self, job_id: str) -> Optional[Job]:
        """Fetch a job without an ownership check. Internal use only (worker)."""
        return await self._store.get(job_id)

    async def list_jobs(
        self,
        user_id: str,
        status: Optional[JobStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Job]:
        """List jobs owned by ``user_id``, newest first. Never leaks other users' jobs."""
        own = [job for job in await self._store.list_all() if job.user_id == user_id]
        if status is not None:
            own = [job for job in own if job.status == status]
        own.sort(key=lambda job: (job.created_at, job.job_id), reverse=True)
        return own[offset : offset + limit]

    async def update_job(self, job_id: str, **fields) -> Job:
        updated = await self._store.update(job_id, **fields)
        if updated is None:
            raise JobNotFoundError(job_id)
        return updated

    async def cancel_job(self, user_id: str, job_id: str) -> Job:
        """Cancel a queued job. Running/terminal jobs cannot be cancelled."""
        job = await self.get_job(user_id, job_id)
        if job.status != JobStatus.QUEUED:
            raise JobStateError(
                f"Job {job_id} is {job.status.value} and cannot be cancelled."
            )
        updated = await self.update_job(
            job_id,
            status=JobStatus.CANCELLED,
            completed_at=datetime.now(timezone.utc),
        )
        logger.info(
            "job_cancelled",
            extra={
                "event": "job_cancelled",
                "job_id": job_id,
                "user_id": user_id,
                "status": updated.status.value,
            },
        )
        return updated

    async def stats(self) -> dict:
        """Aggregate job counts for health/status reporting."""
        counts = {status.value: 0 for status in JobStatus}
        total = 0
        for job in await self._store.list_all():
            counts[job.status.value] = counts.get(job.status.value, 0) + 1
            total += 1
        return {
            "total": total,
            "queued": counts[JobStatus.QUEUED.value],
            "running": counts[JobStatus.RUNNING.value],
            "completed": counts[JobStatus.COMPLETED.value],
            "failed": counts[JobStatus.FAILED.value],
            "cancelled": counts[JobStatus.CANCELLED.value],
        }
