"""Job storage abstraction.

Phase 2 ships an in-memory implementation. The ``JobStore`` interface is the
seam that makes a later swap to Redis/Postgres/etc. straightforward without
touching the manager, worker, or API layers.
"""

import asyncio
import uuid
from abc import ABC, abstractmethod
from typing import Optional

from app.schemas.job import Job, JobStatus


class JobStore(ABC):
    """Persistence interface for jobs."""

    @abstractmethod
    async def create(self, job: Job) -> Job:
        """Persist a new job, assigning it a unique ``job_id``."""

    @abstractmethod
    async def get(self, job_id: str) -> Optional[Job]:
        """Fetch a job by id, or ``None`` if it does not exist."""

    @abstractmethod
    async def update(self, job_id: str, **fields) -> Optional[Job]:
        """Apply field updates to a job, or ``None`` if it does not exist."""

    @abstractmethod
    async def list_all(self) -> list[Job]:
        """Return a snapshot of every stored job."""


class InMemoryJobStore(JobStore):
    """Thread-safe-async in-memory job store (single process)."""

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _new_id() -> str:
        return f"job-{uuid.uuid4().hex[:12]}"

    async def create(self, job: Job) -> Job:
        async with self._lock:
            created = job.model_copy(update={"job_id": self._new_id()})
            self._jobs[created.job_id] = created
            return created

    async def get(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            return self._jobs.get(job_id)

    async def update(self, job_id: str, **fields) -> Optional[Job]:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            updated = job.model_copy(update=dict(fields))
            self._jobs[job_id] = updated
            return updated

    async def list_all(self) -> list[Job]:
        async with self._lock:
            return list(self._jobs.values())
