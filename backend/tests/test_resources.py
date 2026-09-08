"""Unit tests for the resource scheduler and provider (no worker, no Docker).

These exercise the scheduler's grant/wait/reject semantics, capacity accounting,
FIFO ordering, release/cleanup, and the five-user simulation directly.
"""

import asyncio

import pytest

from app.schemas.resources import GpuInfo, ResourceCapacity, ResourceRequirements
from app.services.model_registry import ModelConfig, ModelRegistry
from app.services.model_router import ModelRouter
from app.services.resource_provider import InMemoryResourceProvider, LocalResourceProvider
from app.services.resource_scheduler import InMemoryResourceScheduler

VRAM_8GB = ResourceRequirements(
    cpu_cores=2.0, memory_mb=4096, gpu_id="GPU-0", gpu_vram_mb=8192
)
VRAM_16GB_CAP = ResourceCapacity(
    cpu_cores=8.0,
    memory_mb=16384,
    gpus=[GpuInfo(gpu_id="GPU-0", vram_mb=16384)],
)


def make_scheduler(capacity=None):
    provider = InMemoryResourceProvider(capacity or VRAM_16GB_CAP)
    return InMemoryResourceScheduler(provider), provider


async def request(scheduler, job_id, req=VRAM_8GB, user="user-001", model="m"):
    return await scheduler.request(job_id, user, model, req)


def test_allocation_within_limits():
    scheduler, provider = make_scheduler()
    decision = asyncio.run(request(scheduler, "j1"))
    assert decision.decision == "grant"
    assert decision.allocation.gpu_vram_mb == 8192
    assert len(provider.allocated()) == 1


def test_multiple_jobs_share_gpu_capacity():
    scheduler, provider = make_scheduler()
    a = asyncio.run(request(scheduler, "A"))
    b = asyncio.run(request(scheduler, "B"))
    c = asyncio.run(request(scheduler, "C"))
    assert a.decision == "grant"
    assert b.decision == "grant"
    assert c.decision == "wait"
    assert len(provider.allocated()) == 2
    # never exceeds capacity
    allocated_vram = sum(x.gpu_vram_mb for x in provider.allocated())
    assert allocated_vram <= 16384


def test_allocation_exceeding_capacity_waits():
    scheduler, _ = make_scheduler()
    assert asyncio.run(request(scheduler, "A")).decision == "grant"
    assert asyncio.run(request(scheduler, "B")).decision == "grant"
    assert asyncio.run(request(scheduler, "C")).decision == "wait"


def test_resource_release_after_completion():
    scheduler, provider = make_scheduler()
    asyncio.run(request(scheduler, "A"))
    asyncio.run(request(scheduler, "B"))
    assert len(provider.allocated()) == 2
    asyncio.run(scheduler.release("A"))
    asyncio.run(scheduler.release("B"))
    assert provider.allocated() == []
    assert scheduler.stats()["allocated"]["gpu"]["GPU-0"]["allocated_vram_mb"] == 0


def test_release_after_failure_and_cancellation():
    scheduler, provider = make_scheduler()
    asyncio.run(request(scheduler, "A"))  # granted
    asyncio.run(request(scheduler, "B"))  # granted (A+B = 16 GB)
    assert asyncio.run(request(scheduler, "C")).decision == "wait"
    # "failure": release A -> capacity freed
    asyncio.run(scheduler.release("A"))
    assert len(provider.allocated()) == 1  # only B remains
    # "cancellation while waiting": cancel C (never allocated)
    assert asyncio.run(scheduler.cancel("C")) is True
    assert scheduler.stats()["queued_jobs"] == 0
    asyncio.run(scheduler.release("B"))
    assert provider.allocated() == []


def test_job_waits_then_runs_when_capacity_frees():
    scheduler, provider = make_scheduler()
    asyncio.run(request(scheduler, "A"))  # grant (8)
    assert asyncio.run(request(scheduler, "B")).decision == "grant"  # 16 full
    assert asyncio.run(request(scheduler, "C")).decision == "wait"
    asyncio.run(scheduler.release("A"))
    # FIFO: C is granted once capacity frees
    c = asyncio.run(request(scheduler, "C"))
    assert c.decision == "grant"
    assert len(provider.allocated()) == 2  # B + C


def test_five_user_scheduling_scenario():
    scheduler, provider = make_scheduler()
    users = ["A", "B", "C", "D", "E"]
    decisions = {}
    for user in users:
        decision = asyncio.run(request(scheduler, user, user=f"user-{user}"))
        decisions[user] = decision.decision

    granted = [u for u in users if decisions[u] == "grant"]
    waiting = [u for u in users if decisions[u] == "wait"]
    assert granted == ["A", "B"]
    assert waiting == ["C", "D", "E"]
    # never more than two 8 GB jobs allocated concurrently
    assert len(provider.allocated()) <= 2
    allocated_vram = sum(a.gpu_vram_mb for a in provider.allocated())
    assert allocated_vram <= 16384

    order = []
    for done in ["A", "B"]:
        asyncio.run(scheduler.release(done))
        order.append(f"released-{done}")
        for user in waiting:
            if decisions[user] != "wait":
                continue
            decision = asyncio.run(request(scheduler, user, user=f"user-{user}"))
            if decision.decision == "grant":
                order.append(f"granted-{user}")
                decisions[user] = "grant"

    # FIFO: C granted after A releases, D after B releases; E waits for C
    assert order.index("granted-C") < order.index("granted-D")
    assert decisions["E"] == "wait"

    asyncio.run(scheduler.release("C"))
    assert asyncio.run(request(scheduler, "E")).decision == "grant"

    asyncio.run(scheduler.release("D"))
    asyncio.run(scheduler.release("E"))
    assert provider.allocated() == []


