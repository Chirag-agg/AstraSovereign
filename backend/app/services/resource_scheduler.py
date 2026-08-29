"""Resource scheduler: grant / wait / reject for job executions.

A job's resource requirements come from the selected model. The scheduler
grants immediately when resources fit, queues the job in FIFO order when they
do not, and rejects impossible requests cleanly (never waits forever). Released
capacity is always returned to the pool and never exceeds configured capacity.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from collections import OrderedDict
from typing import Optional

from pydantic import BaseModel

from app.schemas.resources import ResourceAllocation, ResourceRequirements
from app.services.resource_provider import ResourceProvider

logger = logging.getLogger("app.resource_scheduler")

GRANT = "grant"
WAIT = "wait"
REJECT = "reject"


class SchedulerDecision(BaseModel):
    decision: str
    allocation: Optional[ResourceAllocation] = None
    reason: Optional[str] = None


class ResourceScheduler(ABC):
    @abstractmethod
    async def request(self, job_id, user_id, model, requirements) -> SchedulerDecision:
        raise NotImplementedError

    @abstractmethod
    async def release(self, job_id: str) -> Optional[ResourceAllocation]:
        raise NotImplementedError

    @abstractmethod
    async def cancel(self, job_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def stats(self) -> dict:
        raise NotImplementedError


class InMemoryResourceScheduler(ResourceScheduler):
    """FIFO scheduler over an in-memory provider."""

    def __init__(self, provider: ResourceProvider) -> None:
        self._provider = provider
        self._waiters: "OrderedDict[str, tuple[str, ResourceRequirements]]" = OrderedDict()
        self._available = asyncio.Event()

    def provider(self) -> ResourceProvider:
        return self._provider

    def _rejection_reason(self, req: ResourceRequirements) -> Optional[str]:
        capacity = self._provider.capacity()
        if req.gpu_id is not None:
            gpu = next((g for g in capacity.gpus if g.gpu_id == req.gpu_id), None)
            if gpu is None:
                return f"Unknown GPU '{req.gpu_id}'"
            if req.gpu_vram_mb > gpu.vram_mb:
                return (
                    f"Requested {req.gpu_vram_mb} MB VRAM, "
                    f"system capacity is {gpu.vram_mb} MB"
                )
        if req.cpu_cores > capacity.cpu_cores:
            return (
                f"Requested {req.cpu_cores} CPU cores, "
                f"system capacity is {capacity.cpu_cores}"
            )
        if req.memory_mb > capacity.memory_mb:
            return (
                f"Requested {req.memory_mb} MB memory, "
                f"system capacity is {capacity.memory_mb}"
            )
        return None

    async def request(self, job_id: str, user_id: str, model: str, req: ResourceRequirements) -> SchedulerDecision:
        logger.info(
            "resource_requested",
            extra={
                "event": "resource_requested",
                "job_id": job_id,
                "user_id": user_id,
                "model": model,
                "cpu_cores": req.cpu_cores,
                "memory_mb": req.memory_mb,
                "gpu_id": req.gpu_id,
                "gpu_vram_mb": req.gpu_vram_mb,
            },
        )
        if req.is_empty:
            return SchedulerDecision(decision=GRANT)

        # A VRAM request without a specific GPU means "any GPU": bind it to the
        # first available one so capacity is enforced.
        if req.gpu_vram_mb > 0 and req.gpu_id is None:
            gpus = self._provider.capacity().gpus
            if not gpus:
                logger.warning(
                    "resource_rejected",
                    extra={
                        "event": "resource_rejected",
                        "job_id": job_id,
                        "user_id": user_id,
                        "model": model,
                        "reason": f"VRAM requested ({req.gpu_vram_mb} MB) but no GPU is available",
                    },
                )
                return SchedulerDecision(
                    decision=REJECT,
                    reason=f"VRAM requested ({req.gpu_vram_mb} MB) but no GPU is available",
                )
            req = req.model_copy(update={"gpu_id": gpus[0].gpu_id})

        reason = self._rejection_reason(req)
        if reason is not None:
            logger.warning(
                "resource_rejected",
                extra={
                    "event": "resource_rejected",
                    "job_id": job_id,
                    "user_id": user_id,
                    "model": model,
                    "reason": reason,
                },
            )
            return SchedulerDecision(decision=REJECT, reason=reason)

        allocation = await self._provider.try_allocate(job_id, req)
        if allocation is not None:
            self._waiters.pop(job_id, None)
            logger.info(
                "resource_allocated",
                extra={
                    "event": "resource_allocated",
                    "job_id": job_id,
                    "user_id": user_id,
                    "model": model,
                    "cpu_cores": allocation.cpu_cores,
                    "memory_mb": allocation.memory_mb,
                    "gpu_id": allocation.gpu_id,
                    "gpu_vram_mb": allocation.gpu_vram_mb,
                },
            )
            return SchedulerDecision(decision=GRANT, allocation=allocation)

        if job_id not in self._waiters:
            self._waiters[job_id] = (model, req)
        logger.info(
            "resource_waiting",
            extra={
                "event": "resource_waiting",
                "job_id": job_id,
                "user_id": user_id,
                "model": model,
                "waiters": len(self._waiters),
            },
        )
        return SchedulerDecision(decision=WAIT)

    async def release(self, job_id: str) -> Optional[ResourceAllocation]:
        allocation = await self._provider.release(job_id)
        if allocation is not None:
            logger.info(
                "resource_released",
                extra={
                    "event": "resource_released",
                    "job_id": job_id,
                    "cpu_cores": allocation.cpu_cores,
                    "memory_mb": allocation.memory_mb,
                    "gpu_id": allocation.gpu_id,
                    "gpu_vram_mb": allocation.gpu_vram_mb,
                },
            )
        self._available.set()
        return allocation

    async def cancel(self, job_id: str) -> bool:
        removed = self._waiters.pop(job_id, None) is not None
        if removed:
            logger.info(
                "resource_waiting_cancelled",
                extra={"event": "resource_waiting_cancelled", "job_id": job_id},
            )
        return removed

    async def wait_until_available(self, timeout: Optional[float] = 1.0) -> None:
        """Wait for a resource release (or timeout) so the caller can re-request."""
        self._available.clear()
        try:
            await asyncio.wait_for(self._available.wait(), timeout)
        except asyncio.TimeoutError:
            pass

    def stats(self) -> dict:
        allocations = self._provider.allocated()
        gpu = {}
        for gpu_info in self._provider.capacity().gpus:
            allocated_vram = sum(
                a.gpu_vram_mb for a in allocations if a.gpu_id == gpu_info.gpu_id
            )
            gpu[gpu_info.gpu_id] = {
                "allocated_vram_mb": allocated_vram,
                "capacity_vram_mb": gpu_info.vram_mb,
            }
        return {
            "queued_jobs": len(self._waiters),
            "running_jobs": len(allocations),
            "allocated": {
                "cpu_cores": sum(a.cpu_cores for a in allocations),
                "memory_mb": sum(a.memory_mb for a in allocations),
                "gpu": gpu,
            },
        }
