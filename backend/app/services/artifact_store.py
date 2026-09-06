"""Artifact store: metadata for generated deliverables.

The generated files themselves stay on disk inside the job workspace.
``InMemoryArtifactStore`` keeps metadata in memory and, when given a root
directory, snapshots it to ``<root>/artifacts.json`` after every mutation so the
artifact history survives backend restarts. The ``ArtifactStore`` abstraction is
the seam for moving persistence to a database later.
"""

import asyncio
import json
import logging
import os
import tempfile
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.schemas.artifact import Artifact, ArtifactStatus, ArtifactSummary

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


class InMemoryArtifactStore(ArtifactStore):
    """In-memory artifact metadata store with optional on-disk persistence."""

    def __init__(self, root: Optional[str] = None) -> None:
        self._root = Path(root) if root else None
        self._artifacts: dict[str, Artifact] = {}
        self._loaded = False
        self._lock = asyncio.Lock()

    def _snapshot_path(self) -> Path:
        return self._root / "artifacts.json"

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
                    artifact = Artifact(**item)
                    self._artifacts[artifact.artifact_id] = artifact
                except (TypeError, ValueError):
                    continue
        except (json.JSONDecodeError, OSError):
            self._artifacts = {}

    def _persist(self) -> None:
        if self._root is None:
            return
        self._root.mkdir(parents=True, exist_ok=True)
        path = self._snapshot_path()
        payload = json.dumps(
            [artifact.model_dump(mode="json") for artifact in self._artifacts.values()],
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

    async def create(self, artifact: Artifact) -> Artifact:
        async with self._lock:
            await self._ensure_loaded()
            self._artifacts[artifact.artifact_id] = artifact
            self._persist()
        return artifact

    async def get(self, artifact_id: str) -> Optional[Artifact]:
        async with self._lock:
            await self._ensure_loaded()
            return self._artifacts.get(artifact_id)

    async def list_for_job(self, job_id: str) -> list[Artifact]:
        async with self._lock:
            await self._ensure_loaded()
            return [
                artifact
                for artifact in self._artifacts.values()
                if artifact.job_id == job_id
            ]

    async def list_for_user(self, user_id: str) -> list[Artifact]:
        async with self._lock:
            await self._ensure_loaded()
            return [
                artifact
                for artifact in self._artifacts.values()
                if artifact.user_id == user_id
            ]

    async def update(self, artifact_id: str, **fields) -> Optional[Artifact]:
        async with self._lock:
            await self._ensure_loaded()
            artifact = self._artifacts.get(artifact_id)
            if artifact is None:
                return None
            updated = artifact.model_copy(update=fields)
            self._artifacts[artifact_id] = updated
            self._persist()
            return updated

    async def delete(self, artifact_id: str) -> bool:
        async with self._lock:
            await self._ensure_loaded()
            removed = self._artifacts.pop(artifact_id, None) is not None
            if removed:
                self._persist()
            return removed

    def stats(self) -> dict:
        completed = sum(
            1 for artifact in self._artifacts.values()
            if artifact.status == ArtifactStatus.COMPLETED
        )
        return {
            "artifacts": len(self._artifacts),
            "completed": completed,
        }
