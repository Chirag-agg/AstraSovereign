"""Typed resource models for the resource scheduler."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ResourceRequirements(BaseModel):
    """Declared resource requirements for a job (from the selected model)."""

    cpu_cores: float = 0.0
    memory_mb: int = 0
    gpu_id: Optional[str] = None
    gpu_vram_mb: int = 0

    @property
    def is_empty(self) -> bool:
        return not (self.cpu_cores or self.memory_mb or self.gpu_vram_mb)


class ResourceAllocation(BaseModel):
    """A granted allocation for one running job.

    ``model`` is the scheduler's own belief about what this allocation is
    for — a label, not a residency guarantee. Ollama's own ``/api/ps``
    (surfaced separately by /api/admin/resources as ``ollama_resident``) is
    the ground truth for what is actually loaded in VRAM.
    """

    job_id: str
    cpu_cores: float = 0.0
    memory_mb: int = 0
    gpu_id: Optional[str] = None
    gpu_vram_mb: int = 0
    model: Optional[str] = None
    allocated_at: datetime = Field(default_factory=utcnow)


class GpuInfo(BaseModel):
    """One local GPU and its VRAM capacity."""

    gpu_id: str
    vram_mb: int


class ResourceCapacity(BaseModel):
    """Total system capacity the scheduler may never exceed."""

    cpu_cores: float = 0.0
    memory_mb: int = 0
    gpus: list[GpuInfo] = Field(default_factory=list)
