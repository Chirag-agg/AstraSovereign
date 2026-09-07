"""Workspace-scoped local tools: list_files, read_file, write_file, code_execution,
document_search, document_vision, document_generation.

Tools operate strictly inside the current job's workspace and never touch
arbitrary filesystem paths (see ``resolve_within_workspace``). ``code_execution``
runs generated code inside an isolated Docker sandbox and never on the host.
``document_search`` queries the user's local knowledge base and is the only
gateway the agent has to it. ``document_vision`` is the only gateway the agent
has to local OCR + vision analysis of the user's scanned/image documents.
``document_generation`` is the only way the agent creates deliverable files
(e.g. Word .docx); artifacts are written only inside the job workspace and are
registered with the ArtifactStore.
"""

import logging
import re
import time
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.artifact import Artifact, ArtifactStatus
from app.schemas.document_content import DocumentContent, DocumentSection
from app.schemas.resources import ResourceRequirements
from app.services.artifact_store import ArtifactStore
from app.services.document_generator import (
    DocumentGenerationError,
    DocumentGenerator,
)
from app.services.knowledge_base import KnowledgeBase
from app.services.log_context import get_job_context
from app.services.multimodal import MultimodalError, MultimodalService
from app.services.resource_scheduler import ResourceScheduler
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
            if not result.success:
                detail = (result.stderr or "").strip()
                if not detail:
                    detail = (result.stdout or "").strip()
                if detail:
                    summary = f"{summary}\n{detail[:300]}"
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


class DocumentVisionTool(BaseTool):
    """Analyze pages of the user's ingested documents using local OCR + vision.

    The only gateway the agent has to multimodal analysis. The agent never
    touches the vision model, OCR internals, or raw filesystem paths directly —
    everything flows through this tool with source metadata attached.
    """

    name = "document_vision"
    description = (
        "Analyze pages of the user's ingested documents (scanned PDFs or images) "
        "using local OCR and a local vision model. Returns structured observations "
        "about the requested pages with source metadata. Use when the question "
        "concerns scanned, handwritten, or image content."
    )
    input_schema = {
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "pages": {"type": "array", "items": {"type": "integer"}},
            "question": {"type": "string"},
        },
        "required": ["document_id", "question"],
        "additionalProperties": False,
    }

    def __init__(self, multimodal: MultimodalService) -> None:
        self._multimodal = multimodal

    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        ctx = get_job_context()
        user_id = ctx.get("user_id")
        if not user_id:
            raise ToolError("document_vision requires a user context")

        document_id = arguments["document_id"]
        question = str(arguments["question"]).strip()
        if not question:
            raise ToolError("question must not be empty")
        pages_arg = arguments.get("pages")
        pages = None
        if pages_arg is not None:
            pages = [int(p) for p in pages_arg]

        try:
            analysis = await self._multimodal.analyze(user_id, document_id, pages, question)
        except MultimodalError as exc:
            raise ToolError(str(exc)) from exc

        content = _format_vision_analysis(analysis)
        summary = f"Analyzed {len(analysis.pages)} page(s) of '{analysis.filename}'"
        return ToolResult(ok=True, summary=summary, content=content)


def _format_vision_analysis(analysis) -> str:
    lines = [
        f"Vision analysis of '{analysis.filename}' (doc={analysis.document_id}), "
        f"{len(analysis.pages)} page(s)"
    ]
    for page in analysis.pages:
        lines.append(f"\n[PAGE {page.page}]")
        if page.ocr_text.strip():
            lines.append(f"  [OCR] {page.ocr_text}")
        else:
            lines.append("  [OCR] (no text detected; image analyzed directly)")
        if page.observations:
            lines.append(f"  [VISION] ({page.vision_model or 'vision model'}) observations:")
            for observation in page.observations:
                lines.append(f"    - {observation}")
        else:
            lines.append("  [VISION] no observations returned")
    return "\n".join(lines)


_FILENAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._ -]*$")
_SECTION_KEYS = {"heading", "content", "paragraphs", "bullets", "numbered", "table", "sources"}
_MAX_DOCUMENT_CHARS = 200_000


def _validate_artifact_filename(filename: Any, doc_type: str) -> str:
    if not isinstance(filename, str) or not filename.strip():
        raise ToolError("filename must be a non-empty string")
    if filename != Path(filename).name:
        raise ToolError(f"invalid filename '{filename}': path separators are not allowed")
    if not _FILENAME_RE.match(filename):
        raise ToolError(f"invalid filename '{filename}'")
    suffix = Path(filename).suffix.lower()
    if doc_type == "word" and suffix != ".docx":
        raise ToolError("word artifacts must use the '.docx' extension")
    return filename


