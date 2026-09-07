"""HTTP API: Cowork projects, project files, and project-aware chat."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.deps import get_user_id
from app.schemas.job import JobSubmitResponse
from app.services.projects import (
    CoworkProjects,
    ProjectFileError,
    ProjectLocks,
    ProjectLockedError,
    ProjectNotFoundError,
)
from app.services.workspace import WorkspaceError

logger = logging.getLogger("app.api.projects")

router = APIRouter(tags=["cowork"])


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class CoworkChatRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1)


class FileWrite(BaseModel):
    content: str = Field(..., max_length=4_000_000)


def _get_projects(request: Request) -> CoworkProjects:
    return request.app.state.projects


def _get_locks(request: Request) -> ProjectLocks:
    return request.app.state.project_locks


def _file_http_error(exc: ProjectFileError) -> HTTPException:
    msg = str(exc)
    if "not found" in msg.lower():
        return HTTPException(status_code=404, detail=msg)
    if "binary" in msg.lower() or "UTF-8" in msg:
        return HTTPException(status_code=415, detail=msg)
    if "maximum" in msg.lower():
        return HTTPException(status_code=413, detail=msg)
    return HTTPException(status_code=400, detail=msg)


def _containment_error(exc: WorkspaceError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@router.get("/api/projects")
async def list_projects(
    request: Request,
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    projects = _get_projects(request)
    return [meta.__dict__ for meta in projects.list_projects(user_id)]


@router.post("/api/projects", status_code=201)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    projects = _get_projects(request)
    meta = projects.create_project(user_id, payload.name)
    return meta.__dict__


@router.get("/api/projects/{project_id}")
async def get_project(
    project_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    projects = _get_projects(request)
    try:
        return projects.get_project(user_id, project_id).__dict__
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/api/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> None:
    projects = _get_projects(request)
    try:
        projects.delete_project(user_id, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/projects/{project_id}/files")
async def list_project_files(
    project_id: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    projects = _get_projects(request)
    try:
        entries = projects.list_files(user_id, project_id)
        return {"project_id": project_id, "entries": [e.__dict__ for e in entries]}
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/projects/{project_id}/file")
async def read_project_file(
    project_id: str,
    path: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    projects = _get_projects(request)
    try:
        return {"path": path, "content": projects.read_file(user_id, project_id, path)}
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectFileError as exc:
        raise _file_http_error(exc) from exc
    except WorkspaceError as exc:
        raise _containment_error(exc) from exc


@router.put("/api/projects/{project_id}/file", status_code=200)
async def write_project_file(
    project_id: str,
    path: str,
    payload: FileWrite,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    projects = _get_projects(request)
    locks = _get_locks(request)
    try:
        if locks.is_locked(user_id, project_id):
            raise ProjectLockedError(
                "Project is locked while an agent task is running; wait for it to finish before editing files."
            )
        projects.write_file(user_id, project_id, path, payload.content)
        return {"path": path, "ok": True}
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectLockedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ProjectFileError as exc:
        raise _file_http_error(exc) from exc
    except WorkspaceError as exc:
        raise _containment_error(exc) from exc


@router.delete("/api/projects/{project_id}/file", status_code=204)
async def delete_project_file(
    project_id: str,
    path: str,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> None:
    projects = _get_projects(request)
    locks = _get_locks(request)
    try:
        if locks.is_locked(user_id, project_id):
            raise ProjectLockedError(
                "Project is locked while an agent task is running; wait for it to finish before editing files."
            )
        projects.delete_file(user_id, project_id, path)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectLockedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ProjectFileError as exc:
        raise _file_http_error(exc) from exc
    except WorkspaceError as exc:
        raise _containment_error(exc) from exc


@router.post("/api/cowork/chat", response_model=JobSubmitResponse, status_code=202)
async def cowork_chat(
    payload: CoworkChatRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> JobSubmitResponse:
    """Submit a message to a Cowork project as a normal job bound to the project.

    The job flows through the standard queue/router/pipeline/agent machinery but
    executes against the project folder, so files persist across turns.
    """
    projects = _get_projects(request)
    try:
        projects.get_project(user_id, payload.project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    manager = request.app.state.job_manager
    queue = request.app.state.job_queue

    job = await manager.create_job(
        user_id=user_id,
        message=payload.message,
        project_id=payload.project_id,
    )
    await queue.enqueue(job.job_id)
    context_manager = request.app.state.context_manager
    if context_manager is not None:
        context_manager.add_user_message(user_id, payload.project_id, payload.message)
    logger.info(
        "cowork_chat_submitted",
        extra={
            "event": "cowork_chat",
            "user_id": user_id,
            "project_id": payload.project_id,
            "job_id": job.job_id,
        },
    )
    return JobSubmitResponse(job_id=job.job_id, status=job.status)
