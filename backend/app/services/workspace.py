"""Per-job workspace isolation.

Each job gets its own workspace under ``<root>/<user_id>/<job_id>/``. Tools may
only ever operate inside the current job's workspace. User/job identifiers are
sanitized so a crafted header value can never escape the workspaces root.
"""

import re
from pathlib import Path
from typing import Union

_SAFE_COMPONENT_RE = re.compile(r"^[A-Za-z0-9._-]+$")


class WorkspaceError(Exception):
    """The workspace path could not be created or resolved safely."""


class WorkspaceManager:
    def __init__(self, root: Union[str, Path]) -> None:
        self._root = Path(root).resolve()

    @property
    def root(self) -> Path:
        return self._root

    @staticmethod
    def safe_component(name: str) -> str:
        """Sanitize a path component (user_id/job_id) for use inside the root."""
        cleaned = "".join(
            ch if ch.isalnum() or ch in "._-" else "_" for ch in (name or "")
        )
        if not cleaned:
            raise WorkspaceError("Empty workspace component")
        return cleaned

    def workspace_path(self, user_id: str, job_id: str) -> Path:
        """Return (without creating) the workspace path for a user/job."""
        return (
            self._root
            / self.safe_component(user_id)
            / self.safe_component(job_id)
        )

    async def create_workspace(self, user_id: str, job_id: str) -> Path:
        """Create and return the isolated workspace directory for a job."""
        job_dir = self.workspace_path(user_id, job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        return job_dir


def resolve_within_workspace(workspace: Path, relative_path: str) -> Path:
    """Resolve a tool-supplied path and reject any escape attempt.

    Rejects absolute paths, ``..`` traversal, and symlink escapes (the target
    is fully resolved and must remain under the workspace).
    """
    if not relative_path or not relative_path.strip():
        raise WorkspaceError("Empty path")
    raw = Path(relative_path)
    if raw.is_absolute():
        raise WorkspaceError("Absolute paths are not allowed")
    workspace_resolved = workspace.resolve()
    target = (workspace / raw).resolve()
    if not target.is_relative_to(workspace_resolved):
        raise WorkspaceError("Path escapes the job workspace")
    return target
