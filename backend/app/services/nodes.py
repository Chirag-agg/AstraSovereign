"""Typed agent node sequence: extract -> retrieve -> compute -> draft.

The outer sequence is linear; the bounded plan/tool/observe loop lives *inside*
each node. Nodes hand off typed objects (``FindingsObject`` -> ``AssessmentResult``),
never a raw transcript, so ``compute`` never re-reads scanned text and ``draft``
renders exclusively from the one assessment object.

Preconditions that are unmet produce a recorded ``node_skipped`` with a reason, so
a node that should have run and didn't is visible instead of silent. ``compute``
that exhausts its budget degrades to ``REFER_ASSESSMENT_INCOMPLETE`` rather than
failing or leaving a blank field.
"""

import logging
import re
from typing import Any, Callable, Optional

from app.schemas.findings import AssessmentResult, FindingsObject
from app.services.agent import AgentResult, AgentStatus
from app.services.attachments import render_attachment_block
from app.services.capability_router import (
    CapabilityResult,
    CapabilityRouter,
    CapabilityRoutingError,
)
from app.services.findings import (
    REASON_INCOMPLETE,
    assess,
    degraded_result,
    minimal_thickness_mm,
    traceability_violations,
)
from app.services.log_context import set_job_context

logger = logging.getLogger("app.nodes")

# Capability each node asks the router for at entry. ``extract`` needs a
# tool-capable text model to orchestrate reads; the vision model is invoked by
# the ``document_vision`` tool, not as the node's own model (llava rejects the
# tools API with HTTP 400).
NODE_CAPABILITY = {
    "extract": "document",
    "retrieve": "document",
    "compute": "coding",
    "draft": "general",
}

# Tools each node may see. A node cannot misuse a tool it cannot see, which is
# more robust than instruction wording on small models.
NODE_TOOLS = {
    "extract": {
        "document_search",
        "document_exact_search",
        "read_document",
        "document_vision",
        "submit_findings",
        "list_files",
    },
    "retrieve": {"document_search", "document_exact_search"},
    "compute": {"code_execution"},
    # draft is the terminal general-purpose worker node: generators plus the
    # workspace file tools, so non-document tasks have somewhere to run.
    "draft": {
        "document_generation",
        "presentation_generation",
        "list_files",
        "read_file",
        "write_file",
    },
}

# Nodes that receive the structured attachment manifest (node input). Used by
# the static reachability check as a producer of e.g. ``document_id``.
NODE_INPUT_NODES = {"extract", "retrieve"}

# _run_compute's "is this a computational task" precondition (no attachments,
# so no findings to compute from) reads job.task_type == "coding" from the
# SemanticCapabilityClassifier alone. That classifier is a small hand-curated
# nearest-exemplar match (measured ~88% held-out accuracy) sitting entirely
# outside this node's own control — a misclassified plain-text coding request
# ("reverse this string in python and test it") skips compute silently and
# falls through to draft's general model with no code_execution tool at all,
# a much larger quality gap than a wrong label. This backstop is deliberately
# a cheap, deterministic, second opinion the classifier's own accuracy cannot
# regress: it only ever WIDENS compute's activation (never narrows it), so a
# classifier fix later is additive, not a replacement for this.
CODING_INTENT_RE = re.compile(
    r"\b(python|javascript|typescript|function|def\b|code|program|script|"
    r"algorithm|compile|debug)\b",
    re.IGNORECASE,
)

# draft's generic (no-assessment) path has both generator tools in scope with
# no structural gate on which one gets called, so a weak model that is more
# "used to" producing a Word document can default to document_generation even
# when the request explicitly asked for a deck (observed). This is checked
# against the ORIGINAL request text, before draft wraps it with retrieved
# context, so "make a PPT" is detected regardless of what else is in scope.
PRESENTATION_INTENT_RE = re.compile(
    r"\b(ppt|pptx|powerpoint|presentation|slide\w*|deck)\b", re.IGNORECASE
)

# "Write 500 words" / "a 500-word report" was pure prompt wording (WRITING
# RULES / DOCUMENT GENERATION RULES in agent.py's system prompt) with no
# structural check behind it (observed: a "500 words" request answered with
# ~50) — the same shape of gap as PRESENTATION_INTENT_RE and
# CODING_INTENT_RE above: a weak model's compliance was the only thing
# enforcing it. Matches "500 words"/"500-word" but not a bare number, so it
# only fires when a length was actually requested.
WORD_COUNT_RE = re.compile(r"\b(\d{2,5})[\s-]*words?\b", re.IGNORECASE)


