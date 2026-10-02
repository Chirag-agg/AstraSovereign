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
from app.services.ollama_service import OllamaServiceError
from app.services.plan import (
    DELIVERABLE_EXCEL,
    DELIVERABLE_SLIDES,
    DELIVERABLE_WORD,
    JobPlan,
)
from app.services.plan_defaults import resolve

logger = logging.getLogger("app.nodes")

# Capability each node asks the router for at entry. ``extract`` needs a
# tool-capable text model to orchestrate reads; the vision model is invoked by
# the ``document_vision`` tool, not as the node's own model.
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
        "pid_diagram_qa",
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
        "recall_work",
        "list_files",
        "read_file",
        "write_file",
    },
}

# Nodes that receive the structured attachment manifest (node input). Used by
# the static reachability check as a producer of e.g. ``document_id``.
NODE_INPUT_NODES = {"extract", "retrieve"}

# Every "what does this request actually ask for?" signal now lives in
# ``plan_defaults`` (the deterministic layer) and arrives here as a ``JobPlan``.
# See ``_plan_for`` — this module no longer matches request text itself.


def no_output_reason(trace: list[dict]) -> str:
    """Name the real reason the terminal node produced nothing.

    Derived from draft's own trace entry rather than assumed: the previous
    message blamed "the supplied documents" even for a job that never had one.
    """
    for entry in reversed(trace):
        if entry.get("node") != "draft":
            continue
        if entry.get("type") == "node_degraded":
            return f"the draft step degraded ({entry.get('reason') or 'no reason given'})"
        if entry.get("type") == "node_skipped":
            return f"the draft step was skipped ({entry.get('reason') or 'nothing to draft from'})"
    return "the run finished without producing output"


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


def _generator_already_succeeded(trace_segment: list[dict]) -> Optional[str]:
    """Return the tool name of the first generator that produced a successful
    result in this trace segment, or None if none has succeeded yet.

    A successful generator run is one where a ``tool_result`` entry with
    ``ok=True`` follows a ``tool_call`` entry for a generator tool.  We look
    for the *result* entry rather than the call entry so a call that errored
    does not count.
    """
    for entry in trace_segment:
        if (
            entry.get("type") == "tool_result"
            and entry.get("tool") in _CONTENT_GENERATOR_TOOLS
            and entry.get("ok") is True
        ):
            return entry["tool"]
    return None


def make_word_count_validator(min_words: int) -> Callable[[str, list[dict]], Optional[str]]:
    """A content_validator (see Agent.run) requiring at least min_words,
    counted from whichever channel actually carries the content: the plain
    chat response, or a generator tool's submitted content — whichever is
    longer, so "write 500 words and save it as a docx" isn't penalized for
    a short chat confirmation when the real 500 words are in the file, and
    a pure chat request with no deliverable is still checked on its own.

    When a generator tool has already been called successfully but the
    content is still short, the nudge explicitly tells the model to call
    the *same* tool again with expanded content — NOT to create a second
    file.  This prevents the duplicate-document bug where the model would
    interpret a generic "expand" nudge as permission to write a new file.
    """

    def validator(response: str, trace_segment: list[dict]) -> Optional[str]:
        response_words = len((response or "").split())
        content_words = _submitted_content_word_count(trace_segment)
        actual = max(response_words, content_words)
        if actual >= min_words:
            return None

        # If a generator already wrote a file, tell the model to expand that
        # exact file rather than creating a new one.
        succeeded_tool = _generator_already_succeeded(trace_segment)
        if succeeded_tool:
            return (
                f"The file was created but its content is too short: about {actual} words "
                f"against a minimum of {min_words}. Call {succeeded_tool} again with the "
                "SAME filename and SAME title, but with substantially more content — add more "
                "sections, subsections, and detail until the word count is met. "
                "Do NOT create a second file with a different name."
            )

        return (
            f"This falls well short of the requested length: about {actual} words "
            f"so far against a minimum of {min_words}. A short answer is not "
            "acceptable here. Substantially expand it with real detail across "
            "multiple paragraphs or sections until the length is met — do not "
            "pad with filler or repetition."
        )

    return validator


