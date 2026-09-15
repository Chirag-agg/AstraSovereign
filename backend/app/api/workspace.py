"""HTTP API: current user's workspace root (AI-assistant file explorer)."""

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_user_id
from app.services.workspace import WorkspaceManager

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.get("/files")
async def list_user_workspace_files(
    request: Request,
    user_id: str = Depends(get_user_id),
) -> dict:
    """List the current user's workspace root (their job workspaces and files)."""
    workspaces = request.app.state.workspace_manager
    user_root = workspaces.root / WorkspaceManager.safe_component(user_id)
    entries: list[dict] = []
    if user_root.is_dir():
        for path in sorted(user_root.rglob("*")):
            if len(entries) >= 500:
                break
            if path.is_symlink():
                continue
            rel = path.relative_to(user_root).as_posix()
            if path.is_dir():
                entries.append({"name": path.name, "path": rel, "kind": "dir", "size": None})
            elif path.is_file():
                try:
                    size = path.stat().st_size
                except OSError:
                    size = None
                entries.append({"name": path.name, "path": rel, "kind": "file", "size": size})
    return {"user_id": user_id, "files": entries}