def test_oversized_impossible_job_fails_cleanly():
    scheduler, _ = make_scheduler()
    big = ResourceRequirements(gpu_vram_mb=32768)
    decision = asyncio.run(request(scheduler, "BIG", req=big))
    assert decision.decision == "reject"
    assert "Requested 32768 MB VRAM, system capacity is 16384 MB" in decision.reason


def test_oversized_cpu_and_memory_rejected():
    scheduler, _ = make_scheduler()
    big_cpu = ResourceRequirements(cpu_cores=64)
    assert asyncio.run(request(scheduler, "X", req=big_cpu)).decision == "reject"
    big_mem = ResourceRequirements(memory_mb=1_000_000)
    assert asyncio.run(request(scheduler, "Y", req=big_mem)).decision == "reject"


def test_unknown_gpu_rejected():
    scheduler, _ = make_scheduler()
    decision = asyncio.run(
        request(scheduler, "U", req=ResourceRequirements(gpu_id="GPU-9", gpu_vram_mb=8192))
    )
    assert decision.decision == "reject"
    assert "Unknown GPU 'GPU-9'" in decision.reason


def test_vram_without_gpu_binds_to_first_gpu():
    scheduler, provider = make_scheduler()
    req = ResourceRequirements(gpu_vram_mb=8192)  # no gpu_id
    decision = asyncio.run(request(scheduler, "G", req=req))
    assert decision.decision == "grant"
    assert decision.allocation.gpu_id == "GPU-0"
    assert provider.allocated()[0].gpu_vram_mb == 8192


def test_cancellation_while_waiting_never_allocates():
    scheduler, provider = make_scheduler()
    asyncio.run(request(scheduler, "A"))
    asyncio.run(request(scheduler, "B"))
    assert asyncio.run(request(scheduler, "C")).decision == "wait"
    assert asyncio.run(scheduler.cancel("C")) is True
    asyncio.run(scheduler.release("A"))
    # only a new job (D) can now be granted; cancelled C must never get resources
    decision = asyncio.run(request(scheduler, "D"))
    assert decision.decision == "grant"
    assert {a.job_id for a in provider.allocated()} == {"B", "D"}


def test_no_allocation_leaks_after_all_jobs_finish():
    scheduler, provider = make_scheduler()
    for user in ["A", "B", "C", "D"]:
        decision = asyncio.run(request(scheduler, user))
        if decision.decision == "grant":
            asyncio.run(scheduler.release(user))
    assert provider.allocated() == []
    stats = scheduler.stats()
    assert stats["running_jobs"] == 0
    assert stats["allocated"]["cpu_cores"] == 0
    assert stats["allocated"]["memory_mb"] == 0
    assert stats["allocated"]["gpu"]["GPU-0"]["allocated_vram_mb"] == 0


def test_stats_reporting():
    scheduler, _ = make_scheduler()
    asyncio.run(request(scheduler, "A"))  # grant
    asyncio.run(request(scheduler, "B"))  # grant (16 GB full)
    asyncio.run(request(scheduler, "C"))  # waits
    stats = scheduler.stats()
    assert stats["queued_jobs"] == 1
    assert stats["running_jobs"] == 2
    assert stats["allocated"]["gpu"]["GPU-0"]["allocated_vram_mb"] == 16384
    assert stats["allocated"]["gpu"]["GPU-0"]["capacity_vram_mb"] == 16384


def test_empty_requirements_granted_without_allocation():
    scheduler, provider = make_scheduler()
    decision = asyncio.run(request(scheduler, "N", req=ResourceRequirements()))
    assert decision.decision == "grant"
    assert decision.allocation is None
    assert provider.allocated() == []


def test_model_resource_requirements_loaded_from_configuration():
    registry = ModelRegistry(
        {
            "general": ModelConfig(
                model="m", enabled=True,
                resources=ResourceRequirements(gpu_vram_mb=8000, cpu_cores=2, memory_mb=4096),
            )
        }
    )
    result = ModelRouter(registry).resolve("general", "reason")
    assert result.requirements.gpu_vram_mb == 8000
    assert result.requirements.cpu_cores == 2
    assert result.requirements.memory_mb == 4096
    # routing fields unchanged
    assert result.model == "m"
    assert result.task_type == "general"


def test_local_provider_discovers_capacity_without_nvidia():
    capacity = LocalResourceProvider().capacity()
    assert capacity.cpu_cores > 0
    assert capacity.memory_mb > 0
    assert isinstance(capacity.gpus, list)
    for gpu in capacity.gpus:
        assert gpu.gpu_id.startswith("GPU-")
        assert gpu.vram_mb > 0