def _validate_document_section(raw: Any) -> DocumentSection:
    if not isinstance(raw, dict):
        raise ToolError("each section must be an object")
    unknown = set(raw) - _SECTION_KEYS
    if unknown:
        raise ToolError(f"unknown section field(s): {', '.join(sorted(unknown))}")

    heading = raw.get("heading", "")
    if not isinstance(heading, str):
        raise ToolError("section 'heading' must be a string")

    if "content" in raw:
        content = raw["content"]
        if not isinstance(content, str):
            raise ToolError("section 'content' must be a string")
        paragraphs = [content] if content.strip() else []
    else:
        paragraphs = raw.get("paragraphs", [])
        if not isinstance(paragraphs, list) or not all(
            isinstance(item, str) for item in paragraphs
        ):
            raise ToolError("section 'paragraphs' must be an array of strings")

    bullets = raw.get("bullets", [])
    if not isinstance(bullets, list) or not all(isinstance(item, str) for item in bullets):
        raise ToolError("section 'bullets' must be an array of strings")

    sources = raw.get("sources")
    if sources is not None and (
        not isinstance(sources, list) or not all(isinstance(item, str) for item in sources)
    ):
        raise ToolError("section 'sources' must be an array of strings")

    numbered = raw.get("numbered", [])
    if not isinstance(numbered, list) or not all(isinstance(item, str) for item in numbered):
        raise ToolError("section 'numbered' must be an array of strings")

    table = raw.get("table", [])
    if not isinstance(table, list) or not all(
        isinstance(row, list) and all(isinstance(cell, str) for cell in row)
        for row in table
    ):
        raise ToolError("section 'table' must be an array of arrays of strings")

    if not (heading or paragraphs or bullets or numbered or table):
        raise ToolError(
            "each section needs at least one of heading/content/paragraphs/bullets/numbered/table"
        )
    return DocumentSection(
        heading=heading,
        paragraphs=paragraphs,
        bullets=bullets,
        numbered=numbered,
        table=table,
    )


