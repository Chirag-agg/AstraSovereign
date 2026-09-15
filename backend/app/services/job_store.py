"""Job storage abstraction.

``JobStore`` is the persistence seam. ``SqliteJobStore`` is the production
implementation (one SQLite file, WAL, row-level read-modify-write per mutation).
``InMemoryJobStore`` is a pure in-memory test double.
"""

import asyncio
import json
import sqlite3
import uuid
from abc import ABC, abstractmethod
from typing import Optional

from app.schemas.job import Job
from app.services import db


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


def _new_job_id() -> str:
    return f"job-{uuid.uuid4().hex[:12]}"


class SqliteJobStore(JobStore):
    """Durable SQLite-backed job store."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._conn = db.get_connection(path)
        db.init_schema(self._conn)

    @staticmethod
    def _row_to_job(row: sqlite3.Row) -> Job:
        return Job(**json.loads(row["data"]))

    def _create_sync(self, job: Job) -> Job:
        created = job.model_copy(update={"job_id": _new_job_id()})
        with db.jobs_lock:
            self._conn.execute(
                "INSERT INTO jobs (job_id, user_id, status, created_at, updated_at, data) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    created.job_id,
                    created.user_id,
                    created.status.value,
                    created.created_at.isoformat(),
                    created.created_at.isoformat(),
                    json.dumps(created.model_dump(mode="json")),
                ),
            )
            self._conn.commit()
        return created

    async def create(self, job: Job) -> Job:
        return await asyncio.to_thread(self._create_sync, job)

    def _get_sync(self, job_id: str) -> Optional[Job]:
        with db.jobs_lock:
            row = self._conn.execute("SELECT data FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        return self._row_to_job(row) if row is not None else None

    async def get(self, job_id: str) -> Optional[Job]:
        return await asyncio.to_thread(self._get_sync, job_id)

    def _update_sync(self, job_id: str, fields: dict) -> Optional[Job]:
        with db.jobs_lock:
            row = self._conn.execute("SELECT data FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
            if row is None:
                return None
            updated = self._row_to_job(row).model_copy(update=fields)
            self._conn.execute(
                "UPDATE jobs SET user_id = ?, status = ?, updated_at = ?, data = ? WHERE job_id = ?",
                (
                    updated.user_id,
                    updated.status.value,
                    (updated.completed_at or updated.started_at or updated.created_at).isoformat(),
                    json.dumps(updated.model_dump(mode="json")),
                    job_id,
                ),
            )
            self._conn.commit()
        return updated

    async def update(self, job_id: str, **fields) -> Optional[Job]:
        return await asyncio.to_thread(self._update_sync, job_id, dict(fields))

    def _list_all_sync(self) -> list[Job]:
        with db.jobs_lock:
            rows = self._conn.execute("SELECT data FROM jobs").fetchall()
        return [self._row_to_job(row) for row in rows]

    async def list_all(self) -> list[Job]:
        return await asyncio.to_thread(self._list_all_sync)


class InMemoryJobStore(JobStore):
    """Pure in-memory job store (test double; no persistence)."""

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()

    async def create(self, job: Job) -> Job:
        async with self._lock:
            created = job.model_copy(update={"job_id": _new_job_id()})
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