# A request that names a deliverable, with no assessment to render it from:
# which generator produces it, plus the file type and extension to use.
DELIVERABLE_RENDER = {
    DELIVERABLE_WORD: ("document_generation", "word", "docx"),
    DELIVERABLE_EXCEL: ("document_generation", "excel", "xlsx"),
    DELIVERABLE_SLIDES: ("presentation_generation", "pptx", "pptx"),
}

_SECTION_HEADING_RE = re.compile(r"^#{1,3}\s+(.+?)\s*$")

# "create a doc of..." / "can you please make me a..." — the instruction wrapper,
# dropped so the filename is the subject rather than the verb.
_LEADING_INSTRUCTION_RE = re.compile(
    r"^(?:please\s+|can you\s+|could you\s+|i(?:'d| would) like\s+)*"
    r"(?:create|write|make|build|compose|generate|prepare|draft|produce|design|give me)\b"
    r"(?:\s+(?:me|us)\b)?"
    r"[\s:,-]*",
    re.IGNORECASE,
)
_LEADING_ARTICLE_RE = re.compile(r"^(?:a|an|the)\b[\s-]*", re.IGNORECASE)
_NON_FILENAME_CHARS_RE = re.compile(r"[^a-z0-9]+")

# "a report on the corrosion" — the subject is worth more in a filename than the
# deliverable noun, so the clause a topic preposition introduces wins.
_TOPIC_RE = re.compile(r"\b(?:on|about|regarding|covering)\b[\s:]+(.+)$", re.IGNORECASE)
# ...unless the "subject" is a pronoun: "make a deck on it" must not become it.pptx.
_PRONOUN_TOPIC = {
    "it", "this", "that", "these", "those", "them", "me", "us", "him", "her",
    "which", "what", "something", "anything",
}

_FILENAME_STEM_WORDS = 7
_FILENAME_STEM_CHARS = 48


def deliverable_stem(message: str) -> str:
    """A filename stem that says what the file is.

    Every deterministic deliverable used to be written as ``document.<ext>``, so
    a deck and a report — from different requests, even different users — shared
    one name. In the outputs list and the browser's download folder they were
    indistinguishable, and a stale report was one click away from being mistaken
    for the deck just requested.

    The instruction wrapper is dropped and the subject preferred, so
    "create a pptx of 3 slides on Operating System" becomes
    ``operating-system.pptx`` rather than ``document.pptx``. Falls back to
    ``document`` when nothing usable survives.
    """
    text = (message or "").strip()
    text = _LEADING_INSTRUCTION_RE.sub("", text).strip()
    topic = _TOPIC_RE.search(text)
    if topic and topic.group(1).strip().lower() not in _PRONOUN_TOPIC:
        text = topic.group(1)
    text = _LEADING_ARTICLE_RE.sub("", text.strip()).strip()
    words = [word for word in _NON_FILENAME_CHARS_RE.split(text.lower()) if word]
    if words and words[0] in _PRONOUN_TOPIC:
        words = []
    stem = "-".join(words[:_FILENAME_STEM_WORDS])[:_FILENAME_STEM_CHARS].strip("-")
    return stem or "document"


def content_sections(text: str) -> list[dict]:
    """Turn model-written text into a generator's ``sections``.

    A ``## Heading`` line (``#`` or ``###`` work too) starts a section and the
    text between headings becomes its paragraphs. Text with no headings becomes
    one section, so nothing the model actually wrote is ever dropped.
    """
    sections: list[dict] = []
    heading: Optional[str] = None
    buffer: list[str] = []

    def flush() -> None:
        body = "\n".join(buffer).strip()
        paragraphs = [part.strip() for part in body.split("\n\n") if part.strip()]
        if heading or paragraphs:
            section: dict = {"heading": heading or "Document"}
            if paragraphs:
                section["paragraphs"] = paragraphs
            sections.append(section)

    for line in (text or "").splitlines():
        match = _SECTION_HEADING_RE.match(line)
        if match:
            flush()
            heading, buffer = match.group(1), []
        else:
            buffer.append(line)
    flush()
    return sections