class DocumentGenerationTool(BaseTool):
    """Generate deliverable documents (Word .docx) from structured content.

    The only gateway the agent has to document generation. Artifacts are written
    only inside the job workspace's ``artifacts/`` directory and registered with
    the ArtifactStore so they can be listed and downloaded securely. Content is
    validated before generation; unsupported types, unsafe filenames, malformed
    sections, and oversized content are rejected.
    """

    name = "document_generation"
    description = (
        "Generate a deliverable document from structured content. Currently "
        "supports Word (.docx). Arguments: type ('word'), filename, title, "
        "sections (each with heading/content/paragraphs/bullets/numbered/table), "
        "and optional sources. Returns artifact metadata."
    )
    input_schema = {
        "type": "object",
        "properties": {
            "type": {"type": "string"},
            "filename": {"type": "string"},
            "title": {"type": "string"},
            "document_type": {"type": "string"},
            "sections": {"type": "array", "items": {"type": "object"}},
            "sources": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["type", "filename", "title", "sections"],
        "additionalProperties": False,
    }

    def __init__(
        self,
        generator: DocumentGenerator,
        artifact_store: ArtifactStore,
        scheduler: ResourceScheduler,
        requirements: Optional[ResourceRequirements] = None,
        wait_rounds: int = 5,
    ) -> None:
        self._generator = generator
        self._store = artifact_store
        self._scheduler = scheduler
        self._requirements = requirements or ResourceRequirements(
            cpu_cores=1.0, memory_mb=512
        )
        self._wait_rounds = max(wait_rounds, 1)

    async def execute(self, workspace: Path, arguments: dict[str, Any]) -> ToolResult:
        ctx = get_job_context()
        user_id = ctx.get("user_id")
        job_id = ctx.get("job_id")
        if not user_id:
            raise ToolError("document_generation requires a user context")
        if not job_id:
            raise ToolError("document_generation requires a job context")

        doc_type = str(arguments["type"]).strip().lower()
        if doc_type not in self._generator.supported_types:
            raise ToolError(
                f"unsupported document type '{doc_type}'; "
                f"supported: {', '.join(self._generator.supported_types)}"
            )

        filename = _validate_artifact_filename(arguments["filename"], doc_type)
        title = str(arguments["title"]).strip()
        if not title:
            raise ToolError("title must not be empty")

        document_label = str(arguments.get("document_type") or "document").strip()
        sections = [
            _validate_document_section(raw) for raw in arguments["sections"]
        ]
        sources_raw = arguments.get("sources") or []
        if not isinstance(sources_raw, list) or not all(
            isinstance(source, str) and source.strip() for source in sources_raw
        ):
            raise ToolError("sources must be an array of non-empty strings")

        content = DocumentContent(
            document_type=document_label,
            title=title,
            sections=sections,
            sources=[source.strip() for source in sources_raw],
        )
        if content.char_count() > _MAX_DOCUMENT_CHARS:
            raise ToolError(
                f"document content exceeds the maximum of {_MAX_DOCUMENT_CHARS} characters"
            )

        artifacts_dir = self._resolve_artifacts_dir(workspace)
        target = artifacts_dir / filename
        artifact_id = f"art-{uuid.uuid4().hex[:12]}"
        artifact = await self._store.create(
            Artifact(
                artifact_id=artifact_id,
                job_id=job_id,
                user_id=user_id,
                filename=filename,
                type=doc_type,
                path=str(target),
                status=ArtifactStatus.CREATING,
            )
        )

        start = time.monotonic()
        logger.info(
            "document_generation_started",
            extra={
                "event": "document_generation_started",
                "job_id": job_id,
                "user_id": user_id,
                "artifact_id": artifact_id,
                "document_type": doc_type,
                "file_name": filename,
            },
        )
        logger.info(
            "artifact_created",
            extra={
                "event": "artifact_created",
                "job_id": job_id,
                "user_id": user_id,
                "artifact_id": artifact_id,
                "document_type": doc_type,
                "file_name": filename,
                "status": ArtifactStatus.CREATING,
            },
        )

        try:
            generated = await self._generate(job_id, user_id, content, artifacts_dir, filename)
        except DocumentGenerationError as exc:
            await self._store.update(
                artifact_id, status=ArtifactStatus.FAILED, size_bytes=0
            )
            _cleanup_partial(target)
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.error(
                "document_generation_failed",
                extra={
                    "event": "document_generation_failed",
                    "job_id": job_id,
                    "user_id": user_id,
                    "artifact_id": artifact_id,
                    "document_type": doc_type,
                    "file_name": filename,
                    "duration_ms": duration_ms,
                    "status": ArtifactStatus.FAILED,
                    "error": str(exc),
                },
            )
            raise ToolError(f"document_generation failed: {exc}") from exc

        await self._store.update(
            artifact_id,
            status=ArtifactStatus.COMPLETED,
            size_bytes=generated.size_bytes,
            path=str(generated.path),
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "document_generation_completed",
            extra={
                "event": "document_generation_completed",
                "job_id": job_id,
                "user_id": user_id,
                "artifact_id": artifact_id,
                "document_type": doc_type,
                "file_name": filename,
                "size_bytes": generated.size_bytes,
                "duration_ms": duration_ms,
                "status": ArtifactStatus.COMPLETED,
            },
        )

        content_lines = [
            f"Generated artifact '{filename}' for job {job_id}.",
            f"Artifact ID: {artifact_id}",
            f"Type: {doc_type}",
            f"Filename: {filename}",
            f"Size: {generated.size_bytes} bytes",
            f"Status: {ArtifactStatus.COMPLETED}",
            "The file is available in the job workspace artifacts directory.",
        ]
        return ToolResult(
            ok=True,
            summary=f"Generated {doc_type} artifact '{filename}' ({generated.size_bytes} bytes)",
            content="\n".join(content_lines),
        )

    @staticmethod
    def _resolve_artifacts_dir(workspace: Path) -> Path:
        try:
            artifacts_dir = resolve_within_workspace(workspace, "artifacts")
        except WorkspaceError as exc:
            raise ToolError(str(exc)) from exc
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        return artifacts_dir

    async def _generate(self, job_id, user_id, content, output_dir, filename):
        if self._requirements.is_empty:
            return await self._generator.generate(content, output_dir, filename)
        sub_key = f"{job_id}:docgen"
        for _ in range(self._wait_rounds + 1):
            decision = await self._scheduler.request(
                sub_key, user_id, "document_generation", self._requirements
            )
            if decision.decision == "grant":
                try:
                    return await self._generator.generate(content, output_dir, filename)
                finally:
                    await self._scheduler.release(sub_key)
            if decision.decision == "reject":
                await self._scheduler.cancel(sub_key)
                raise DocumentGenerationError(
                    f"document generation resources rejected: {decision.reason}"
                )
            await self._scheduler.wait_until_available(timeout=1.0)
        await self._scheduler.cancel(sub_key)
        raise DocumentGenerationError(
            "document generation resources not available within the wait limit"
        )


def _cleanup_partial(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except OSError:
        pass