def _collect_text(value: Any) -> list[str]:
    """Every string found anywhere in a (possibly nested) tool-call
    arguments structure — deliberately schema-agnostic (sections/paragraphs/
    bullets/slides/etc. all get walked the same way) so this doesn't need
    updating every time document_generation's or presentation_generation's
    argument shape changes."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        texts: list[str] = []
        for v in value.values():
            texts.extend(_collect_text(v))
        return texts
    if isinstance(value, list):
        texts = []
        for item in value:
            texts.extend(_collect_text(item))
        return texts
    return []


_CONTENT_GENERATOR_TOOLS = {"document_generation", "presentation_generation"}


def _submitted_content_word_count(trace_segment: list[dict]) -> int:
    """Words across every document_generation/presentation_generation call
    in this trace segment — the deliverable's actual content, not the
    chat response (which may just be a short "here's your file" note)."""
    total = 0
    for entry in trace_segment:
        if entry.get("type") == "tool_call" and entry.get("tool") in _CONTENT_GENERATOR_TOOLS:
            for text in _collect_text(entry.get("arguments")):
                total += len(text.split())
    return total


def make_word_count_validator(min_words: int) -> Callable[[str, list[dict]], Optional[str]]:
    """A content_validator (see Agent.run) requiring at least min_words,
    counted from whichever channel actually carries the content: the plain
    chat response, or a generator tool's submitted content — whichever is
    longer, so "write 500 words and save it as a docx" isn't penalized for
    a short chat confirmation when the real 500 words are in the file, and
    a pure chat request with no deliverable is still checked on its own.
    """

    def validator(response: str, trace_segment: list[dict]) -> Optional[str]:
        response_words = len((response or "").split())
        content_words = _submitted_content_word_count(trace_segment)
        actual = max(response_words, content_words)
        if actual >= min_words:
            return None
        return (
            f"This falls well short of the requested length: about {actual} words "
            f"so far against a minimum of {min_words}. A short answer is not "
            "acceptable here. Substantially expand it with real detail across "
            "multiple paragraphs or sections until the length is met — do not "
            "pad with filler or repetition."
        )

    return validator


# Infrastructure failures mean the work could not be attempted; they must fail
# the job, not degrade the node. Budget exhausted / precondition unmet / a tool
# shortfall are node-level outcomes and degrade instead.
_INFRASTRUCTURE_ERROR_PREFIXES = (
    "OllamaUnavailableError",
    "OllamaTimeoutError",
    "OllamaModelNotFoundError",
    "OllamaRequestError",
)


class NodeInfrastructureError(Exception):
    """A node could not attempt its work, so the job must fail."""


class NodeCancelledError(Exception):
    """The job was cancelled during a node; propagate the cancellation."""


def _is_infrastructure_failure(result: AgentResult) -> bool:
    if result.status != AgentStatus.FAILED:
        return False
    error = result.error or ""
    return any(error.startswith(prefix) for prefix in _INFRASTRUCTURE_ERROR_PREFIXES)


class NodeAgent:
    """Runs the typed node sequence and records per-node routing decisions."""

    def __init__(
        self,
        agent,
        capability_router: CapabilityRouter,
        registry=None,
        extract_iterations: int = 10,
        compute_iterations: int = 6,
        draft_iterations: int = 8,
        scheduler=None,
        available_models_provider=None,
        fallback_enabled: bool = True,
        is_cancelled=None,
        tools=None,
        ollama_service=None,
        unload_wait_seconds: float = 2.0,
    ) -> None:
        self._agent = agent
        self._router = capability_router
        self._registry = registry
        # ToolRegistry, so draft can render deliverables deterministically from a
        # complete assessment instead of paying a model to call the generators.
        self._tools = tools
        self._scheduler = scheduler
        self._available_models_provider = available_models_provider
        self._fallback_enabled = fallback_enabled
        self._is_cancelled = is_cancelled
        # Used to force-unload a model at a genuine capability switch (see
        # _ensure_reservation) instead of waiting out Ollama's idle timer.
        self._ollama = ollama_service
        self._unload_wait_seconds = unload_wait_seconds
        # Model currently reserved with the scheduler. Held across consecutive
        # nodes that resolve to the same model (never reserve/release per node),
        # released on change or at the end of the sequence.
        self._held_model: Optional[str] = None
        self._budgets = {
            "extract": extract_iterations,
            "compute": compute_iterations,
            "draft": draft_iterations,
            "retrieve": 3,
        }
        # Exposed for the verifier / tests: the typed objects the sequence produced.
        self.last_findings: Optional[FindingsObject] = None
        self.last_assessment: Optional[AssessmentResult] = None
        self.last_retrieval: str = ""
        self.last_attachments: list[dict] = []
        self._tool_calls = 0
        # Every node's user-relevant output, in order. draft is the only exit and
        # drafts from whatever this holds (never an enumerated source list).
        self._node_outputs: list[str] = []

    def _resolve(self, capability: str, job) -> tuple[CapabilityResult, float, str]:
        """Resolve a capability's model (availability + fallback aware) and record
        a MODEL_FALLBACK audit event when a substitution happens."""
        available = (
            self._available_models_provider()
            if self._available_models_provider is not None
            else None
        )
        result = self._router.resolve(
            capability,
            available_models=available,
            fallback_enabled=self._fallback_enabled,
        )
        if result.fallback_active:
            logger.info(
                "model_fallback",
                extra={
                    "event": "model_fallback",
                    "job_id": job.job_id,
                    "user_id": job.user_id,
                    "task_type": capability,
                    "requested": result.requested_model,
                    "actual": result.model,
                    "fallback_reason": "model_unavailable",
                },
            )
        return result, *self._confidence(capability, result.model)

    def _confidence(self, capability: str, model: str) -> tuple[float, str]:
        if self._registry is None:
            return 0.6, ""
        declared = [entry.model for entry in self._registry.by_capability(capability)]
        if model in declared:
            others = [candidate for candidate in declared if candidate != model]
            return 1.0, (others[0] if others else "")
        general = self._registry.get("general")
        runner_up = general.model if general is not None and general.model != model else ""
        return 0.6, runner_up

    async def run(
        self,
        job,
        workspace,
        lead_model: str = "",
        task_text: Optional[str] = None,
        attachments: Optional[list[dict]] = None,
    ) -> AgentResult:
        task = task_text if task_text is not None else job.message
        trace: list[dict] = []
        self._tool_calls = 0
        self._node_outputs = []
        findings: Optional[FindingsObject] = None
        assessment: Optional[AssessmentResult] = None
        manifest = list(attachments or [])
        self.last_attachments = manifest
        attachment_block = render_attachment_block(manifest)
        # Attachments are a reason to run extraction even if the prompt does not
        # name a document (the nameplate image carries no indexable text).
        attempt_docs = bool(manifest)
        cursor = 0

        # Resolve every distinct node capability up front so the model swap points
        # are known and the scheduler reservation can be held across nodes that
        # share a model instead of reserve/releasing per node.
        plan: dict[str, tuple[CapabilityResult, float, str]] = {}
        try:
            for key in ("extract", "retrieve", "compute", "draft"):
                capability = NODE_CAPABILITY[key]
                if capability not in plan:
                    plan[capability] = self._resolve(capability, job)
            # --- extract -----------------------------------------------------
            cursor, findings = await self._run_extract(
                job, workspace, task, trace, cursor, attempt_docs, attachment_block,
                plan["document"],
            )
            # --- retrieve ----------------------------------------------------
            cursor, retrieval = await self._run_retrieve(
                job, workspace, task, trace, cursor, attempt_docs, attachment_block,
                plan["document"],
            )
            self.last_retrieval = retrieval
            # --- compute -----------------------------------------------------
            cursor, assessment, degraded, compute_response = await self._run_compute(
                job, workspace, task, trace, cursor, findings, retrieval,
                plan["coding"],
            )
            self.last_findings = findings
            self.last_assessment = assessment
            # draft is the terminal node and the only user-facing exit. It runs
            # whenever ANY node produced output (collected generically in
            # ``self._node_outputs``), and for non-attachment jobs.
            something_to_draft = bool(self._node_outputs) or not attempt_docs
            cursor, response = await self._run_draft(
                job, workspace, task, trace, cursor, findings, assessment,
                something_to_draft, plan["general"], working=compute_response,
            )
        except NodeCancelledError:
            trace.append({"step": len(trace) + 1, "type": "agent_cancelled"})
            await self._record(job.job_id, trace, "cancelled", cursor, self._tool_calls)
            return AgentResult(status=AgentStatus.CANCELLED, iterations=cursor)
        except (NodeInfrastructureError, CapabilityRoutingError) as exc:
            trace.append(
                {
                    "step": len(trace) + 1,
                    "type": "node_infrastructure_failed",
                    "error": str(exc)[:400],
                }
            )
            await self._record(job.job_id, trace, "failed", cursor, self._tool_calls)
            return AgentResult(status=AgentStatus.FAILED, error=str(exc), iterations=cursor)
        finally:
            await self._release_reservation(job)

        await self._record(job.job_id, trace, "completed", cursor, self._tool_calls)
        if response is None:
            return AgentResult(
                status=AgentStatus.COMPLETED,
                response=(
                    "Assessment could not be grounded in the supplied documents; "
                    "no deliverables were generated."
                ),
                iterations=cursor,
            )
        return AgentResult(status=AgentStatus.COMPLETED, response=response, iterations=cursor)

    async def _run_extract(
        self, job, workspace, task, trace, cursor, attempt_docs, attachment_block, planned
    ):
        if not attempt_docs:
            self._skip(trace, "extract", "no documents or images referenced in the request")
            return cursor, None
        route, confidence, runner_up = planned
        model = route.model
        self._node_started(trace, "extract", model, confidence, runner_up)
        instruction = (
            "Read the attachments (their content is in this message), then call "
            "submit_findings once with the nameplate geometry and every shell-course reading "
            "(course, value_mm, survey date, source). Never leave readings empty."
        )
        start = len(trace)
        parts = [instruction]
        if attachment_block:
            parts.append(attachment_block)
        parts.append(f"REQUEST:\n{task}")
        await self._ensure_reservation(job, model, route.requirements, trace=trace)
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text="\n\n".join(parts),
            max_iterations=self._budgets["extract"], max_tool_calls=8,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["extract"],
            terminal_tools={"submit_findings"},
        )
        if _is_infrastructure_failure(result):
            raise NodeInfrastructureError(result.error or "infrastructure failure")
        self._tool_calls += result.tool_calls
        if result.status == AgentStatus.CANCELLED:
            raise NodeCancelledError()
        cursor += result.iterations
        findings, submit_called = self._submitted_findings(trace, start)
        if findings is None:
            self._node_degraded(
                trace,
                "extract",
                "submit_findings was rejected by schema validation"
                if submit_called
                else "submit_findings was not called",
                iterations=result.iterations,
                tool_calls=result.tool_calls,
            )
            if (result.response or "").strip():
                self._node_outputs.append(result.response.strip())
            return cursor, None
        if not findings.readings:
            # A valid but empty object: the document has no structured readings
            # (e.g. a Q&A/retrieval job). Not a typed finding set, so the node
            # still degrades and retrieval/draft carry the answer.
            self._node_degraded(
                trace, "extract", "submit_findings contained no readings",
                iterations=result.iterations, tool_calls=result.tool_calls,
            )
            return cursor, None
        self._node_completed(
            trace, "extract", readings=len(findings.readings),
            iterations=result.iterations, tool_calls=result.tool_calls,
        )
        self._node_outputs.append(findings.model_dump_json())
        return cursor, findings

    @staticmethod
    def _submitted_findings(trace, start):
        """``(findings, submit_called)`` from the accepted submit_findings call.

        The typed output is a tool call, not free text: an accepted call yields
        the findings object; a rejected call or a missing call yields ``None``.
        """
        arguments = None
        accepted = False
        for entry in trace[start:]:
            if entry.get("type") == "tool_call" and entry.get("tool") == "submit_findings":
                arguments = entry.get("arguments")
            elif entry.get("type") == "tool_result" and entry.get("tool") == "submit_findings":
                accepted = entry.get("ok") is True
        if arguments is None:
            return None, False
        if not accepted:
            return None, True
        try:
            findings = FindingsObject.model_validate(arguments)
        except Exception:
            return None, True
        return findings, True

    async def _run_retrieve(
        self, job, workspace, task, trace, cursor, attempt_docs, attachment_block, planned
    ):
        if not attempt_docs:
            self._skip(trace, "retrieve", "no knowledge base documents referenced")
            return cursor, ""
        route, confidence, runner_up = planned
        model = route.model
        self._node_started(trace, "retrieve", model, confidence, runner_up)
        instruction = (
            "You MUST call document_search before answering. Retrieve the governing "
            "procedure from the local knowledge base, prefer the current revision, and "
            "cite document and page. Output short passages only, no deliverable."
        )
        start = len(trace)
        parts = [instruction]
        if attachment_block:
            parts.append(attachment_block)
        parts.append(f"REQUEST:\n{task}")
        await self._ensure_reservation(job, model, route.requirements, trace=trace)
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text="\n\n".join(parts),
            max_iterations=self._budgets["retrieve"], max_tool_calls=4,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["retrieve"],
        )
        if _is_infrastructure_failure(result):
            raise NodeInfrastructureError(result.error or "infrastructure failure")
        self._tool_calls += result.tool_calls
        if result.status == AgentStatus.CANCELLED:
            raise NodeCancelledError()
        cursor += result.iterations
        searched = any(
            entry.get("type") == "tool_call" and entry.get("tool") == "document_search"
            for entry in trace[start:]
        )
        if not searched:
            self._node_degraded(
                trace, "retrieve", "document_search was not invoked",
                iterations=result.iterations, tool_calls=result.tool_calls,
            )
            return cursor, ""
        retrieval = result.response or ""
        if retrieval.strip():
            self._node_outputs.append(retrieval.strip())
        self._node_completed(
            trace, "retrieve", ok=result.status == AgentStatus.COMPLETED,
            iterations=result.iterations, tool_calls=result.tool_calls,
        )
        return cursor, retrieval

    async def _run_compute(
        self, job, workspace, task, trace, cursor, findings, retrieval, planned
    ):
        has_findings = findings is not None and bool(findings.readings)
        computational = getattr(job, "task_type", "") == "coding" or bool(
            CODING_INTENT_RE.search(task or "")
        )
        if not has_findings and not computational:
            self._skip(trace, "compute", "no findings and the task is not computational")
            return cursor, None, False, None
        route, confidence, runner_up = planned
        model = route.model
        self._node_started(trace, "compute", model, confidence, runner_up)
        if has_findings:
            min_thickness = minimal_thickness_mm(findings)
            alert = round(min_thickness + 1.0, 2) if min_thickness is not None else None
            instruction = (
                "Compute corrosion rate = (previous - current)/years, remaining life = "
                "(current - t_min)/rate, next interval = lesser of remaining life/2 and 15 years. "
                "Run the calculation with code_execution and show the steps. Use ONLY the typed "
                "findings below; do not read raw scanned text.\n"
                f"FINDINGS: {findings.model_dump_json()}"
            )
        else:
            min_thickness = None
            alert = None
            instruction = (
                "This is a computational task. Call code_execution with a complete, "
                "self-contained program, run it, and report the real output. Do not answer "
                "from memory."
            )
        start = len(trace)
        await self._ensure_reservation(job, model, route.requirements, trace=trace)
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text=f"{instruction}\n\nREQUEST:\n{task}",
            max_iterations=self._budgets["compute"], max_tool_calls=6,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["compute"],
            # No corrosion-rate or remaining-life number reaches a deliverable
            # unless it actually came out of a sandbox run: a model that
            # answers from memory without calling code_execution is steered
            # back (bounded by the node's own iteration budget), never
            # accepted silently.
            require_tool_success={"code_execution"},
        )
        if _is_infrastructure_failure(result):
            raise NodeInfrastructureError(result.error or "infrastructure failure")
        self._tool_calls += result.tool_calls
        if result.status == AgentStatus.CANCELLED:
            raise NodeCancelledError()
        cursor += result.iterations
        # Node-level backstop: require_tool_success re-prompts the model but,
        # like the terminal_tools contract it mirrors, gives up and accepts
        # the model's last answer once the iteration budget is spent. Re-check
        # here so a stubborn model that never actually ran the sandbox cannot
        # slip an unverified "completed" result past the gate.
        sandbox_verified = any(
            entry.get("type") == "tool_result"
            and entry.get("tool") == "code_execution"
            and entry.get("ok") is True
            for entry in trace[start:]
        )
        if result.status == AgentStatus.COMPLETED and not sandbox_verified:
            result = AgentResult(
                status=AgentStatus.FAILED,
                error="compute finished without a verified sandbox run",
                iterations=result.iterations,
                tool_calls=result.tool_calls,
            )
        if not has_findings:
            if result.status != AgentStatus.COMPLETED:
                self._node_degraded(
                    trace, "compute", result.error or "iteration budget exhausted",
                    iterations=result.iterations, tool_calls=result.tool_calls,
                )
                # draft has no code_execution tool and must not quietly redo the
                # computation from memory to fill the gap: hand it an explicit
                # unverified notice instead of leaving node_outputs empty (which
                # would send draft the bare task and invite exactly that).
                self._node_outputs.append(
                    "COMPUTATION NOT VERIFIED: the sandbox did not report a "
                    "successful result within the allotted attempts "
                    f"({result.error or 'iteration budget exhausted'}). State plainly that "
                    "no verified numeric result is available; do not invent one."
                )
                return cursor, None, True, None
            self._node_completed(
                trace, "compute", computational=True,
                iterations=result.iterations, tool_calls=result.tool_calls,
            )
            if (result.response or "").strip():
                self._node_outputs.append(result.response.strip())
            return cursor, None, False, result.response
        assessment = assess(findings, min_thickness, alert)
        degraded = result.status != AgentStatus.COMPLETED
        if degraded:
            assessment = degraded_result(findings, min_thickness, alert)
            self._node_degraded(
                trace, "compute", "iteration budget exhausted",
                iterations=result.iterations, tool_calls=result.tool_calls,
            )
        violations = traceability_violations(findings, assessment)
        if violations:
            self._node_degraded(
                trace, "compute", f"untraceable courses: {', '.join(violations)}",
                iterations=result.iterations, tool_calls=result.tool_calls,
            )
            assessment = degraded_result(findings, min_thickness, alert)
        self._node_completed(
            trace, "compute", courses=len(assessment.courses),
            iterations=result.iterations, tool_calls=result.tool_calls,
        )
        self._node_outputs.append(assessment.model_dump_json())
        # Carry the sandbox working so draft can render it as an appendix; the
        # authoritative numbers still come from assess() in Python.
        return cursor, assessment, degraded, (result.response or "")

    async def _run_draft(
        self, job, workspace, task, trace, cursor, findings, assessment, something_to_draft,
        planned, working=None,
    ):
        if not something_to_draft:
            self._skip(trace, "draft", "nothing grounded to draft from")
            return cursor, None
        route, confidence, runner_up = planned
        model = route.model
        self._node_started(trace, "draft", model, confidence, runner_up)
        # When the assessment is complete, the three deliverables are fully
        # determined by it, so render them deterministically in Python — no model
        # turn, no argument coercion, and cross-deliverable consistency is
        # structural rather than hoped for.
        if (
            assessment is not None
            and self._tools is not None
            and self._tools.get("document_generation") is not None
            and self._tools.get("presentation_generation") is not None
        ):
            return cursor, await self._render_assessment(
                job, workspace, trace, assessment, findings, working
            )
        if assessment is not None:
            payload = assessment.model_dump_json()
            instruction = (
                "Build ALL THREE deliverables from this single assessment object, in one node: "
                "1) an approval note (document_generation, type word, document_type approval_note) "
                "that states each course's status AND its reason_code in words; "
                "2) a spreadsheet (document_generation, type excel) with the assessment table; "
                "3) a short deck (presentation_generation). Do not invent numbers; render only "
                "what the assessment contains. Distinguish REFER_NO_BASELINE (a finding: no prior "
                "survey) from REFER_ASSESSMENT_INCOMPLETE (a limitation: assessment did not finish).\n"
                f"ASSESSMENT: {payload}"
            )
            node_task = f"{instruction}\n\nREQUEST:\n{task}"
        elif self._node_outputs:
            context = "\n\n".join(self._node_outputs)
            node_task = (
                "Answer the request using the results below; cite sources and do not "
                "invent content.\n"
                f"RESULTS:\n{context}\n\nREQUEST:\n{task}"
            )
        else:
            # Degenerate path: a plain prompt passes through (nearly) unmodified,
            # so chat does not get wordier just because it ran through the engine.
            node_task = task
        # Only the no-assessment paths reach the model with both generator
        # tools in scope and no gate on which one gets called (the assessment
        # path above is either fully deterministic via _render_assessment, or
        # its own instruction text already names presentation_generation
        # explicitly). Require it when the ORIGINAL request text asked for a
        # deck, so a model that defaults to Word anyway cannot finish without
        # actually producing the requested pptx.
        require_success = None
        content_validator = None
        if assessment is None:
            if PRESENTATION_INTENT_RE.search(task or ""):
                require_success = {"presentation_generation"}
            # Same reasoning as the deck gate above: only the no-assessment
            # paths lack a structural length check (the assessment path
            # renders deterministically or already writes full content from
            # typed data, not free-text word count).
            word_count_match = WORD_COUNT_RE.search(task or "")
            if word_count_match:
                content_validator = make_word_count_validator(int(word_count_match.group(1)))
        await self._ensure_reservation(job, model, route.requirements, trace=trace)
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text=node_task,
            max_iterations=self._budgets["draft"], max_tool_calls=10,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["draft"],
            require_tool_success=require_success,
            content_validator=content_validator,
        )
        if _is_infrastructure_failure(result):
            raise NodeInfrastructureError(result.error or "infrastructure failure")
        self._tool_calls += result.tool_calls
        if result.status == AgentStatus.CANCELLED:
            raise NodeCancelledError()
        cursor += result.iterations
        if result.status != AgentStatus.COMPLETED:
            self._node_degraded(
                trace, "draft", result.error or "draft did not complete",
                iterations=result.iterations, tool_calls=result.tool_calls,
            )
            return cursor, None
        self._node_completed(
            trace, "draft",
            iterations=result.iterations, tool_calls=result.tool_calls,
        )
        return cursor, result.response

    # -- deterministic deliverables -------------------------------------------

    @staticmethod
    def _fmt(value) -> str:
        return "-" if value is None else f"{value:.2f}"

    @staticmethod
    def _reason_text(course) -> str:
        return {
            "REFER_NO_BASELINE": "no previous baseline reading; referred for engineering review",
            "REFER_AMBIGUOUS_READING": (
                "ambiguous reading (more than one candidate value); referred for human review"
            ),
            "REFER_ASSESSMENT_INCOMPLETE": "assessment incomplete; referred for engineering review",
        }.get(course.reason_code, course.reason or "")

    def _assessment_rows(self, assessment) -> list[list[str]]:
        rows = [[
            "Course", "Current (mm)", "Previous (mm)", "Corrosion Rate (mm/yr)",
            "Remaining Life (yr)", "Next Inspection (yr)", "Status", "Reason",
        ]]
        for course in assessment.courses:
            label = (course.course or "").strip()
            if not label.upper().startswith("C"):
                label = f"C{label}"
            rows.append([
                label,
                self._fmt(course.current_mm),
                self._fmt(course.previous_mm),
                self._fmt(course.corrosion_rate_mm_per_year),
                self._fmt(course.remaining_life_years),
                self._fmt(course.next_inspection_years),
                course.status,
                self._reason_text(course),
            ])
        return rows

    def _recommendation(self, assessment) -> str:
        def courses_for(status):
            return [c.course for c in assessment.courses if c.status == status]

        parts = []
        repair = courses_for("REPAIR_REQUIRED")
        alert = courses_for("ALERT")
        refer = courses_for("REFER")
        if repair:
            parts.append(f"repair courses {', '.join(repair)} (below retirement thickness)")
        if alert:
            parts.append(f"monitor courses {', '.join(alert)} at the alert threshold")
        if refer:
            parts.append(f"refer courses {', '.join(refer)} for engineering review")
        return "; ".join(parts) or "No action required."

    async def _render_assessment(self, job, workspace, trace, assessment, findings, working):
        """Render all three deliverables from the assessment object in Python.

        Reuses the generation tools (containment, artifact registration, audit),
        but the model is not in the loop: the assessment fully determines the
        documents, so consistency across them is structural.
        """
        set_job_context(job_id=job.job_id, user_id=job.user_id, task_type=job.task_type)
        rows = self._assessment_rows(assessment)
        procedure = (getattr(findings, "procedure", "") or "SOP-09") if findings else "SOP-09"
        tank = (getattr(findings, "tank", "") or "") if findings else ""
        min_t = self._fmt(assessment.min_thickness_mm)
        alert_t = self._fmt(assessment.alert_thickness_mm)
        course5 = next((c for c in assessment.courses if c.course == "5"), None)
        reason5 = self._reason_text(course5) if course5 is not None else ""
        background = (
            f"Assessed per {procedure}. Retirement thickness {min_t} mm; alert "
            f"threshold {alert_t} mm. {reason5}"
        ).strip()
        recommendation = self._recommendation(assessment)
        approval = {
            "reference_number": "",
            "date": "",
            "originator": "Inspection Department",
            "department": "Mechanical Maintenance",
            "subject": f"Tank {tank or '204'} fitness-for-service assessment per {procedure}",
            "background": background,
            "recommendation": recommendation,
            "signatures": [],
        }
        sections = [{"heading": "Findings", "paragraphs": [background], "table": rows}]
        if working and working.strip():
            sections.append(
                {"heading": "Calculation appendix", "paragraphs": [working.strip()[:8000]]}
            )
        docx_args = {
            "type": "word",
            "filename": "approval_note.docx",
            "title": f"Tank {tank or '204'} Fitness-for-Service Approval Note",
            "document_type": "approval_note",
            "classification": "INTERNAL",
            "sections": sections,
            "sources": [procedure],
            "approval": approval,
        }
        xlsx_args = {
            "type": "excel",
            "filename": "assessment.xlsx",
            "title": f"Tank {tank or '204'} Fitness-for-Service Calculations",
            "document_type": "spreadsheet",
            "sections": [{"heading": "Assessment", "table": rows}],
            "sources": [procedure],
        }
        slides = [
            {
                "type": "title",
                "title": f"Tank {tank or '204'} Fitness-for-Service",
                "content": f"Per {procedure}",
            },
            {
                "type": "bullets",
                "title": "Findings",
                "bullets": [f"Retirement {min_t} mm; alert {alert_t} mm", recommendation],
            },
            {"type": "table", "title": "Assessment", "table": rows},
            {"type": "sources", "title": "Sources", "sources": [procedure]},
        ]
        pptx_args = {
            "type": "pptx",
            "filename": "assessment.pptx",
            "title": f"Tank {tank or '204'}",
            "slides": slides,
        }

        for tool_name, args in (
            ("document_generation", docx_args),
            ("document_generation", xlsx_args),
            ("presentation_generation", pptx_args),
        ):
            tool = self._tools.get(tool_name)
            trace.append(
                {
                    "step": len(trace) + 1,
                    "type": "tool_call",
                    "tool": tool_name,
                    "arguments": {
                        "type": args.get("type"),
                        "filename": args.get("filename"),
                        "title": args.get("title"),
                    },
                }
            )
            try:
                result = await tool.execute(workspace, args)
            except Exception as exc:
                trace.append(
                    {
                        "step": len(trace) + 1,
                        "type": "tool_result",
                        "tool": tool_name,
                        "ok": False,
                        "result_summary": str(exc)[:200],
                    }
                )
                self._node_degraded(trace, "draft", f"{tool_name} failed: {exc}")
                return None
            self._tool_calls += 1
            trace.append(
                {
                    "step": len(trace) + 1,
                    "type": "tool_result",
                    "tool": tool_name,
                    "ok": result.ok,
                    "result_summary": result.summary,
                }
            )
        self._node_completed(trace, "draft", deliverables=3)
        statuses: dict[str, int] = {}
        for course in assessment.courses:
            statuses[course.status] = statuses.get(course.status, 0) + 1
        breakdown = ", ".join(f"{count} {status}" for status, count in sorted(statuses.items()))
        summary = (
            "Rendered the approval note, spreadsheet and deck from the assessment "
            f"({breakdown}). Retirement thickness {min_t} mm; alert threshold {alert_t} mm."
        )
        self._node_outputs.append(summary)
        return summary

    # -- resource reservation -------------------------------------------------

    async def _ensure_reservation(self, job, model, requirements, trace=None):
        """Reserve ``model`` for this job, holding across same-model nodes.

        A single worker runs one job at a time, so the hold is released before
        requesting a different model — never reserved/released per node, which
        would thrash weights when capabilities map to distinct models. On a
        genuine switch, the outgoing model is also force-unloaded (bounded,
        best-effort) rather than left to Ollama's idle timer, so the VRAM it
        held is actually free before the new reservation is requested.
        """
        if self._scheduler is None or self._held_model == model:
            return
        if self._held_model is not None:
            old_model = self._held_model
            await self._scheduler.release(job.job_id)
            self._held_model = None
            if self._ollama is not None:
                try:
                    left_vram = await self._ollama.unload_and_wait(
                        old_model, timeout=self._unload_wait_seconds
                    )
                except Exception:
                    left_vram = False
                if not left_vram:
                    logger.warning(
                        "model_unload_incomplete",
                        extra={
                            "event": "model_unloaded",
                            "job_id": job.job_id,
                            "model": old_model,
                            "ok": False,
                        },
                    )
                if trace is not None:
                    trace.append(
                        {
                            "step": len(trace) + 1,
                            "type": "model_unloaded",
                            "model": old_model,
                            "ok": left_vram,
                        }
                    )
        while True:
            decision = await self._scheduler.request(
                job.job_id, job.user_id, model, requirements
            )
            if decision.decision == "grant":
                self._held_model = model
                return
            if decision.decision == "reject":
                raise NodeInfrastructureError(f"resource_rejected: {decision.reason}")
            if self._is_cancelled is not None and await self._is_cancelled(job.job_id):
                raise NodeCancelledError()
            await self._scheduler.wait_until_available(timeout=1.0)

    async def _release_reservation(self, job):
        if self._scheduler is None or self._held_model is None:
            return
        self._held_model = None
        try:
            await self._scheduler.release(job.job_id)
        except Exception:
            logger.exception(
                "node_resource_release_error",
                extra={"event": "resource_released", "job_id": job.job_id},
            )

    # -- trace helpers --------------------------------------------------------

    def _node_started(self, trace, key, model, confidence, runner_up):
        trace.append({
            "step": len(trace) + 1, "type": "node_started", "node": key,
            "capability": NODE_CAPABILITY.get(key, ""), "model": model,
            "confidence": confidence, "runner_up": runner_up,
        })

    def _node_completed(self, trace, key, **fields):
        trace.append({"step": len(trace) + 1, "type": "node_completed", "node": key, **fields})

    def _node_skipped(self, trace, key, reason):
        trace.append({"step": len(trace) + 1, "type": "node_skipped", "node": key, "reason": reason})

    def _node_degraded(self, trace, key, reason, **fields):
        trace.append({"step": len(trace) + 1, "type": "node_degraded", "node": key, "reason": reason, **fields})

    _skip = _node_skipped

    async def _record(self, job_id, trace, stage, cursor, tool_calls=0):
        recorder = getattr(self._agent, "record_trace", None)
        if recorder is not None:
            try:
                await recorder(job_id, trace, stage, cursor, tool_calls)
            except Exception:
                logger.exception("node_trace_error", extra={"event": "node_failed", "job_id": job_id})
