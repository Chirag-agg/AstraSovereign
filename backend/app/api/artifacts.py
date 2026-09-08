"""HTTP API: aggregate artifact listing (Phase 11 UX — frontend Artifacts view).

User-scoped: returns artifact summaries for the current user across their jobs.
Downloads still go through the secure per-job endpoint
(``GET /api/jobs/{job_id}/artifacts/{artifact_id}``) — this endpoint never
serves file bytes.
"""

import logging

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_user_id
from app.schemas.artifact import ArtifactSummary

logger = logging.getLogger("app.api.artifacts")

router = APIRouter(tags=["artifacts"])


@router.get("/api/artifacts")
async def list_artifacts(
    request: Request,
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    """Artifact metadata for the current user (newest first)."""
    artifacts = await request.app.state.artifact_store.list_for_user(user_id)
    artifacts.sort(key=lambda a: (a.created_at, a.artifact_id), reverse=True)
    return [ArtifactSummary.from_artifact(a).model_dump(mode="json") for a in artifacts]
