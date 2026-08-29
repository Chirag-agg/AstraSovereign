"""Workspace-scoped local tools: list_files, read_file, write_file.

Tools operate strictly inside the current job's workspace and never touch
arbitrary filesystem paths (see ``resolve_within_workspace``).
"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel

from app.services.workspace import WorkspaceError, resolve_within_workspace

logger = logging.getLogger("app.tools")


class ToolError(Exception):
    """A tool could not be executed safely."""


class ToolResult(BaseModel):
    """Result of a tool execution (never stores raw file contents in logs)."""

    ok: bool = True
    summary: str
    content: Optional[str] = None
    error: Optional[str] = None


class BaseTool(ABC):
    name: str = ""
    description: str = ""
    input_schema: dict = {}

    @abstractmethod
    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        raise NotImplementedError


def _safe_path(workspace: Path, relative_path: str) -> Path:
    try:
        return resolve_within_workspace(workspace, relative_path)
    except WorkspaceError as exc:
        raise ToolError(str(exc)) from exc


class ListFilesTool(BaseTool):
    name = "list_files"
    description = "List files in the current job workspace."
    input_schema = {"type": "object", "properties": {}, "additionalProperties": False}

    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        if not workspace.exists():
            return ToolResult(ok=True, summary="No files found", content="")
        names = sorted(p.name for p in workspace.iterdir() if p.is_file())
        if not names:
            return ToolResult(ok=True, summary="No files found", content="")
        return ToolResult(
            ok=True,
            summary=f"{len(names)} file(s) found",
            content="\n".join(names),
        )


class ReadFileTool(BaseTool):
    name = "read_file"
    description = "Read a text file from the current job workspace."
    input_schema = {
        "type": "object",
        "properties": {"path": {"type": "string"}},
        "required": ["path"],
        "additionalProperties": False,
    }

    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        path = _safe_path(workspace, arguments["path"])
        if not path.is_file():
            raise ToolError(f"File not found in workspace: {path.name}")
        try:
            content = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError) as exc:
            raise ToolError(f"Cannot read file '{path.name}': {exc}")
        return ToolResult(
            ok=True,
            summary=f"Read '{path.name}' ({len(content)} characters)",
            content=content,
        )


class WriteFileTool(BaseTool):
    name = "write_file"
    description = "Write text content to a file in the current job workspace."
    input_schema = {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        },
        "required": ["path", "content"],
        "additionalProperties": False,
    }

    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        path = _safe_path(workspace, arguments["path"])
        content = arguments["content"]
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        except OSError as exc:
            raise ToolError(f"Cannot write file '{path.name}': {exc}")
        return ToolResult(
            ok=True,
            summary=f"Wrote {len(content)} characters to '{path.name}'",
        )
