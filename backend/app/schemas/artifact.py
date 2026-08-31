"""Artifact models for generated deliverables (Phase 9)."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ArtifactStatus:
    CREATING = "creating"
    COMPLETED = "completed"
    FAILED = "failed"


class Artifact(BaseModel):
    """A generated deliverable associated with its creating job and user.

    ``path`` is the absolute on-disk location (internal only — never exposed
    through the API or logs).
    """

    artifact_id: str
    job_id: str
    user_id: str
    filename: str
    type: str  # "word" in this phase (excel/pptx reserved)
    path: str
    created_at: datetime = Field(default_factory=utcnow)
    size_bytes: int = 0
    status: str = ArtifactStatus.CREATING
    metadata: dict = Field(default_factory=dict)


class ArtifactSummary(BaseModel):
    """Safe, serializable view of an artifact (no path, no internals)."""

    artifact_id: str
    filename: str
    type: str
    size_bytes: int
    status: str
    created_at: datetime

    @classmethod
    def from_artifact(cls, artifact: Artifact) -> "ArtifactSummary":
        return cls(
            artifact_id=artifact.artifact_id,
            filename=artifact.filename,
            type=artifact.type,
            size_bytes=artifact.size_bytes,
            status=artifact.status,
            created_at=artifact.created_at,
        )
