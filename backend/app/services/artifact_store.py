"""Artifact store: metadata for generated deliverables.

``InMemoryArtifactStore`` is a lock-guarded in-memory implementation — the
generated files themselves stay on disk inside the job workspace. The
``ArtifactStore`` abstraction is the seam for moving persistence to a database
later without touching the tools or API.
"""

import asyncio
import logging
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
    """In-memory artifact metadata store (files remain on disk)."""

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
            return [
                artifact
                for artifact in self._artifacts.values()
                if artifact.job_id == job_id
            ]

    async def list_for_user(self, user_id: str) -> list[Artifact]:
        async with self._lock:
            return [
                artifact
                for artifact in self._artifacts.values()
                if artifact.user_id == user_id
            ]

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
            1 for artifact in self._artifacts.values()
            if artifact.status == ArtifactStatus.COMPLETED
        )
        return {
            "artifacts": len(self._artifacts),
            "completed": completed,
        }
