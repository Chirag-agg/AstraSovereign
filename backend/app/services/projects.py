"""Cowork persistent user projects and scoped file access.

Each project lives at ``<root>/<user_id>/<project_id>/`` with internal metadata
under a hidden ``.cowork/`` directory (never surfaced in file listings). User and
project identifiers are sanitized; every file operation is resolved inside the
project root with the same containment rules as the job workspace
(``resolve_within_workspace``), so crafted paths can never escape the project or
reach another user's files.

Project mutation lock: while an agent job is running against a project, file
mutations are rejected with a 409 so the agent never reads a file a human is
editing (or writes over a stale copy).
"""

import json
import re
import shutil
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Union

from app.services.workspace import WorkspaceManager, resolve_within_workspace

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_META_DIR = ".cowork"


class ProjectNotFoundError(Exception):
    """No project exists for this user/id, or it belongs to another user."""


class ProjectFileError(Exception):
    """A file operation was invalid (path escape, binary, too large, missing)."""


class ProjectLockedError(Exception):
    """The project is locked by a running agent job; file mutations are refused."""


@dataclass(frozen=True)
class ProjectMeta:
    project_id: str
    name: str
    user_id: str
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class ProjectFileEntry:
    name: str
    path: str  # project-relative path with forward slashes
    kind: str  # "dir" | "file"
    size: Optional[int]
    updated: Optional[str]


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(name: str) -> str:
    cleaned = _SLUG_RE.sub("-", (name or "").strip().lower()).strip("-")
    return cleaned[:48] or "project"


