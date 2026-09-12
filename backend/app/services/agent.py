"""Controlled local agent loop with workspace-scoped tools.

The agent plans, decides, calls tools, observes results, and completes — all
against the local model via ``OllamaService``. Termination is deterministic
(max iterations / max tool calls), cancellation is observed between iterations
and before tool execution, and every step is recorded in a serializable
execution trace stored on the job.
"""

import json
import logging
import re
import time
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.job import Job, JobStatus
from app.services.job_manager import JobManager
from app.services.log_context import set_job_context
from app.services.ollama_service import OllamaService, OllamaServiceError
from app.services.tool_registry import ToolRegistry
from app.services.tools import ToolError, ToolResult

logger = logging.getLogger("app.agent")

# Marker used in the model prompt; tests use it to extract the user task.
TASK_MARKER = "TASK:"

# Cap on file content passed back into the model prompt (per observation).
MAX_OBSERVATION_CHARS = 4000


class AgentStatus:
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentResult(BaseModel):
    """Outcome of one agent run, consumed by the Worker."""

    status: str
    response: Optional[str] = None
    error: Optional[str] = None
    iterations: int = 0
    tool_calls: int = 0
    # How many turns fell back to the hand-rolled JSON envelope instead of native
    # tool calling. Expiry signal: if this stays 0 across the demo models, delete
    # the legacy parser before freeze.
    legacy_envelope_used: int = 0


class AgentError(Exception):
    """An internal agent error (malformed model output, etc.)."""