def content_slides(sections: list[dict]) -> list[dict]:
    """Convert sections into a varied slide deck instead of uniform bullet lists.

    Heuristics applied per section (in priority order):

    1. **Markdown table** — any paragraph containing ``|``-separated columns
       with a separator row is rendered as a ``table`` slide.
    2. **Numeric data** — paragraphs containing ``Label: number`` or
       ``Label – number`` patterns with ≥ 3 data points become a ``chart``
       (bar) slide with the extracted series.
    3. **Process / step sequence** — headings or leading bullets that start
       with ``Step``, ``Stage``, ``Phase``, ``Part``, ``Chapter``, numbers
       followed by a period, or arrow/dash connectors produce a ``diagram``
       slide with one node per step (max 7).
    4. **Long prose** (paragraph > 120 words) → ``content`` slide so it does
       not get truncated by a bullet layout.
    5. **Two or more paragraphs** — if the section has ≥ 2 paragraph groups
       the first goes in column A and the rest in column B (``two-column``).
    6. **Default** — ``bullets`` slide, same as before.
    """
    # --- helpers -----------------------------------------------------------

    _NUM_PAIR_RE = re.compile(
        r"^(.+?)[\s:–\-]+([+\-]?\d[\d,. ]*%?)$", re.MULTILINE
    )
    _STEP_RE = re.compile(
        r"^(?:step|stage|phase|part|chapter|section)[\s\d.:)]+",
        re.IGNORECASE,
    )
    _ORDERED_RE = re.compile(r"^\d+[.)]\s+")
    _TABLE_ROW_RE = re.compile(r"\|")
    _TABLE_SEP_RE = re.compile(r"^\|?[\s\-:|]+\|")

    def _parse_table(paragraph: str) -> Optional[list[list[str]]]:
        """Parse a markdown table from a paragraph string, return rows or None."""
        lines = [ln for ln in paragraph.splitlines() if ln.strip()]
        if len(lines) < 2:
            return None
        # must have at least one | in first line and a separator line
        if not _TABLE_ROW_RE.search(lines[0]):
            return None
        sep_idx = None
        for idx, ln in enumerate(lines[1:], 1):
            if _TABLE_SEP_RE.match(ln.strip()):
                sep_idx = idx
                break
        if sep_idx is None:
            return None
        rows: list[list[str]] = []
        for ln in lines:
            if _TABLE_SEP_RE.match(ln.strip()):
                continue
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if cells:
                rows.append(cells)
        return rows if len(rows) >= 2 else None

    def _extract_numeric_pairs(paragraphs: list[str]) -> list[tuple[str, float]]:
        """Extract (label, value) pairs from bullet/paragraph text."""
        pairs: list[tuple[str, float]] = []
        for para in paragraphs:
            for m in _NUM_PAIR_RE.finditer(para):
                label = m.group(1).strip().rstrip(":")
                raw = m.group(2).replace(",", "").replace(" ", "").rstrip("%")
                try:
                    pairs.append((label[:60], float(raw)))
                except ValueError:
                    pass
        return pairs

    def _extract_steps(paragraphs: list[str]) -> list[str]:
        """Extract ordered step labels from paragraphs."""
        steps: list[str] = []
        for para in paragraphs:
            lines = para.splitlines()
            for line in lines:
                line = line.strip()
                if _STEP_RE.match(line) or _ORDERED_RE.match(line):
                    # strip the leading marker, keep label
                    label = _STEP_RE.sub("", line).strip()
                    label = _ORDERED_RE.sub("", label).strip()
                    if label:
                        steps.append(label[:80])
                if len(steps) >= 7:
                    break
            if len(steps) >= 7:
                break
        return steps

    # --- main loop ---------------------------------------------------------
    slides: list[dict] = []
    for section in sections:
        title = section.get("heading", "")
        paragraphs: list[str] = [p for p in section.get("paragraphs", []) if p.strip()]
        if not paragraphs:
            continue

        # 1. Markdown table
        table_rows: Optional[list[list[str]]] = None
        for para in paragraphs:
            table_rows = _parse_table(para)
            if table_rows:
                break
        if table_rows:
            slides.append({"type": "table", "title": title, "table": table_rows})
            continue

        # 2. Numeric data → bar chart
        pairs = _extract_numeric_pairs(paragraphs)
        if len(pairs) >= 3:
            categories = [p[0] for p in pairs[:12]]
            values = [p[1] for p in pairs[:12]]
            slides.append({
                "type": "chart",
                "title": title,
                "chart": {
                    "type": "bar",
                    "title": title,
                    "categories": categories,
                    "series": [{"name": title, "values": values}],
                    "show_values": True,
                },
            })
            continue

        # 3. Process / step sequence → diagram
        steps = _extract_steps(paragraphs)
        if len(steps) >= 2:
            slides.append({
                "type": "diagram",
                "title": title,
                "diagram": {
                    "layout": "row" if len(steps) <= 4 else "column",
                    "nodes": [{"label": s, "detail": ""} for s in steps],
                },
            })
            continue

        # 4. Long prose → content slide
        total_words = sum(len(p.split()) for p in paragraphs)
        if total_words > 120:
            slides.append({"type": "content", "title": title, "content": "\n\n".join(paragraphs)})
            continue

        # 5. Two or more paragraph groups → two-column
        if len(paragraphs) >= 2:
            col_a = paragraphs[0]
            col_b = "\n\n".join(paragraphs[1:])
            slides.append({
                "type": "two-column",
                "title": title,
                "columns": [col_a, col_b],
            })
            continue

        # 6. Default: bullets
        bullets = []
        for para in paragraphs:
            for line in para.splitlines():
                line = line.strip().lstrip("•-* ")
                if line:
                    bullets.append(line)
        if bullets:
            slides.append({"type": "bullets", "title": title, "bullets": bullets[:40]})
    return slides


