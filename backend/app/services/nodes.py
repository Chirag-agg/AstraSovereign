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

import json
import logging
import re
from typing import Any, Optional

from app.schemas.findings import AssessmentResult, FindingsObject
from app.services.agent import AgentResult, AgentStatus
from app.services.attachments import render_attachment_block
from app.services.capability_router import CapabilityRouter, CapabilityRoutingError
from app.services.findings import (
    REASON_INCOMPLETE,
    assess,
    degraded_result,
    minimal_thickness_mm,
    traceability_violations,
)

logger = logging.getLogger("app.nodes")

_DOC_RE = re.compile(
    r"\b(document|documents|report|reports|sop|procedure|manual|pdf|attachment|"
    r"uploaded|scanned|inspection|drawing|pid|nameplate)\b",
    re.IGNORECASE,
)

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
    "extract": {"document_search", "document_vision", "read_file", "list_files"},
    "retrieve": {"document_search"},
    "compute": {"code_execution"},
    "draft": {"document_generation", "presentation_generation"},
}

# Nodes that receive the structured attachment manifest (node input). Used by
# the static reachability check as a producer of e.g. ``document_id``.
NODE_INPUT_NODES = {"extract", "retrieve"}


def _mentions_documents(task: str) -> bool:
    return bool(_DOC_RE.search(task or ""))