class Agent:
    def __init__(
        self,
        manager: JobManager,
        tool_registry: ToolRegistry,
        model_client: OllamaService,
        max_iterations: int = 10,
        max_tool_calls: int = 20,
    ) -> None:
        self._manager = manager
        self._tools = tool_registry
        self._model = model_client
        self._max_iterations = max_iterations
        self._max_tool_calls = max_tool_calls

    # ------------------------------------------------------------------ run

    async def run(
        self,
        job: Job,
        model: str,
        workspace: Path,
        *,
        trace: Optional[list[dict]] = None,
        history: Optional[list[str]] = None,
        task_text: Optional[str] = None,
        max_iterations: Optional[int] = None,
        max_tool_calls: Optional[int] = None,
        append_start: bool = True,
        enforce_contracts: bool = True,
    ) -> AgentResult:
        job_id = job.job_id
        user_id = job.user_id
        trace = trace if trace is not None else []
        history = history if history is not None else []
        task_text = job.message if task_text is None else task_text
        iterations = 0
        tool_calls = 0
        legacy_envelope_used = 0
        stage = "planning"
        max_iter = max_iterations if max_iterations is not None else self._max_iterations
        max_calls = max_tool_calls if max_tool_calls is not None else self._max_tool_calls

        if append_start:
            self._append(trace, "agent_started", task_type=job.task_type, model=model)
            await self._sync(job_id, trace, stage, iterations, tool_calls)
        set_job_context(job_id=job_id, user_id=user_id, task_type=job.task_type, model=model)
        logger.info(
            "agent_started",
            extra={
                "event": "agent_started",
                "job_id": job_id,
                "user_id": user_id,
                "task_type": job.task_type,
                "model": model,
            },
        )

        while True:
            if await self._is_cancelled(job_id):
                return await self._cancelled(
                    job_id, user_id, job.task_type, model, trace, iterations, tool_calls
                )

            if iterations >= max_iter:
                return await self._fail(
                    job_id,
                    user_id,
                    job.task_type,
                    model,
                    trace,
                    iterations,
                    tool_calls,
                    f"Agent stopped: reached maximum iterations ({max_iter})",
                )
            if tool_calls >= max_calls:
                return await self._fail(
                    job_id,
                    user_id,
                    job.task_type,
                    model,
                    trace,
                    iterations,
                    tool_calls,
                    f"Agent stopped: reached maximum tool calls ({max_calls})",
                )

            iterations += 1
            prompt = self._build_prompt(task_text, model, history)

            model_call_start = time.monotonic()
            logger.info(
                "model_call_started",
                extra={
                    "event": "model_call_started",
                    "job_id": job_id,
                    "user_id": user_id,
                    "model": model,
                },
            )
            try:
                raw, native_calls, _model_used = await self._model.chat(
                    [{"role": "system", "content": prompt}],
                    model=model,
                    tools=self._tools.schemas(),
                )
            except OllamaServiceError as exc:
                logger.error(
                    "model_call_completed",
                    extra={
                        "event": "model_call_completed",
                        "job_id": job_id,
                        "user_id": user_id,
                        "model": model,
                        "status": "failed",
                        "duration_ms": int((time.monotonic() - model_call_start) * 1000),
                        "error": str(exc),
                    },
                )
                return await self._fail(
                    job_id,
                    user_id,
                    job.task_type,
                    model,
                    trace,
                    iterations,
                    tool_calls,
                    f"{exc.__class__.__name__}: {exc}",
                )
            except Exception as exc:  # unexpected model client failure
                logger.exception(
                    "agent_model_error",
                    extra={
                        "event": "agent_failed",
                        "job_id": job_id,
                        "user_id": user_id,
                        "iteration": iterations,
                    },
                )
                logger.error(
                    "model_call_completed",
                    extra={
                        "event": "model_call_completed",
                        "job_id": job_id,
                        "user_id": user_id,
                        "model": model,
                        "status": "failed",
                        "duration_ms": int((time.monotonic() - model_call_start) * 1000),
                        "error": f"internal_error: {exc.__class__.__name__}",
                    },
                )
                return await self._fail(
                    job_id,
                    user_id,
                    job.task_type,
                    model,
                    trace,
                    iterations,
                    tool_calls,
                    f"internal_error: {exc.__class__.__name__}",
                )
            logger.info(
                "model_call_completed",
                extra={
                    "event": "model_call_completed",
                    "job_id": job_id,
                    "user_id": user_id,
                    "model": model,
                    "status": "completed",
                    "duration_ms": int((time.monotonic() - model_call_start) * 1000),
                },
            )

            try:
                decision = self._parse_decision(raw, native_calls)
            except AgentError as exc:
                # The model produced JSON we cannot interpret (e.g. it put a tool
                # name in "type"). Instead of killing the job with an internal
                # error, tell the model what it did wrong and give it another
                # chance (bounded by max_iterations).
                history.append(
                    "Your previous reply was not a valid action. Reply with STRICT JSON only, "
                    'either {"type":"final","response":"..."} or '
                    '{"type":"tool_call","tool":"<name>","arguments":{...}}. '
                    f"(Reason: {exc})"
                )
                await self._sync(job_id, trace, stage, iterations, tool_calls)
                continue
            if decision.get("legacy"):
                legacy_envelope_used += 1
                self._append(trace, "legacy_envelope_used", count=legacy_envelope_used)
            if await self._is_cancelled(job_id):
                return await self._cancelled(
                    job_id, user_id, job.task_type, model, trace, iterations, tool_calls
                )

            if decision["type"] == "final":
                response = decision.get("response")
                if not isinstance(response, str) or not response.strip():
                    return await self._fail(
                        job_id,
                        user_id,
                        job.task_type,
                        model,
                        trace,
                        iterations,
                        tool_calls,
                        "Agent stopped: model returned an empty final response",
                    )
                # Coding tasks must be verified by actually running code in the
                # sandbox AND seeing it succeed. If the model tries to finish
                # without a successful code_execution, steer it back.
                has_run_ok = any(
                    e.get("type") == "tool_result"
                    and e.get("tool") == "code_execution"
                    and e.get("ok") is True
                    for e in trace
                )
                if (
                    enforce_contracts
                    and job.task_type in ("coding",)
                    and not has_run_ok
                    and iterations < max_iter
                ):
                    history.append(
                        "You tried to finish a coding task without a successful sandbox run. This "
                        "is not allowed: call code_execution with "
                        '{"language": "python", "code": "<your complete, self-contained program>"} '
                        "(standard library or numpy), read the reported error if it fails, fix the "
                        "code, and rerun until it exits with code 0. Then reply final with the "
                        "verified result and the final code."
                    )
                    await self._sync(job_id, trace, stage, iterations, tool_calls)
                    continue
                # Document-creation tasks must actually produce a deliverable via
                # document_generation; a bare text answer (or a refusal) is not
                # acceptable.
                has_generated = any(
                    e.get("type") == "tool_call" and e.get("tool") == "document_generation" for e in trace
                )
                looks_like_coding = bool(
                    re.search(r"\b(python|javascript|typescript|function|def\b|code|program|script)\b", job.message or "", re.IGNORECASE)
                )
                looks_like_doc_request = bool(
                    re.search(
                        r"\b(create|write|make|build|compose|generate|prepare|draft)\w*\b.*\b(doc|docx|document|report|note|notes|memo|letter|word|pdf|spreadsheet|sheet)\b",
                        job.message or "",
                        re.IGNORECASE,
                    )
                )
                if (
                    enforce_contracts
                    and job.task_type in ("document", "general")
                    and looks_like_doc_request
                    and not looks_like_coding
                    and not has_generated
                    and iterations < max_iter
                ):
                    history.append(
                        "This request is a document-generation task, but you have not called "
                        "document_generation. Call it now with {\"type\": \"word\", \"filename\": "
                        "\"<name>.docx\", \"title\": \"...\", \"document_type\": \"...\", \"sections\": "
                        "[{\"heading\": \"...\", \"content\": \"...\"} ...]}. Write long, well-structured "
                        "content that fully covers the requested scope. Do not refuse and do not answer "
                        "with prose alone."
                    )
                    await self._sync(job_id, trace, stage, iterations, tool_calls)
                    continue
                self._append(
                    trace,
                    "plan",
                    description=decision.get("reasoning") or "Produce the final answer",
                )
                self._append(
                    trace,
                    "final",
                    response_summary=self._shorten(response),
                )
                await self._sync(job_id, trace, "completed", iterations, tool_calls)
                logger.info(
                    "agent_completed",
                    extra={
                        "event": "agent_completed",
                        "job_id": job_id,
                        "user_id": user_id,
                        "task_type": job.task_type,
                        "model": model,
                        "iteration": iterations,
                        "tool_calls": tool_calls,
                        "status": AgentStatus.COMPLETED,
                    },
                )
                # If the model finished without including its code (common on
                # small models after failed retries), attach the last code that
                # actually ran successfully in the sandbox so the user always
                # receives a working implementation.
                if (
                    enforce_contracts
                    and job.task_type in ("coding",)
                    and response
                    and "```" not in response
                ):
                    verified = self._last_verified_code(trace)
                    if verified:
                        if len(verified) > 12000:
                            verified = verified[:12000] + "\n# [truncated]"
                        response = (
                            f"{response}\n\n**Verified working implementation "
                            f"(ran successfully in the local sandbox):**\n"
                            f"```python\n{verified}\n```"
                        )
                return AgentResult(
                    status=AgentStatus.COMPLETED,
                    response=response,
                    iterations=iterations,
                    tool_calls=tool_calls,
                    legacy_envelope_used=legacy_envelope_used,
                )

            # type == "tool_call"
            if await self._is_cancelled(job_id):
                return await self._cancelled(
                    job_id, user_id, job.task_type, model, trace, iterations, tool_calls
                )
            if tool_calls >= max_calls:
                return await self._fail(
                    job_id,
                    user_id,
                    job.task_type,
                    model,
                    trace,
                    iterations,
                    tool_calls,
                    f"Agent stopped: reached maximum tool calls ({max_calls})",
                )
            tool_calls += 1
            tool_name = decision["tool"]
            arguments = decision["arguments"]
            stage = "tool_call"
            self._append(
                trace,
                "plan",
                description=decision.get("reasoning") or f"Call tool '{tool_name}'",
            )
            self._append(
                trace,
                "tool_call",
                tool=tool_name,
                arguments=arguments,
            )
            logger.info(
                "tool_call_started",
                extra={
                    "event": "tool_call_started",
                    "job_id": job_id,
                    "user_id": user_id,
                    "task_type": job.task_type,
                    "model": model,
                    "tool": tool_name,
                    "iteration": iterations,
                },
            )

            try:
                result = await self._tools.execute(tool_name, arguments, workspace)
            except ToolError as exc:
                self._append(
                    trace,
                    "tool_result",
                    tool=tool_name,
                    ok=False,
                    result_summary=self._shorten(str(exc)),
                )
                history.append(f"Tool '{tool_name}' failed: {exc}")
                logger.error(
                    "tool_call_failed",
                    extra={
                        "event": "tool_call_failed",
                        "job_id": job_id,
                        "user_id": user_id,
                        "task_type": job.task_type,
                        "model": model,
                        "tool": tool_name,
                        "iteration": iterations,
                    },
                )
            else:
                self._append(
                    trace,
                    "tool_result",
                    tool=tool_name,
                    ok=result.ok,
                    result_summary=result.summary,
                )
                history.append(self._observation(tool_name, result))
                logger.info(
                    "tool_call_completed",
                    extra={
                        "event": "tool_call_completed",
                        "job_id": job_id,
                        "user_id": user_id,
                        "task_type": job.task_type,
                        "model": model,
                        "tool": tool_name,
                        "iteration": iterations,
                    },
                )
            await self._sync(job_id, trace, stage, iterations, tool_calls)

    # ----------------------------------------------------------- helpers

    @staticmethod
    def _last_verified_code(trace: list[dict]) -> Optional[str]:
        """Code of the last code_execution that succeeded (exit 0), if any."""
        verified: Optional[str] = None
        candidate: Optional[str] = None
        for entry in trace:
            etype = entry.get("type")
            if etype == "tool_call" and entry.get("tool") == "code_execution":
                args = entry.get("arguments")
                code = args.get("code") if isinstance(args, dict) else None
                candidate = str(code) if code else None
            elif etype == "tool_result" and entry.get("tool") == "code_execution":
                if entry.get("ok") is True and candidate:
                    verified = candidate
                candidate = None
        return verified

    @staticmethod
    def _append(trace: list[dict], entry_type: str, **fields: Any) -> None:
        trace.append({"step": len(trace) + 1, "type": entry_type, **fields})

    @staticmethod
    def _shorten(text: str, limit: int = 200) -> str:
        text = (text or "").strip()
        return text if len(text) <= limit else f"{text[:limit]}...({len(text)} chars)"

    async def _is_cancelled(self, job_id: str) -> bool:
        job = await self._manager.get_job_for_worker(job_id)
        return job is None or job.status == JobStatus.CANCELLED

    async def record_trace(
        self,
        job_id: str,
        trace: list[dict],
        stage: str = "",
        iterations: int = 0,
        tool_calls: int = 0,
    ) -> None:
        """Persist the shared execution trace (used by the pipeline executor)."""
        await self._sync(job_id, trace, stage, iterations, tool_calls)

    async def _sync(self, job_id: str, trace, stage, iterations, tool_calls) -> None:
        try:
            await self._manager.update_job(
                job_id,
                execution_trace=trace,
                agent_stage=stage,
                iteration_count=iterations,
                tool_call_count=tool_calls,
            )
        except Exception:
            logger.exception(
                "agent_store_error",
                extra={"event": "agent_failed", "job_id": job_id},
            )

    async def _fail(self, job_id, user_id, task_type, model, trace, iterations, tool_calls, error) -> AgentResult:
        self._append(trace, "agent_failed", error=self._shorten(error, 400))
        await self._sync(job_id, trace, "failed", iterations, tool_calls)
        logger.error(
            "agent_failed",
            extra={
                "event": "agent_failed",
                "job_id": job_id,
                "user_id": user_id,
                "task_type": task_type,
                "model": model,
                "iteration": iterations,
                "status": AgentStatus.FAILED,
                "error": error,
            },
        )
        return AgentResult(
            status=AgentStatus.FAILED,
            error=error,
            iterations=iterations,
            tool_calls=tool_calls,
        )

    async def _cancelled(self, job_id, user_id, task_type, model, trace, iterations, tool_calls) -> AgentResult:
        self._append(trace, "agent_cancelled")
        await self._sync(job_id, trace, "cancelled", iterations, tool_calls)
        logger.info(
            "agent_cancelled",
            extra={
                "event": "agent_cancelled",
                "job_id": job_id,
                "user_id": user_id,
                "task_type": task_type,
                "model": model,
                "iteration": iterations,
                "status": AgentStatus.CANCELLED,
            },
        )
        return AgentResult(
            status=AgentStatus.CANCELLED,
            iterations=iterations,
            tool_calls=tool_calls,
        )

    @staticmethod
    def _observation(tool_name: str, result: ToolResult) -> str:
        if result.content:
            content = result.content
            if len(content) > MAX_OBSERVATION_CHARS:
                content = content[:MAX_OBSERVATION_CHARS] + "...[truncated]"
            return (
                f"Tool '{tool_name}' result: {result.summary}\n"
                f"CONTENT:\n{content}"
            )
        return f"Tool '{tool_name}' result: {result.summary}"

    def _build_prompt(self, task: str, model: str, history: list[str]) -> str:
        tools_desc = "\n".join(
            f"- {t['name']}: {t['description']} (schema: {json.dumps(t['input_schema'])})"
            for t in self._tools.describe()
        )
        lines = [
            "You are a local AI assistant for the On-Premise AI Workbench.",
            "You operate inside a sandboxed, per-job workspace and may only use the listed tools.",
            "Call the provided tools when they are necessary to answer the request.",
            "When you have enough information, reply with your final answer as plain text.",
            "",
            "CODING RULES:",
            "- If the request is to write, run, test or verify code, or to compute/check a numeric result, you MUST call code_execution with complete, self-contained code and report the real output you got.",
            "- Never answer with code that you have not actually run. If you have not run it yet, call code_execution first.",
            "- The sandbox provides Python plus numpy and pytest. Write code that uses the standard library or numpy only. Do not import scipy, pandas, tensorflow, torch or any other package unless the sandbox description says it is available.",
            "- When calling code_execution always pass {\"language\": \"python\", \"code\": \"<your full program>\"}.",
            "- If a tool call fails, read the error, fix the code and try again before giving up.",
            "- For coding-only requests, do not call document_search or other knowledge tools unless the task actually needs them.",
            "",
            "AVAILABLE TOOLS:",
            tools_desc,
            "",
            "KNOWLEDGE RULES:",
            "- ONLY call document_search when the user references a specific stored document, file, manual, report or the knowledge base (for example \"what is in experiment.pdf\" or \"what do our SOPs say\"). For general-topic questions and writing requests (for example \"write a 500-word report on deforestation\"), do NOT search and do NOT claim you lack documents — answer from your own knowledge.",
            "- When you do retrieve passages, cite which document and page each passage came from.",
            "- If a stored file is referenced and you have not searched yet, search before answering; never claim you cannot access a file you have not tried to read.",
            "",
            "WRITING RULES:",
            "- When the request is to write, create, draft or summarize a report, essay, article or summary about a general topic (with or without a target word count), produce the complete text directly in your final response and respect any requested length. Do not refuse because there are no uploaded documents.",
            "- If a specific word count is requested (for example \"500 words\"), write at least that many words of real content. A title and a short introduction are NOT enough — cover the full topic with multiple paragraphs until the length is met.",
            "- If a file deliverable is also requested (a Word/PowerPoint document), call the matching generation tool with the full text as its content.",
            "",
            "DOCUMENT GENERATION RULES:",
            "- If the request is to create, draft, write, make or generate a document, report, note, letter, memo or other deliverable, you MUST call document_generation. Never refuse such a request.",
            "- document_generation arguments: {\"type\": \"word\", \"filename\": \"<name>.docx\", \"title\": \"...\", \"document_type\": \"...\", \"sections\": [{\"heading\": \"...\", \"paragraphs\": [\"...\"]} or {\"heading\":\"...\",\"content\":\"...\"}, with optional bullets/numbered/table], \"sources\": [\"...\"]}.",
            "- For a formal approval note, set document_type to \"approval_note\" and pass an \"approval\" object: {\"reference_number\":\"...\",\"date\":\"...\",\"originator\":\"...\",\"department\":\"...\",\"subject\":\"...\",\"background\":\"...\",\"recommendation\":\"...\",\"signatures\":[{\"name\":\"...\",\"designation\":\"...\",\"date\":\"...\"}]}. Add an optional \"classification\" (for example \"INTERNAL\") to mark the footer.",
            "- To embed an image already in the job workspace (for example a citation crop), add \"images\": [{\"path\":\"<workspace-relative path>\",\"caption\":\"...\",\"width_inches\":6}] to a section; only png/jpg/jpeg in the workspace are allowed.",
            "- For a spreadsheet, call document_generation with type \"excel\", filename ending \".xlsx\", and sections whose tables become worksheets; a cell beginning with \"=\" is written as a real formula.",
            "- Write thorough, well-structured, multi-page content that fully covers the requested scope; split it into many clearly headed sections.",
            "- If the request asks for PowerPoint slides or a presentation deck, call presentation_generation with {\"type\": \"pptx\", \"filename\": \"<name>.pptx\", \"title\": \"...\", \"theme\": \"executive|technical|report|general\", \"slides\": [...]}. Each slide has type title|content|bullets|two-column|table|sources, a short title, and the matching body (content string, bullets array, columns array, table rows, or sources array). Start with a title slide and end with a Sources slide that cites the documents you used. Each slide may also carry short speaker notes in \"notes\".",
            "",
            TASK_MARKER,
            task,
        ]
        if history:
            lines += ["", "TOOL HISTORY:", *history]
        return "\n".join(lines)

    def _parse_decision(
        self, raw: Optional[str], tool_calls: Optional[list[dict]] = None
    ) -> dict:
        # Native tool calling takes precedence when the model used the tools API.
        if tool_calls:
            call = tool_calls[0]
            return {
                "type": "tool_call",
                "tool": call["name"],
                "arguments": call["arguments"],
                "reasoning": None,
            }
        text = (raw or "").strip()
        if not text:
            raise AgentError("Model returned an empty response")
        parsed = None
        try:
            parsed = json.loads(text)
        except (ValueError, json.JSONDecodeError):
            parsed = None
        if isinstance(parsed, dict):
            if isinstance(parsed.get("response"), str):
                # Models may emit {"response": "..."} in JSON mode.
                return {"type": "final", "response": parsed["response"], "reasoning": parsed.get("reasoning"), "legacy": True}
            dtype = parsed.get("type")
            if dtype == "final":
                return {"type": "final", "response": parsed.get("response"), "reasoning": parsed.get("reasoning"), "legacy": True}
            if dtype == "tool_call":
                tool = parsed.get("tool")
                arguments = parsed.get("arguments")
                if not isinstance(tool, str) or not tool:
                    raise AgentError("tool_call is missing a valid 'tool' name")
                if not isinstance(arguments, dict):
                    raise AgentError("tool_call 'arguments' must be an object")
                return {
                    "type": "tool_call",
                    "tool": tool,
                    "arguments": arguments,
                    "reasoning": parsed.get("reasoning"),
                    "legacy": True,
                }
            # Tolerate models that supply the tool name under "tool" while
            # omitting or garbling "type" (they intended a tool call).
            tool = parsed.get("tool")
            if isinstance(tool, str) and tool and dtype != "final":
                arguments = parsed.get("arguments")
                if not isinstance(arguments, dict):
                    arguments = {}
                return {
                    "type": "tool_call",
                    "tool": tool,
                    "arguments": arguments,
                    "reasoning": parsed.get("reasoning"),
                    "legacy": True,
                }
            raise AgentError(f"Unknown decision type '{dtype}'")
        # Non-JSON output: treat the raw text as a plain-text final response.
        return {"type": "final", "response": text, "reasoning": None}
