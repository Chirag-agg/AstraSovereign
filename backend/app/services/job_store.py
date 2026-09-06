"""Job storage abstraction.

The ``JobStore`` interface is the seam that makes a later swap to
Redis/Postgres/etc. straightforward without touching the manager, worker, or API
layers. ``InMemoryJobStore`` keeps jobs in memory and (when a root directory is
provided) snapshots them to disk after every mutation so history survives
backend restarts (single process).
"""

import asyncio
import json
import os
import tempfile
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.schemas.job import Job


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
    """In-memory job store with optional on-disk persistence.

    ``root`` may be a directory. When provided, jobs are loaded from
    ``<root>/jobs.json`` on first access and the file is rewritten after each
    mutation, so a process restart does not lose history.
    """

    def __init__(self, root: Optional[str] = None) -> None:
        self._root = Path(root) if root else None
        self._jobs: dict[str, Job] = {}
        self._loaded = False
        self._lock = asyncio.Lock()

    @staticmethod
    def _new_id() -> str:
        return f"job-{uuid.uuid4().hex[:12]}"

    def _snapshot_path(self) -> Path:
        return self._root / "jobs.json"

    async def _ensure_loaded(self) -> None:
        if self._loaded or self._root is None:
            return
        self._loaded = True
        path = self._snapshot_path()
        if not path.is_file():
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            for item in raw:
                try:
                    job = Job(**item)
                    self._jobs[job.job_id] = job
                except (TypeError, ValueError):
                    continue
        except (json.JSONDecodeError, OSError):
            self._jobs = {}

    def _persist(self) -> None:
        if self._root is None:
            return
        self._root.mkdir(parents=True, exist_ok=True)
        path = self._snapshot_path()
        payload = json.dumps(
            [job.model_dump(mode="json") for job in self._jobs.values()],
            default=str,
        )
        fd, tmp_name = tempfile.mkstemp(dir=str(self._root), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(payload)
            os.replace(tmp_name, path)
        finally:
            if os.path.exists(tmp_name):
                try:
                    os.unlink(tmp_name)
                except OSError:
                    pass

    async def create(self, job: Job) -> Job:
        async with self._lock:
            await self._ensure_loaded()
            created = job.model_copy(update={"job_id": self._new_id()})
            self._jobs[created.job_id] = created
            self._persist()
            return created

    async def get(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            await self._ensure_loaded()
            return self._jobs.get(job_id)

    async def update(self, job_id: str, **fields) -> Optional[Job]:
        async with self._lock:
            await self._ensure_loaded()
            job = self._jobs.get(job_id)
            if job is None:
                return None
            updated = job.model_copy(update=dict(fields))
            self._jobs[job_id] = updated
            self._persist()
            return updated

    async def list_all(self) -> list[Job]:
        async with self._lock:
            await self._ensure_loaded()
            return list(self._jobs.values())
