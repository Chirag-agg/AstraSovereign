"""Development admin/operations API (Phase 11 organizational UX).

Authorization note: this router is gated by a development ``X-Role: admin``
header. This is a DEVELOPMENT-ONLY role switch for the demo — it is NOT real
authentication/RBAC. A production system must replace this gate with verified
identity + authorization and must NOT trust a browser-supplied role.

Admin boundaries stay separate from ordinary user APIs: admin endpoints expose
aggregate operational metadata (jobs/models/resources/audit) and deliberately do
NOT return users' prompts, messages, responses, or document contents.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from app.schemas.artifact import ArtifactSummary
from app.services.sovereignty import build_sovereignty_status

logger = logging.getLogger("app.api.admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])

DEV_USERS = ("user-001", "user-002", "user-003", "user-004", "user-005")


async def require_admin(x_role: Optional[str] = Header(default=None, alias="X-Role")) -> str:
    """Development-only admin gate. NOT production authorization."""
    if x_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "admin_role_required", "message": "Development admin role required."},
        )
    return x_role


def _job_meta(job) -> dict:
    def _iso(value):
        return value.isoformat() if value else None

    duration_ms = None
    if job.started_at and job.completed_at:
        duration_ms = int((job.completed_at - job.started_at).total_seconds() * 1000)
    return {
        "job_id": job.job_id,
        "user_id": job.user_id,
        "task_type": job.task_type,
        "status": job.status.value,
        "priority": job.priority,
        "model": job.model,
        "created_at": _iso(job.created_at),
        "started_at": _iso(job.started_at),
        "completed_at": _iso(job.completed_at),
        "duration_ms": duration_ms,
        "resource_status": job.resource_status,
        "agent_stage": job.agent_stage,
        "iteration_count": job.iteration_count,
        "tool_call_count": job.tool_call_count,
        "error": job.error,
    }


async def _ollama_models(request: Request):
    try:
        models = await request.app.state.ollama_service.list_models()
        return set(models), True
    except Exception:
        return set(), False


def _component_state(ok: Optional[bool], degraded: bool = False) -> str:
    if ok is None:
        return "UNKNOWN"
    return "HEALTHY" if ok and not degraded else ("DEGRADED" if ok else "UNAVAILABLE")


@router.get("/overview")
async def overview(request: Request, _: str = Depends(require_admin)) -> dict:
    manager = request.app.state.job_manager
    store = request.app.state.audit_store
    jobs = await manager.list_all(limit=500)
    counts = {"queued": 0, "running": 0, "completed": 0, "failed": 0, "cancelled": 0}
    for job in jobs:
        counts[job.status.value] = counts.get(job.status.value, 0) + 1
    available, reachable = await _ollama_models(request)
    registry = request.app.state.model_registry
    models_available = sum(
        1 for cfg in registry.availability(available).values() if cfg["available"]
    )
    total_jobs = len(jobs)
    failed_today = sum(
        1
        for job in jobs
        if job.status.value == "failed"
        and job.completed_at
        and (datetime.now(timezone.utc) - job.completed_at).days == 0
    )
    return {
        "jobs": {"total": total_jobs, **counts},
        "models_available": models_available,
        "models_configured": len(registry.task_types()),
        "ollama_reachable": reachable,
        "scheduler": request.app.state.scheduler.stats(),
        "worker": {"state": request.app.state.worker.state},
        "failed_today": failed_today,
        "audit_events": store.stats()["events"],
        "sovereignty": build_sovereignty_status(
            store,
            request.app.state.network_guard,
            ollama_url=request.app.state.settings.ollama_base_url,
        ),
    }


@router.get("/jobs")
async def admin_jobs(
    request: Request,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
) -> list[dict]:
    from app.schemas.job import JobStatus

    jobs = await request.app.state.job_manager.list_all(
        status=JobStatus(status_filter) if status_filter else None,
        limit=limit,
        offset=offset,
    )
    return [_job_meta(job) for job in jobs]


@router.get("/jobs/{job_id}")
async def admin_job_detail(
    job_id: str,
    request: Request,
    _: str = Depends(require_admin),
) -> dict:
    job = await request.app.state.job_manager.get_job_for_worker(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "job_not_found", "message": "Job not found."},
        )
    artifacts = await request.app.state.artifact_store.list_for_job(job_id)
    return {
        **_job_meta(job),
        "execution_trace": job.execution_trace,
        "artifacts": [
            ArtifactSummary.from_artifact(a).model_dump(mode="json") for a in artifacts
        ],
    }


@router.get("/users")
async def admin_users(request: Request, _: str = Depends(require_admin)) -> list[dict]:
    manager = request.app.state.job_manager
    kb = request.app.state.knowledge_base
    artifact_store = request.app.state.artifact_store
    all_jobs = await manager.list_all(limit=500)
    by_user: dict[str, list] = {}
    for job in all_jobs:
        by_user.setdefault(job.user_id, []).append(job)
    user_ids = sorted(set(DEV_USERS) | set(by_user.keys()))
    rows = []
    for user_id in user_ids:
        jobs = by_user.get(user_id, [])
        active = sum(1 for j in jobs if j.status.value in ("queued", "running"))
        docs = await kb.list_documents(user_id)
        artifacts = await artifact_store.list_for_user(user_id)
        recent = max((j.completed_at or j.created_at for j in jobs), default=None)
        rows.append(
            {
                "user_id": user_id,
                "jobs": len(jobs),
                "active_jobs": active,
                "failed_jobs": sum(1 for j in jobs if j.status.value == "failed"),
                "documents": len(docs),
                "artifacts": len(artifacts),
                "recent_activity": recent.isoformat() if recent else None,
            }
        )
    return rows


@router.get("/models")
async def admin_models(request: Request, _: str = Depends(require_admin)) -> list[dict]:
    registry = request.app.state.model_registry
    available, _reachable = await _ollama_models(request)
    availability = registry.availability(available)
    rows = []
    for task_type in registry.task_types():
        cfg = registry.get(task_type)
        info = availability[task_type]
        rows.append(
            {
                "task_type": task_type,
                "provider": cfg.provider,
                "model": cfg.model,
                "enabled": cfg.enabled,
                "available": info["available"],
                "capabilities": cfg.capabilities,
                "resources": cfg.resources.model_dump(),
            }
        )
    return rows


@router.get("/resources")
async def admin_resources(request: Request, _: str = Depends(require_admin)) -> dict:
    scheduler = request.app.state.scheduler
    provider = scheduler.provider()
    capacity = provider.capacity()
    allocated = provider.allocated()
    waiters = scheduler.stats().get("queued_jobs", 0)
    # ``allocated`` is the scheduler's own belief about what's reserved (a
    # label); ``ollama_resident`` is what Ollama's own /api/ps reports as
    # actually loaded. The delta between them is the honest signal — shown
    # side by side rather than trusting either alone.
    ollama_resident: list[dict] = []
    ollama_service = getattr(request.app.state, "ollama_service", None)
    if ollama_service is not None:
        try:
            ollama_resident = await ollama_service.list_running_models()
        except Exception:
            ollama_resident = []
    return {
        "capacity": capacity.model_dump(),
        "allocated": [a.model_dump(mode="json") for a in allocated],
        "ollama_resident": ollama_resident,
        "waiting_jobs": waiters,
        "running_jobs": scheduler.stats().get("running_jobs", 0),
        "allocated_gpu": scheduler.stats()["allocated"]["gpu"],
    }


@router.get("/knowledge")
async def admin_knowledge(request: Request, _: str = Depends(require_admin)) -> dict:
    kb = request.app.state.knowledge_base
    return {
        **kb.stats(),
        "embedding": kb.describe_embedding(),
        "per_user": {
            user_id: len(await kb.list_documents(user_id)) for user_id in DEV_USERS
        },
    }


@router.get("/audit")
async def admin_audit(
    request: Request,
    user_id: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    _: str = Depends(require_admin),
) -> list[dict]:
    events = request.app.state.audit_store.list(user_id=user_id, job_id=job_id, limit=1000)
    if event_type:
        events = [e for e in events if e.event_type == event_type.upper()]
    return [
        {
            "event_id": e.event_id,
            "timestamp": e.timestamp.isoformat(),
            "event_type": e.event_type,
            "component": e.component,
            "status": e.status,
            "job_id": e.job_id,
            "user_id": e.user_id,
            "metadata": e.metadata,
        }
        for e in events[:limit]
    ]


@router.get("/sovereignty")
async def admin_sovereignty(request: Request, _: str = Depends(require_admin)) -> dict:
    settings = request.app.state.settings
    return build_sovereignty_status(
        request.app.state.audit_store,
        request.app.state.network_guard,
        ollama_url=settings.ollama_base_url,
    )


@router.get("/system")
async def admin_system(request: Request, _: str = Depends(require_admin)) -> dict:
    available, reachable = await _ollama_models(request)
    registry = request.app.state.model_registry
    availability = registry.availability(available)
    any_model_available = any(v["available"] for v in availability.values())
    scheduler = request.app.state.scheduler
    worker = request.app.state.worker
    kb = request.app.state.knowledge_base
    multimodal = request.app.state.multimodal_service
    audit = request.app.state.audit_store

    def _agg_model_state() -> str:
        if not reachable:
            return "UNAVAILABLE"
        return "HEALTHY" if any_model_available else "DEGRADED"

    return {
        "ollama": _component_state(reachable),
        "models": _agg_model_state(),
        "worker": _component_state(worker.state in ("idle", "running")),
        "queue": _component_state(True),
        "scheduler": _component_state(scheduler.stats().get("queued_jobs", 0) >= 0),
        "knowledge_base": _component_state(kb.stats()["documents"] >= 0),
        "ocr": _component_state(multimodal.describe_status(available)["ocr"]["enabled"]),
        "vision": _component_state(
            multimodal.describe_status(available)["vision"]["enabled"],
            degraded=not multimodal.describe_status(available)["vision"]["available"],
        ),
        "document_generation": "HEALTHY",
        "audit_store": "HEALTHY" if audit.stats()["events"] >= 0 else "UNAVAILABLE",
        "sandbox_network": "DISABLED",
    }