# The one shape the constrained content call may return. Passing this as
# Ollama's ``format`` makes a tool call structurally unemittable, which is the
# point: the model writes the material, Python writes the file.
CONTENT_SCHEMA = {
    "type": "object",
    "properties": {"content": {"type": "string"}},
    "required": ["content"],
}

_CONTENT_SYSTEM = (
    "You are a technical writer producing the finished text of a document. "
    "Write the complete material the request asks for, in full, with nothing "
    "about what you would do instead."
)


def _content_from_json(raw: str) -> str:
    """The ``content`` string out of the constrained reply, or empty.

    A malformed or empty reply is not an exception here: the caller treats an
    empty result as "no content" and degrades visibly, the same way the
    classifier degrades rather than failing the job.
    """
    try:
        parsed = json.loads(raw or "")
    except (ValueError, TypeError):
        return ""
    if isinstance(parsed, dict) and isinstance(parsed.get("content"), str):
        return parsed["content"].strip()
    return ""


def _generator_succeeded(trace: list[dict], floor: int, tool_name: str) -> bool:
    """Whether this node's own run produced a real artifact from ``tool_name``.

    Only entries after ``floor`` count, so a generator call from an earlier node
    sharing the trace cannot stand in for one this run never made.
    """
    return any(
        entry.get("type") == "tool_result"
        and entry.get("tool") == tool_name
        and entry.get("ok") is True
        for entry in trace[floor:]
    )


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
        # The plan for the run in flight. Set by ``run`` (and by ``_plan_for``
        # when the caller supplied none) — the nodes read their activation and
        # tool contracts from it instead of matching request text themselves.
        self._job_plan: JobPlan = JobPlan()
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

    def _plan_for(self, job, task: str) -> JobPlan:
        """The deterministic plan, for callers that did not supply one.

        The worker builds the plan (it holds the classifier's label and, when
        enabled, the planner model). A directly-invoked node agent resolves the
        same object here, so node behaviour is identical either way.
        """
        return resolve(task, getattr(job, "task_type", "") or "")

    async def run(
        self,
        job,
        workspace,
        lead_model: str = "",
        task_text: Optional[str] = None,
        attachments: Optional[list[dict]] = None,
        job_plan: Optional[JobPlan] = None,
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
        self._job_plan = job_plan or self._plan_for(job, task)
        trace.append({"step": 1, **self._job_plan.to_trace()})
        if self._job_plan.disagreements:
            logger.info(
                "plan_disagreement",
                extra={
                    "event": "plan_disagreement",
                    "job_id": job.job_id,
                    "disagreements": self._job_plan.disagreements,
                },
            )
        # Attachments are a reason to run extraction even if the prompt does not
        # name a document (the nameplate image carries no indexable text) — but
        # they are not sufficient on their own. See ``JobPlan.needs_documents``.
        wants_docs = self._job_plan.needs_documents
        attempt_docs = bool(manifest) and wants_docs
        # extract is gated one step narrower than retrieve: its only possible
        # output is a typed tank-inspection ``FindingsObject``, so a request
        # that is about an attachment without asking for that assessment (a
        # converted image, a Q&A over a PDF) can only make it degrade, at the
        # cost of a full model turn. The attachment's extracted text still
        # reaches draft through the manifest block.
        attempt_findings = bool(manifest) and self._job_plan.needs_findings
        if not manifest:
            docs_skip_reason = "no documents or images referenced in the request"
        elif not wants_docs:
            docs_skip_reason = "attached documents are not referenced by this request"
        else:
            docs_skip_reason = ""
        if not manifest or not wants_docs:
            findings_skip_reason = docs_skip_reason
        else:
            findings_skip_reason = (
                "this request does not ask for an inspection assessment"
            )
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
                job, workspace, task, trace, cursor, attempt_findings, attachment_block,
                plan["document"], findings_skip_reason,
            )
            # --- retrieve ----------------------------------------------------
            cursor, retrieval = await self._run_retrieve(
                job, workspace, task, trace, cursor, attempt_docs, attachment_block,
                plan["document"], docs_skip_reason,
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
            # ``self._node_outputs``), for non-attachment jobs, and whenever an
            # attachment was supplied at all — the manifest is draft's only view
            # of the file (it has no document_vision), so a run where the
            # document nodes were skipped or degraded must still draft from it.
            something_to_draft = (
                bool(self._node_outputs) or not attempt_docs or bool(attachment_block)
            )
            cursor, response = await self._run_draft(
                job, workspace, task, trace, cursor, findings, assessment,
                something_to_draft, plan["general"], working=compute_response,
                attachment_block=attachment_block,
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
                response=f"No deliverable was produced: {no_output_reason(trace)}.",
                iterations=cursor,
            )
        return AgentResult(status=AgentStatus.COMPLETED, response=response, iterations=cursor)

    async def _run_extract(
        self, job, workspace, task, trace, cursor, attempt_findings, attachment_block,
        planned, skip_reason="",
    ):
        if not attempt_findings:
            self._skip(
                trace, "extract",
                skip_reason or "no documents or images referenced in the request",
            )
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
            # A run that failed outright (a generation limit, a model that never
            # settled) says so in its own error; reporting the missing tool call
            # instead would name a symptom of the failure as if it were the
            # cause. Only a *completed* run's outcome is really "not called".
            if result.status != AgentStatus.COMPLETED and result.error:
                reason = result.error
            else:
                reason = (
                    "submit_findings was rejected by schema validation"
                    if submit_called
                    else "submit_findings was not called"
                )
            self._node_degraded(
                trace,
                "extract",
                reason,
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
        self, job, workspace, task, trace, cursor, attempt_docs, attachment_block,
        planned, skip_reason="",
    ):
        if not attempt_docs:
            self._skip(
                trace, "retrieve",
                skip_reason or "no knowledge base documents referenced",
            )
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
        # ``needs_code`` is the classifier's ``coding`` label OR the coding
        # backstop, i.e. exactly the condition this node used to compute inline.
        computational = self._job_plan.needs_code
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
        planned, working=None, attachment_block="",
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
        # Retrieved context for the content phase; the assessment path carries
        # its payload inside the instruction instead, so this stays None there.
        context: Optional[str] = None
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
        else:
            # draft has no document_vision, so the manifest block is its only
            # view of an attached file's content — and the only thing carrying
            # it when the document nodes were skipped because the request is
            # about the attachment without being an assessment (an image being
            # converted). The assessment branch above never includes it: there
            # the typed object is the grounding, per compute's "do not read raw
            # scanned text" rule.
            context_parts = []
            if attachment_block:
                context_parts.append(attachment_block)
            if self._node_outputs:
                context_parts.append("\n\n".join(self._node_outputs))
            context = "\n\n".join(context_parts) or None
            if self._node_outputs:
                node_task = (
                    "Answer the request using the results below; cite sources and do not "
                    f"invent content.\nRESULTS:\n{context}\n\nREQUEST:\n{task}"
                )
            elif attachment_block:
                node_task = f"{attachment_block}\n\nREQUEST:\n{task}"
            else:
                # Degenerate path: a plain prompt passes through (nearly)
                # unmodified, so chat does not get wordier just because it ran
                # through the engine.
                node_task = task
            # A request that names a deliverable gets one line naming the
            # generator, rather than discovering the requirement only through
            # the nudge after a wasted turn.
            generator = self._job_plan.required_tool_success()
            if generator:
                gen_tool = sorted(generator)[0]
                node_task = (
                    f"{node_task}\n\nProduce the requested file by calling "
                    f"{gen_tool} with the full content in its sections "
                    "(or slides) — prose alone is not the deliverable."
                )
                if gen_tool == "presentation_generation":
                    node_task += (
                        " Vary the slide types so it reads as a designed presentation, not a document. "
                        "Use 'diagram' for processes, 'table' for structured fields, 'two-column' to "
                        "contrast, and 'chart' for numbers. Do not rely entirely on 'bullets' and 'content'."
                    )
        # Only the no-assessment paths reach the model with both generator
        # tools in scope and no gate on which one gets called (the assessment
        # path above is either fully deterministic via _render_assessment, or
        # its own instruction text already names presentation_generation
        # explicitly). Require the generator the request actually named, so a
        # model that defaults to Word anyway cannot finish without producing the
        # requested file. The plan resolved that from the ORIGINAL request text
        # (before draft wrapped it with retrieved context), and it already
        # applies the coding guard — "write a script that emits a document" is a
        # coding request that merely mentions a document.
        require_success = self._job_plan.required_tool_success() or None
        content_validator = None
        # Same reasoning as the deck gate: only the no-assessment paths lack a
        # structural length check (the assessment path renders deterministically
        # or already writes full content from typed data, not free-text word
        # count). A bare "write 1000 words" has no deliverable but still has a
        # length, so this is not tied to the deliverable.
        if self._job_plan.word_count:
            content_validator = make_word_count_validator(self._job_plan.word_count)
        # The default require_tool_success nudge is written for a numeric check
        # ("no number may appear"), which is nonsense for a document generator.
        # Name the tool's real contract instead.
        generator_nudge = None
        if require_success and require_success & _CONTENT_GENERATOR_TOOLS:
            names = ", ".join(sorted(require_success))
            generator_nudge = (
                f"You have not produced the requested deliverable. Prose is not a "
                f"deliverable: the file must actually be created by calling {names}. "
                f"Call {names} now, following its argument schema — a filename with the "
                "right extension, a title, and sections (or slides) holding the complete "
                "content. Do not refuse and do not answer with prose alone."
            )
        await self._ensure_reservation(job, model, route.requirements, trace=trace)
        floor = len(trace)
        result = await self._agent.run(
            job, model=model, workspace=workspace, trace=trace,
            task_text=node_task,
            max_iterations=self._budgets["draft"], max_tool_calls=10,
            append_start=False, enforce_contracts=False, tool_names=NODE_TOOLS["draft"],
            require_tool_success=require_success,
            require_tool_success_nudge=generator_nudge,
            content_validator=content_validator,
        )
        if _is_infrastructure_failure(result):
            raise NodeInfrastructureError(result.error or "infrastructure failure")
        self._tool_calls += result.tool_calls
        if result.status == AgentStatus.CANCELLED:
            raise NodeCancelledError()
        cursor += result.iterations
        # A deliverable the model never actually produced: build it in Python
        # from whatever the model wrote. This is the original bug — gpt-oss:20b
        # answers "create a doc of 1000 words" in prose, makes zero tool calls,
        # and the job ends with no deliverable after burning the whole budget.
        # A tool call is still preferred when the model makes one, because the
        # model picks a meaningful filename and title; Python is the backstop.
        render = DELIVERABLE_RENDER.get(self._job_plan.deliverable)
        if (
            render is not None
            and self._tools is not None
            and self._tools.get(render[0]) is not None
            and not _generator_succeeded(trace, floor, render[0])
        ):
            extra, rendered = await self._render_deliverable(
                job, workspace, trace, task, model, route, result, context
            )
            cursor += extra
            if rendered is None:
                self._node_degraded(
                    trace, "draft",
                    "the requested deliverable could not be produced from the model's output",
                    iterations=result.iterations, tool_calls=result.tool_calls,
                )
                return cursor, None
            self._node_completed(
                trace, "draft",
                iterations=result.iterations, tool_calls=result.tool_calls,
            )
            return cursor, rendered
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

    async def _render_deliverable(
        self, job, workspace, trace, task, model, route, result, context
    ):
        """Build the requested file in Python from what the model produced.

        The model had its chance to call the generator and did not. It may still
        have written the material as prose (a normal ``final`` answer), in which
        case that text is what gets rendered. If the run ended without any
        usable text — the observed failure: the budget ran out mid-loop — one
        tool-free pass asks for the material on its own, where the model is
        being asked to write rather than to tool-call.

        Returns ``(extra_iterations, response_or_None)``.
        """
        extra = 0
        content = (result.response or "").strip()
        if result.status != AgentStatus.COMPLETED or not content:
            content, extra = await self._content_from_model(
                job, workspace, trace, task, model, route, context
            )
            if not content:
                return extra, None
        rendered = await self._render_content(job, workspace, trace, content)
        return extra, rendered

    async def _content_from_model(self, job, workspace, trace, task, model, route, context):
        """One constrained completion: the model writes the material, nothing else.

        The agent loop is deliberately bypassed here. gpt-oss:20b emits native
        calls to a builtin ``container.exec`` tool this app does not have, so
        inside the loop it never settles on a final answer — it spends the whole
        iteration budget and returns nothing, which is the original bug. A JSON
        Schema passed as ``format`` constrains decoding to a ``{"content": ...}``
        object, making a tool call structurally impossible to emit; measured
        1381 words with '## ' headings for this exact request, first try.

        Returns ``(content_or_None, iterations_used)``. This never consumes the
        agent's loop budget, so the second element is always 0.
        """
        if self._ollama is None:
            return None, 0
        await self._ensure_reservation(job, model, route.requirements, trace=trace)
        set_job_context(job_id=job.job_id, user_id=job.user_id, task_type=job.task_type)
        messages = [
            {"role": "system", "content": _CONTENT_SYSTEM},
            {"role": "user", "content": self._content_instruction(task, context)},
        ]
        try:
            raw, _calls, _used = await self._ollama.chat(
                messages, model=model, format=CONTENT_SCHEMA
            )
        except OllamaServiceError as exc:
            raise NodeInfrastructureError(
                f"{exc.__class__.__name__}: {exc}"
            ) from exc
        content = _content_from_json(raw)
        if content:
            trace.append(
                {
                    "step": len(trace) + 1,
                    "type": "content_generated",
                    "model": model,
                    "words": len(content.split()),
                }
            )
        return content, 0

    def _content_instruction(self, task: str, context: Optional[str]) -> str:
        words = self._job_plan.word_count
        length = (
            f"Write at least {words} words. "
            if words
            else "Write a thorough, well-developed answer. "
        )
        grounded = (
            f"\n\nUse only the material below; do not invent facts.\nRESULTS:\n{context}"
            if context
            else ""
        )
        return (
            f"REQUEST:\n{task}{grounded}\n\n"
            "Write the complete content of the requested document now. "
            "Start each section with a line of the form '## Heading'. Do not "
            "describe what you would write and do not ask questions — write the "
            f"finished material. {length}"
        )

    async def _render_content(self, job, workspace, trace, content):
        """Call the planned generator with sections parsed from ``content``.

        Returns the response to report, or ``None`` if the generator failed.
        """
        tool_name, doc_type, extension = DELIVERABLE_RENDER[self._job_plan.deliverable]
        tool = self._tools.get(tool_name)
        sections = content_sections(content)
        title = (job.message or "Document").strip()[:120]
        filename = f"{deliverable_stem(job.message)}.{extension}"
        if self._job_plan.deliverable == DELIVERABLE_SLIDES:
            args = {
                "type": "pptx",
                "filename": filename,
                "title": title,
                "slides": content_slides(sections),
            }
        else:
            args = {
                "type": doc_type,
                "filename": filename,
                "title": title,
                "document_type": "document",
                "sections": sections,
            }
        set_job_context(job_id=job.job_id, user_id=job.user_id, task_type=job.task_type)
        trace.append(
            {
                "step": len(trace) + 1,
                "type": "tool_call",
                "tool": tool_name,
                "arguments": {"type": args.get("type"), "filename": filename, "title": title},
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
            logger.warning(
                "draft_render_failed",
                extra={"event": "draft_render_failed", "job_id": job.job_id, "error": str(exc)},
            )
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
        if not result.ok:
            return None
        return result.summary or content

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
