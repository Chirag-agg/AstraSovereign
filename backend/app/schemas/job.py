"""Job model and API schemas for the job queue."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.artifact import ArtifactSummary


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobCreate(BaseModel):
    """Payload used to create a job."""

    user_id: str = Field(..., max_length=64)
    message: str = Field(..., min_length=1)
    task_type: str = "general"
    priority: int = 0


class Job(BaseModel):
    """Persistent representation of a single user request."""

    job_id: str = Field(default="", description="Assigned by the JobStore on creation.")
    user_id: str
    message: str
    task_type: str = "general"
    status: JobStatus = JobStatus.QUEUED
    priority: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    model: Optional[str] = None
    response: Optional[str] = None
    error: Optional[str] = None

    # Agent execution fields (Phase 4).
    agent_stage: Optional[str] = None
    iteration_count: int = 0
    tool_call_count: int = 0
    execution_trace: list[dict] = Field(default_factory=list)

    # Resource scheduling status (Phase 6): not_required | waiting | allocated |
    # released | rejected.
    resource_status: str = "not_required"

    # Generated deliverables for this job (Phase 9). Populated by the jobs API
    # from the ArtifactStore; the store remains the source of truth.
    artifacts: list[ArtifactSummary] = Field(default_factory=list)


class JobSubmitResponse(BaseModel):
    """Returned immediately when a job is accepted into the queue."""

    job_id: str
    status: JobStatus = JobStatus.QUEUED


class JobSummary(BaseModel):
    """Lightweight view of a job, used for listings (no response/error/trace)."""

    job_id: str
    user_id: str
    message: str = ""
    task_type: str
    status: JobStatus
    priority: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    model: Optional[str] = None

    @classmethod
    def from_job(cls, job: Job) -> "JobSummary":
        return cls(
            job_id=job.job_id,
            user_id=job.user_id,
            message=job.message,
            task_type=job.task_type,
            status=job.status,
            priority=job.priority,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            model=job.model,
        )
