"""Workspace-scoped local tools: list_files, read_file, write_file, code_execution,
document_search.

Tools operate strictly inside the current job's workspace and never touch
arbitrary filesystem paths (see ``resolve_within_workspace``). ``code_execution``
runs generated code inside an isolated Docker sandbox and never on the host.
``document_search`` queries the user's local knowledge base and is the only
gateway the agent has to it.
"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel

from app.services.knowledge_base import KnowledgeBase
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


class DocumentSearchTool(BaseTool):
    """Search the caller's local knowledge base (user scoped via log context).

    The agent reaches the knowledge base only through this tool — it never
    touches the vector store directly.
    """

    name = "document_search"
    description = (
        "Search the user's local knowledge base of ingested documents for relevant "
        "passages. Returns source metadata (filename, page) and matched text."
    )
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "top_k": {"type": "integer"},
        },
        "required": ["query"],
        "additionalProperties": False,
    }

    def __init__(
        self,
        knowledge_base: KnowledgeBase,
        default_top_k: int = 5,
        max_top_k: int = 10,
        max_chunk_chars: int = 1000,
    ) -> None:
        self._kb = knowledge_base
        self._default_top_k = default_top_k
        self._max_top_k = max_top_k
        self._max_chunk_chars = max_chunk_chars

    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        ctx = get_job_context()
        user_id = ctx.get("user_id")
        if not user_id:
            raise ToolError("document_search requires a user context")

        query = str(arguments["query"]).strip()
        if not query:
            raise ToolError("query must not be empty")
        top_k = int(arguments.get("top_k", self._default_top_k))
        top_k = max(1, min(top_k, self._max_top_k))

        results = await self._kb.search(user_id, query, top_k)

        if not results:
            return ToolResult(
                ok=True,
                summary="No relevant local documents found",
                content="No relevant local documents found",
            )

        filenames = sorted({r.filename for r in results})
        lines = [f"Found {len(results)} relevant chunk(s)."]
        lines.append(f"Sources: {', '.join(filenames)}")
        for index, result in enumerate(results, start=1):
            text = result.text
            if len(text) > self._max_chunk_chars:
                text = text[: self._max_chunk_chars] + "...[truncated]"
            location = f" (page {result.page})" if result.page else ""
            lines.append(
                f"\n[{index}] {result.filename}{location} "
                f"| score={result.score} | doc={result.document_id}"
            )
            lines.append(text)

        return ToolResult(
            ok=True,
            summary=f"{len(results)} relevant chunk(s) from {len(filenames)} document(s)",
            content="\n".join(lines),
        )
