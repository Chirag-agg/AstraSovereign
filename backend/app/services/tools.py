"""Workspace-scoped local tools: list_files, read_file, write_file, code_execution.

Tools operate strictly inside the current job's workspace and never touch
arbitrary filesystem paths (see ``resolve_within_workspace``). ``code_execution``
runs generated code inside an isolated Docker sandbox and never on the host.
"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel

from app.services.log_context import get_job_context
from app.services.sandbox_runner import SandboxRunner, SandboxRunnerError
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


class CodeExecutionTool(BaseTool):
    """Execute generated code inside an isolated Docker sandbox (network off).

    Supported languages: ``python``. The tool never executes code on the host.
    """

    name = "code_execution"
    description = (
        "Execute generated code inside an isolated Docker sandbox with "
        "networking disabled. Supported languages: python."
    )
    input_schema = {
        "type": "object",
        "properties": {
            "language": {"type": "string"},
            "code": {"type": "string"},
            "stdin": {"type": "string"},
        },
        "required": ["language", "code"],
        "additionalProperties": False,
    }

    def __init__(
        self,
        runner: SandboxRunner,
        max_stdout_chars: int = 4096,
        max_stderr_chars: int = 4096,
    ) -> None:
        self._runner = runner
        self._max_stdout_chars = max_stdout_chars
        self._max_stderr_chars = max_stderr_chars

    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        language = str(arguments["language"]).strip().lower()
        if language != "python":
            raise ToolError(
                f"Unsupported language '{language}'; only 'python' is supported"
            )
        code = arguments["code"]
        if not code.strip():
            raise ToolError("code must not be empty")
        stdin = arguments.get("stdin") or ""

        ctx = get_job_context()
        logger.info(
            "code_execution_started",
            extra={
                "event": "code_execution_started",
                "job_id": ctx.get("job_id"),
                "user_id": ctx.get("user_id"),
                "language": language,
            },
        )

        try:
            result = await self._runner.run(code, language=language, stdin=stdin)
        except SandboxRunnerError as exc:
            logger.error(
                "code_execution_failed",
                extra={
                    "event": "code_execution_failed",
                    "job_id": ctx.get("job_id"),
                    "user_id": ctx.get("user_id"),
                    "language": language,
                    "error": str(exc),
                },
            )
            raise ToolError(f"code_execution failed: {exc}") from exc

        stdout = result.stdout[: self._max_stdout_chars]
        stderr = result.stderr[: self._max_stderr_chars]

        if result.timed_out:
            summary = f"Timed out after {result.duration_ms}ms"
            status = "timeout"
        else:
            summary = f"Exit code {result.exit_code} in {result.duration_ms}ms"
            status = "completed"
        content = (
            f"exit_code={result.exit_code} timed_out={result.timed_out} "
            f"duration_ms={result.duration_ms}\n"
            f"STDOUT:\n{stdout}\n"
            f"STDERR:\n{stderr}"
        )

        if result.timed_out:
            logger.error(
                "code_execution_timeout",
                extra={
                    "event": "code_execution_timeout",
                    "job_id": ctx.get("job_id"),
                    "user_id": ctx.get("user_id"),
                    "language": language,
                    "duration_ms": result.duration_ms,
                    "status": "timeout",
                },
            )
        else:
            logger.info(
                "code_execution_completed",
                extra={
                    "event": "code_execution_completed",
                    "job_id": ctx.get("job_id"),
                    "user_id": ctx.get("user_id"),
                    "language": language,
                    "duration_ms": result.duration_ms,
                    "exit_code": result.exit_code,
                    "status": status,
                },
            )

        return ToolResult(
            ok=result.success,
            summary=summary,
            content=content,
        )