class CoworkProjects:
    """Ownership-checked project + file operations (no network)."""

    def __init__(self, root: Union[str, Path], file_max_bytes: int = 1_000_000) -> None:
        self._root = Path(root).resolve()
        self._file_max_bytes = file_max_bytes
        self._wm = WorkspaceManager(self._root)

    @property
    def root(self) -> Path:
        return self._root

    # ------------------------------------------------------------ projects

    def _project_dir(self, user_id: str, project_id: str) -> Path:
        return (
            self._root
            / WorkspaceManager.safe_component(user_id)
            / WorkspaceManager.safe_component(project_id)
        )

    def project_dir(self, user_id: str, project_id: str) -> Path:
        return self._project_dir(user_id, project_id)

    def owns(self, user_id: str, project_id: str) -> bool:
        """True if the project dir exists under this user's root."""
        return self._project_dir(user_id, project_id).is_dir()

    def _meta_path(self, user_id: str, project_id: str) -> Path:
        return self._project_dir(user_id, project_id) / _META_DIR / "meta.json"

    def list_projects(self, user_id: str) -> list[ProjectMeta]:
        user_root = self._root / WorkspaceManager.safe_component(user_id)
        if not user_root.is_dir():
            return []
        metas: list[ProjectMeta] = []
        for child in user_root.iterdir():
            if not child.is_dir() or child.name.startswith("."):
                continue
            meta = self._read_meta(user_id, child.name)
            if meta is not None:
                metas.append(meta)
        metas.sort(key=lambda m: m.updated_at, reverse=True)
        return metas

    def get_project(self, user_id: str, project_id: str) -> ProjectMeta:
        if not self.owns(user_id, project_id):
            raise ProjectNotFoundError(project_id)
        meta = self._read_meta(user_id, project_id)
        if meta is None:
            raise ProjectNotFoundError(project_id)
        return meta

    def create_project(self, user_id: str, name: str) -> ProjectMeta:
        base = slugify(name)
        project_id = f"{base}-{uuid.uuid4().hex[:6]}"
        project_dir = self._project_dir(user_id, project_id)
        (project_dir / _META_DIR).mkdir(parents=True, exist_ok=True)
        now = _utcnow_iso()
        meta = {
            "project_id": project_id,
            "name": (name or "").strip()[:120],
            "user_id": user_id,
            "created_at": now,
            "updated_at": now,
        }
        (project_dir / _META_DIR / "meta.json").write_text(
            json.dumps(meta, indent=2), encoding="utf-8"
        )
        return ProjectMeta(**meta)

    def delete_project(self, user_id: str, project_id: str) -> None:
        project_dir = self._project_dir(user_id, project_id)
        if not project_dir.is_dir():
            raise ProjectNotFoundError(project_id)
        shutil.rmtree(project_dir)

    def ensure_dir(self, user_id: str, project_id: str) -> Path:
        project_dir = self._project_dir(user_id, project_id)
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / _META_DIR).mkdir(parents=True, exist_ok=True)
        if not (project_dir / _META_DIR / "meta.json").exists():
            meta = {
                "project_id": project_id,
                "name": project_id,
                "user_id": user_id,
                "created_at": _utcnow_iso(),
                "updated_at": _utcnow_iso(),
            }
            (project_dir / _META_DIR / "meta.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
        return project_dir

    def _read_meta(self, user_id: str, project_id: str) -> Optional[ProjectMeta]:
        try:
            raw = json.loads(self._meta_path(user_id, project_id).read_text(encoding="utf-8"))
        except (OSError, ValueError, json.JSONDecodeError):
            return None
        return ProjectMeta(
            project_id=str(raw.get("project_id", project_id)),
            name=str(raw.get("name", project_id)),
            user_id=str(raw.get("user_id", user_id)),
            created_at=str(raw.get("created_at", "")),
            updated_at=str(raw.get("updated_at", "")),
        )

    # ---------------------------------------------------------------- files

    @staticmethod
    def _resolve(project_dir: Path, relative_path: str) -> Path:
        return resolve_within_workspace(project_dir, relative_path)

    def list_files(self, user_id: str, project_id: str, max_entries: int = 500) -> list[ProjectFileEntry]:
        project_dir = self._ensure(user_id, project_id)
        entries: list[ProjectFileEntry] = []
        self._walk(project_dir, "", entries, max_entries)
        return entries

    def _ensure(self, user_id: str, project_id: str) -> Path:
        if not self.owns(user_id, project_id):
            raise ProjectNotFoundError(project_id)
        return self._project_dir(user_id, project_id)

    def _walk(self, base: Path, rel: str, entries: list[ProjectFileEntry], max_entries: int) -> None:
        if len(entries) >= max_entries:
            return
        current = base if not rel else base / Path(rel)
        for child in sorted(current.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            if child.name.startswith("."):
                continue
            if len(entries) >= max_entries:
                return
            child_rel = f"{rel}/{child.name}".lstrip("/")
            if child.is_dir():
                entries.append(ProjectFileEntry(name=child.name, path=child_rel, kind="dir", size=None, updated=None))
                self._walk(base, child_rel, entries, max_entries)
            else:
                try:
                    size = child.stat().st_size
                except OSError:
                    size = None
                entries.append(
                    ProjectFileEntry(name=child.name, path=child_rel, kind="file", size=size, updated=_iso(child))
                )

    def read_file(self, user_id: str, project_id: str, relative_path: str) -> str:
        project_dir = self._ensure(user_id, project_id)
        target = self._resolve(project_dir, relative_path)
        if not target.is_file():
            raise ProjectFileError(f"File not found: {relative_path}")
        if target.stat().st_size > self._file_max_bytes:
            raise ProjectFileError("File exceeds the maximum allowed size.")
        data = target.read_bytes()
        if b"\x00" in data:
            raise ProjectFileError("Binary files are not supported.")
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ProjectFileError("Not a UTF-8 text file.") from exc

    def write_file(self, user_id: str, project_id: str, relative_path: str, content: str) -> None:
        project_dir = self._ensure(user_id, project_id)
        target = self._resolve(project_dir, relative_path)
        if target.is_dir():
            raise ProjectFileError("Path is a directory.")
        payload = content.encode("utf-8")
        if len(payload) > self._file_max_bytes:
            raise ProjectFileError("File exceeds the maximum allowed size.")
        if b"\x00" in payload:
            raise ProjectFileError("Binary content is not supported.")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)

    def delete_file(self, user_id: str, project_id: str, relative_path: str) -> None:
        project_dir = self._ensure(user_id, project_id)
        target = self._resolve(project_dir, relative_path)
        if not target.exists():
            raise ProjectFileError(f"File not found: {relative_path}")
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()


class ProjectLocks:
    """In-process registry of projects currently locked by a running agent job."""

    def __init__(self) -> None:
        self._locked: set[str] = set()

    def key(self, user_id: str, project_id: str) -> str:
        return f"{WorkspaceManager.safe_component(user_id)}:{WorkspaceManager.safe_component(project_id)}"

    def acquire(self, user_id: str, project_id: str) -> bool:
        key = self.key(user_id, project_id)
        if key in self._locked:
            return False
        self._locked.add(key)
        return True

    def release(self, user_id: str, project_id: str) -> None:
        self._locked.discard(self.key(user_id, project_id))

    def is_locked(self, user_id: str, project_id: str) -> bool:
        return self.key(user_id, project_id) in self._locked


def _iso(path: Path) -> Optional[str]:
    try:
        stat = path.stat()
    except OSError:
        return None
    return datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
