"""Artifact store: metadata for generated deliverables.

Generated files stay on disk inside the job workspace. ``SqliteArtifactStore`` is
the durable implementation; ``InMemoryArtifactStore`` is a pure in-memory test
double.
"""

import asyncio
import json
import logging
import sqlite3
from abc import ABC, abstractmethod
from typing import Optional

from app.schemas.artifact import Artifact, ArtifactStatus
from app.services import db

logger = logging.getLogger("app.artifact_store")


class ArtifactStore(ABC):
    @abstractmethod
    async def create(self, artifact: Artifact) -> Artifact:
        raise NotImplementedError

    @abstractmethod
    async def get(self, artifact_id: str) -> Optional[Artifact]:
        raise NotImplementedError

    @abstractmethod
    async def list_for_job(self, job_id: str) -> list[Artifact]:
        raise NotImplementedError

    @abstractmethod
    async def list_for_user(self, user_id: str) -> list[Artifact]:
        raise NotImplementedError

    @abstractmethod
    async def update(self, artifact_id: str, **fields) -> Optional[Artifact]:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, artifact_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def stats(self) -> dict:
        raise NotImplementedError


class SqliteArtifactStore(ArtifactStore):
    """Durable SQLite-backed artifact metadata store."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._conn = db.get_connection(path)
        db.init_schema(self._conn)

    @staticmethod
    def _row_to_artifact(row: sqlite3.Row) -> Artifact:
        return Artifact(**json.loads(row["data"]))

    def _create_sync(self, artifact: Artifact) -> Artifact:
        with db.jobs_lock:
            self._conn.execute(
                "INSERT INTO artifacts (artifact_id, job_id, user_id, status, created_at, data) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    artifact.artifact_id,
                    artifact.job_id,
                    artifact.user_id,
                    artifact.status,
                    artifact.created_at.isoformat(),
                    json.dumps(artifact.model_dump(mode="json")),
                ),
            )
            self._conn.commit()
        return artifact

    async def create(self, artifact: Artifact) -> Artifact:
        return await asyncio.to_thread(self._create_sync, artifact)

    def _get_sync(self, artifact_id: str) -> Optional[Artifact]:
        with db.jobs_lock:
            row = self._conn.execute(
                "SELECT data FROM artifacts WHERE artifact_id = ?", (artifact_id,)
            ).fetchone()
        return self._row_to_artifact(row) if row is not None else None

    async def get(self, artifact_id: str) -> Optional[Artifact]:
        return await asyncio.to_thread(self._get_sync, artifact_id)

    def _list_sync(self, column: str, value: str) -> list[Artifact]:
        with db.jobs_lock:
            rows = self._conn.execute(
                f"SELECT data FROM artifacts WHERE {column} = ?", (value,)
            ).fetchall()
        return [self._row_to_artifact(row) for row in rows]

    async def list_for_job(self, job_id: str) -> list[Artifact]:
        return await asyncio.to_thread(self._list_sync, "job_id", job_id)

    async def list_for_user(self, user_id: str) -> list[Artifact]:
        return await asyncio.to_thread(self._list_sync, "user_id", user_id)

    def _update_sync(self, artifact_id: str, fields: dict) -> Optional[Artifact]:
        with db.jobs_lock:
            row = self._conn.execute(
                "SELECT data FROM artifacts WHERE artifact_id = ?", (artifact_id,)
            ).fetchone()
            if row is None:
                return None
            updated = self._row_to_artifact(row).model_copy(update=fields)
            self._conn.execute(
                "UPDATE artifacts SET job_id = ?, user_id = ?, status = ?, data = ? WHERE artifact_id = ?",
                (
                    updated.job_id,
                    updated.user_id,
                    updated.status,
                    json.dumps(updated.model_dump(mode="json")),
                    artifact_id,
                ),
            )
            self._conn.commit()
        return updated

    async def update(self, artifact_id: str, **fields) -> Optional[Artifact]:
        return await asyncio.to_thread(self._update_sync, artifact_id, dict(fields))

    def _delete_sync(self, artifact_id: str) -> bool:
        with db.jobs_lock:
            cursor = self._conn.execute(
                "DELETE FROM artifacts WHERE artifact_id = ?", (artifact_id,)
            )
            self._conn.commit()
            return cursor.rowcount > 0

    async def delete(self, artifact_id: str) -> bool:
        return await asyncio.to_thread(self._delete_sync, artifact_id)

    def stats(self) -> dict:
        with db.jobs_lock:
            total = self._conn.execute("SELECT COUNT(*) AS n FROM artifacts").fetchone()["n"]
            completed = self._conn.execute(
                "SELECT COUNT(*) AS n FROM artifacts WHERE status = ?",
                (ArtifactStatus.COMPLETED,),
            ).fetchone()["n"]
        return {"artifacts": total, "completed": completed}


class InMemoryArtifactStore(ArtifactStore):
    """Pure in-memory artifact store (test double; no persistence)."""

    def __init__(self) -> None:
        self._artifacts: dict[str, Artifact] = {}
        self._lock = asyncio.Lock()

    async def create(self, artifact: Artifact) -> Artifact:
        async with self._lock:
            self._artifacts[artifact.artifact_id] = artifact
        return artifact

    async def get(self, artifact_id: str) -> Optional[Artifact]:
        async with self._lock:
            return self._artifacts.get(artifact_id)

    async def list_for_job(self, job_id: str) -> list[Artifact]:
        async with self._lock:
            return [a for a in self._artifacts.values() if a.job_id == job_id]

    async def list_for_user(self, user_id: str) -> list[Artifact]:
        async with self._lock:
            return [a for a in self._artifacts.values() if a.user_id == user_id]

    async def update(self, artifact_id: str, **fields) -> Optional[Artifact]:
        async with self._lock:
            artifact = self._artifacts.get(artifact_id)
            if artifact is None:
                return None
            updated = artifact.model_copy(update=fields)
            self._artifacts[artifact_id] = updated
            return updated

    async def delete(self, artifact_id: str) -> bool:
        async with self._lock:
            return self._artifacts.pop(artifact_id, None) is not None

    def stats(self) -> dict:
        completed = sum(
            1 for a in self._artifacts.values() if a.status == ArtifactStatus.COMPLETED
        )
        return {"artifacts": len(self._artifacts), "completed": completed}