def _extract_findings(text: Optional[str]) -> Optional[FindingsObject]:
    if not text:
        return None
    candidate = text.strip()
    try:
        data = json.loads(candidate)
    except (ValueError, json.JSONDecodeError):
        match = re.search(r"\{.*\}", candidate, flags=re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except (ValueError, json.JSONDecodeError):
            return None
    try:
        return FindingsObject.model_validate(data)
    except Exception:
        return None


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
    ) -> None:
        self._agent = agent
        self._router = capability_router
        self._registry = registry
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

    def _route(self, capability: str) -> tuple[str, float, str]:
        """Model, confidence and runner-up for a capability (recorded per node)."""
        capability = NODE_CAPABILITY.get(capability, capability)
        result = self._router.resolve(capability)
        model = result.model
        if self._registry is None:
            return model, 0.6, ""
        declared = [entry.model for entry in self._registry.by_capability(capability)]
        if model in declared:
            others = [candidate for candidate in declared if candidate != model]
            return model, 1.0, (others[0] if others else "")
        general = self._registry.get("general")
        runner_up = general.model if general is not None and general.model != model else ""
        return model, 0.6, runner_up

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
        findings: Optional[FindingsObject] = None
        assessment: Optional[AssessmentResult] = None
        manifest = list(attachments or [])
        self.last_attachments = manifest
        attachment_block = render_attachment_block(manifest)
        # Attachments are a reason to run extraction even if the prompt does not
        # name a document (the nameplate image carries no indexable text).
        attempt_docs = bool(manifest) or _mentions_documents(task)
        cursor = 0

        # --- extract ---------------------------------------------------------
        cursor, findings = await self._run_extract(
            job, workspace, task, trace, cursor, attempt_docs, attachment_block
        )
        # --- retrieve --------------------------------------------------------
        cursor, retrieval = await self._run_retrieve(
            job, workspace, task, trace, cursor, attempt_docs, attachment_block
        )
        self.last_retrieval = retrieval
        # --- compute ---------------------------------------------------------
        cursor, assessment, degraded = await self._run_compute(
            job, workspace, task, trace, cursor, findings, retrieval
        )
        self.last_findings = findings
        self.last_assessment = assessment
        # --- draft -----------------------------------------------------------
        something_to_draft = assessment is not None or not attempt_docs
        cursor, response = await self._run_draft(
            job, workspace, task, trace, cursor, findings, assessment, something_to_draft
        )

        await self._record(job.job_id, trace, "completed", cursor)
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
        self, job, workspace, task, trace, cursor, attempt_docs, attachment_block
    ):
        if not attempt_docs:
            self._skip(trace, "extract", "no documents or images referenced in the request")
            return cursor, None
        model, confidence, runner_up = self._route("extract")
        self._node_started(trace, "extract", model, confidence, runner_up)
        instruction = (
            "Extract a single JSON findings object from the attached documents/images. "
            "First call document_search to obtain the document_id, then call document_vision "
            "with {document_id, question} to read each scanned page and the nameplate; do not "
            "answer from memory. Cite document_id/page. "
            'Output STRICT JSON: {"tank":"","procedure":"","geometry":{"diameter_m":null,'
            '"fill_height_m":null,"specific_gravity":null,"allowable_stress_mpa":null,'
            '"joint_efficiency":null},"readings":[{"course":"","value_mm":0.0,'
            '"survey_date":"YYYY-MM-DD","source":""}]}. Include every reading with its survey date.'
        )
        start = len(trace)
        parts = [instruction]
        if attachment_block:
            parts.append(attachment_block)
        parts.append(f"REQUEST:\n{task}")
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text="\n\n".join(parts),
            max_iterations=self._budgets["extract"], max_tool_calls=8,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["extract"],
        )
        cursor += result.iterations
        invoked = [
            entry.get("tool")
            for entry in trace[start:]
            if entry.get("type") == "tool_call"
        ]
        findings = _extract_findings(result.response)
        if not invoked:
            self._node_degraded(trace, "extract", "no document tool was invoked")
            return cursor, None
        if findings is None or not findings.readings:
            self._node_degraded(trace, "extract", "no typed findings were produced")
            return cursor, None
        self._node_completed(trace, "extract", readings=len(findings.readings))
        return cursor, findings

    async def _run_retrieve(
        self, job, workspace, task, trace, cursor, attempt_docs, attachment_block
    ):
        if not attempt_docs:
            self._skip(trace, "retrieve", "no knowledge base documents referenced")
            return cursor, ""
        model, confidence, runner_up = self._route("retrieve")
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
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text="\n\n".join(parts),
            max_iterations=self._budgets["retrieve"], max_tool_calls=4,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["retrieve"],
        )
        cursor += result.iterations
        searched = any(
            entry.get("type") == "tool_call" and entry.get("tool") == "document_search"
            for entry in trace[start:]
        )
        if not searched:
            self._node_degraded(trace, "retrieve", "document_search was not invoked")
            return cursor, ""
        self._node_completed(trace, "retrieve", ok=result.status == AgentStatus.COMPLETED)
        return cursor, result.response or ""

    async def _run_compute(self, job, workspace, task, trace, cursor, findings, retrieval):
        if findings is None or not findings.readings:
            self._skip(trace, "compute", "no typed findings to compute from")
            return cursor, None, False
        min_thickness = minimal_thickness_mm(findings)
        alert = round(min_thickness + 1.0, 2) if min_thickness is not None else None
        model, confidence, runner_up = self._route("compute")
        self._node_started(trace, "compute", model, confidence, runner_up)
        instruction = (
            "Compute corrosion rate = (previous - current)/years, remaining life = "
            "(current - t_min)/rate, next interval = lesser of remaining life/2 and 15 years. "
            "Run the calculation with code_execution and show the steps. Use ONLY the typed "
            "findings below; do not read raw scanned text.\n"
            f"FINDINGS: {findings.model_dump_json()}"
        )
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text=f"{instruction}\n\nREQUEST:\n{task}",
            max_iterations=self._budgets["compute"], max_tool_calls=6,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["compute"],
        )
        cursor += result.iterations
        assessment = assess(findings, min_thickness, alert)
        degraded = result.status != AgentStatus.COMPLETED
        if degraded:
            assessment = degraded_result(findings, min_thickness, alert)
            self._node_degraded(trace, "compute", "iteration budget exhausted")
        violations = traceability_violations(findings, assessment)
        if violations:
            self._node_degraded(trace, "compute", f"untraceable courses: {', '.join(violations)}")
            assessment = degraded_result(findings, min_thickness, alert)
        self._node_completed(trace, "compute", courses=len(assessment.courses))
        return cursor, assessment, degraded

    async def _run_draft(self, job, workspace, task, trace, cursor, findings, assessment, something_to_draft):
        if not something_to_draft:
            self._skip(trace, "draft", "nothing grounded to draft from")
            return cursor, None
        model, confidence, runner_up = self._route("draft")
        self._node_started(trace, "draft", model, confidence, runner_up)
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
        else:
            instruction = "Answer the request directly as the final deliverable."
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text=f"{instruction}\n\nREQUEST:\n{task}",
            max_iterations=self._budgets["draft"], max_tool_calls=10,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["draft"],
        )
        cursor += result.iterations
        if result.status != AgentStatus.COMPLETED:
            self._node_degraded(trace, "draft", result.error or "draft did not complete")
            return cursor, None
        self._node_completed(trace, "draft")
        return cursor, result.response

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

    def _node_degraded(self, trace, key, reason):
        trace.append({"step": len(trace) + 1, "type": "node_degraded", "node": key, "reason": reason})

    _skip = _node_skipped

    async def _record(self, job_id, trace, stage, cursor):
        recorder = getattr(self._agent, "record_trace", None)
        if recorder is not None:
            try:
                await recorder(job_id, trace, stage, cursor, 0)
            except Exception:
                logger.exception("node_trace_error", extra={"event": "node_failed", "job_id": job_id})
