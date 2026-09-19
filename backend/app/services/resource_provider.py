"""Resource providers: capacity + allocation accounting.

- ``InMemoryResourceProvider``: deterministic, used in tests and by default.
- ``LocalResourceProvider``: read-only, informational local hardware discovery
  (CPU count, system memory, optional nvidia-smi GPUs). Never requires NVIDIA
  tooling and is never used for allocation.
"""

import asyncio
import os
import shutil
import subprocess
from abc import ABC, abstractmethod
from typing import Optional

from app.schemas.resources import (
    GpuInfo,
    ResourceAllocation,
    ResourceCapacity,
    ResourceRequirements,
)


class ResourceProvider(ABC):
    """Exposes capacity and tracks per-job allocations."""

    @abstractmethod
    def capacity(self) -> ResourceCapacity:
        raise NotImplementedError

    @abstractmethod
    def allocated(self) -> list[ResourceAllocation]:
        raise NotImplementedError

    @abstractmethod
    async def try_allocate(
        self, job_id: str, req: ResourceRequirements, model: Optional[str] = None
    ) -> Optional[ResourceAllocation]:
        """Atomically grant resources if they fit; otherwise return ``None``.

        ``model`` is recorded on the allocation for visibility only (see
        ``ResourceAllocation.model``) — it plays no role in the fit check.
        """

    @abstractmethod
    async def release(self, job_id: str) -> Optional[ResourceAllocation]:
        """Release any allocation held by ``job_id``."""


class InMemoryResourceProvider(ResourceProvider):
    """Deterministic in-memory provider. Never exceeds configured capacity."""

    def __init__(self, capacity: ResourceCapacity) -> None:
        self._capacity = capacity
        self._allocations: dict[str, ResourceAllocation] = {}
        self._lock = asyncio.Lock()

    def capacity(self) -> ResourceCapacity:
        return self._capacity

    def allocated(self) -> list[ResourceAllocation]:
        return list(self._allocations.values())

    def _gpu_capacity(self, gpu_id: str) -> int:
        for gpu in self._capacity.gpus:
            if gpu.gpu_id == gpu_id:
                return gpu.vram_mb
        return 0

    async def try_allocate(
        self, job_id: str, req: ResourceRequirements, model: Optional[str] = None
    ) -> Optional[ResourceAllocation]:
        async with self._lock:
            # Exclude this job's own existing allocation so re-requests are idempotent.
            others = {k: v for k, v in self._allocations.items() if k != job_id}
            used_cpu = sum(a.cpu_cores for a in others.values())
            used_mem = sum(a.memory_mb for a in others.values())
            used_vram = sum(
                a.gpu_vram_mb
                for a in others.values()
                if req.gpu_id is not None and a.gpu_id == req.gpu_id
            )

            if used_cpu + req.cpu_cores > self._capacity.cpu_cores:
                return None
            if used_mem + req.memory_mb > self._capacity.memory_mb:
                return None
            if req.gpu_id is not None:
                gpu_capacity = self._gpu_capacity(req.gpu_id)
                if used_vram + req.gpu_vram_mb > gpu_capacity:
                    return None

            allocation = ResourceAllocation(
                job_id=job_id,
                cpu_cores=req.cpu_cores,
                memory_mb=req.memory_mb,
                gpu_id=req.gpu_id,
                gpu_vram_mb=req.gpu_vram_mb,
                model=model,
            )
            self._allocations[job_id] = allocation
            return allocation

    async def release(self, job_id: str) -> Optional[ResourceAllocation]:
        async with self._lock:
            return self._allocations.pop(job_id, None)


class LocalResourceProvider(ResourceProvider):
    """Read-only local hardware discovery (informational). Allocation unsupported."""

    def capacity(self) -> ResourceCapacity:
        return ResourceCapacity(
            cpu_cores=float(os.cpu_count() or 0),
            memory_mb=_system_memory_mb(),
            gpus=_discover_gpus(),
        )

    def allocated(self) -> list[ResourceAllocation]:
        return []

    async def try_allocate(self, job_id: str, req: ResourceRequirements, model: Optional[str] = None):
        raise NotImplementedError("LocalResourceProvider is read-only")

    async def release(self, job_id: str):
        raise NotImplementedError("LocalResourceProvider is read-only")


def _system_memory_mb() -> int:
    """Best-effort total system memory in MiB (0 if it cannot be determined)."""
    try:
        if os.name == "nt":
            import ctypes

            class MemoryStatusEx(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            status = MemoryStatusEx()
            status.dwLength = ctypes.sizeof(MemoryStatusEx)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
                return int(status.ullTotalPhys // (1024 * 1024))
            return 0
        with open("/proc/meminfo", "r", encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return kb // 1024
        return 0
    except Exception:
        return 0


def _discover_gpus() -> list[GpuInfo]:
    """Discover GPUs via nvidia-smi when present; otherwise return ``[]``."""
    if shutil.which("nvidia-smi") is None:
        return []
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=index,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10,
        )
        if out.returncode != 0:
            return []
        gpus = []
        for line in out.stdout.splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                gpus.append(GpuInfo(gpu_id=f"GPU-{parts[0]}", vram_mb=int(parts[1])))
        return gpus
    except Exception:
        return []
