"""Node sequence: per-node routing records, recorded skips, typed handoff, degrade."""

import asyncio
import json

from app.services.agent import AgentResult, AgentStatus
from app.services.capability_router import CapabilityRouter
from app.services.nodes import (
    CONTENT_SCHEMA,
    NodeAgent,
    _content_from_json,
    content_sections,
    content_slides,
    deliverable_stem,
    make_word_count_validator,
    no_output_reason,
)
from app.services.tools import ToolResult
from tests.conftest import build_registry

MODELS = {
    "general": {"provider": "ollama", "model": "general-model", "enabled": True, "capabilities": ["general", "reasoning"]},
    "document": {"provider": "ollama", "model": "doc-model", "enabled": True, "capabilities": ["document", "summarization"]},
    "coding": {"provider": "ollama", "model": "coder-model", "enabled": True, "capabilities": ["coding", "debugging"]},
    "vision": {"provider": "ollama", "model": "vision-model", "enabled": True, "capabilities": ["vision", "image"]},
}

FINDINGS = {
    "tank": "TANK-204",
    "procedure": "SOP-09 Rev 3",
    "geometry": {
        "diameter_m": 25.0,
        "fill_height_m": 13.0,
        "specific_gravity": 0.85,
        "allowable_stress_mpa": 137.0,
        "joint_efficiency": 0.85,
    },
    "readings": [
        {"course": "C2", "value_mm": 11.9, "survey_date": "2021-06-02", "source": "r2021"},
        {"course": "C2", "value_mm": 10.9, "survey_date": "2026-08-15", "source": "r2026"},
        {"course": "C5", "value_mm": 11.6, "survey_date": "2026-08-15", "source": "r2026"},
    ],
}


class FakeJob:
    job_id = "job-nodes"
    user_id = "user-001"
    task_type = "document"
    message = "Assess Tank 204 using the inspection reports and our SOP."


class FakeTool:
    def __init__(self, name):
        self.name = name
        self.calls = []

    async def execute(self, workspace, arguments):
        self.calls.append(arguments)
        return ToolResult(ok=True, summary=f"{self.name} ok")


class FakeTools:
    def __init__(self):
        self.document_generation = FakeTool("document_generation")
        self.presentation_generation = FakeTool("presentation_generation")

    def get(self, name):
        return getattr(self, name, None)


ATTACHMENTS = [
    {
        "doc_id": "doc-report",
        "filename": "inspection_report_2026.pdf",
        "media_type": "application/pdf",
        "kind": "scanned_pdf",
        "pages": 4,
    }
]


class FakeAgent:
    def __init__(self, results):
        self.results = list(results)
        self.calls = []
    async def run(self, job, **kwargs):
        self.calls.append(kwargs)
        task = kwargs.get("task_text", "")
        trace = kwargs.get("trace")
        if trace is not None:
            # simulate the tool use each node must perform
            if "submit_findings" in task:
                # extract's typed output is the submit_findings tool call
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_call", "tool": "submit_findings", "arguments": FINDINGS}
                )
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_result", "tool": "submit_findings", "ok": True}
                )
            elif "document_vision" in task:
                trace.append({"step": len(trace) + 1, "type": "tool_call", "tool": "document_vision"})
            elif "document_search" in task:
                trace.append({"step": len(trace) + 1, "type": "tool_call", "tool": "document_search"})
            elif "code_execution" in task:
                # simulate compute's require_tool_success contract: a real,
                # successful sandbox call backs the node's numeric answer.
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_call", "tool": "code_execution"}
                )
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_result", "tool": "code_execution", "ok": True}
                )
        if not self.results:
            return AgentResult(status=AgentStatus.COMPLETED, response="done", iterations=1)
        return self.results.pop(0)

    async def record_trace(self, *args, **kwargs):
        return None


class _ToolCallingAgent:
    """Wraps a FakeAgent so its run looks like the model actually called
    ``tool_name`` and got an artifact back."""

    def __init__(self, inner, tool_name):
        self._inner = inner
        self._tool_name = tool_name

    @property
    def calls(self):
        return self._inner.calls

    async def run(self, job, **kwargs):
        trace = kwargs.get("trace")
        if trace is not None:
            trace.append({"step": len(trace) + 1, "type": "tool_call", "tool": self._tool_name})
            trace.append(
                {"step": len(trace) + 1, "type": "tool_result", "tool": self._tool_name, "ok": True}
            )
        return await self._inner.run(job, **kwargs)

    async def record_trace(self, *args, **kwargs):
        return None


def make_agent(results, ollama_service=None, scheduler=None, tools=None):
    return NodeAgent(
        agent=FakeAgent(results),
        capability_router=CapabilityRouter(build_registry(MODELS)),
        registry=build_registry(MODELS),
        ollama_service=ollama_service,
        scheduler=scheduler,
        tools=tools,
    )


class SpyOllamaService:
    """Records unload_and_wait calls without touching a real Ollama."""

    def __init__(self, fail_on=()):
        self.unload_calls: list[str] = []
        self._fail_on = set(fail_on)

    async def unload_and_wait(self, model, timeout=2.0):
        self.unload_calls.append(model)
        if model in self._fail_on:
            raise RuntimeError("simulated unload failure")
        return True


class FakeOllama:
    """Records the constrained content completion and returns a scripted reply.

    No tools are available on this path, which is the point under test: the
    reply is forced into ``{"content": ...}`` so a tool call cannot be emitted.
    """

    def __init__(self, content="## Overview\n\nMerge sort divides the list."):
        self.calls: list[dict] = []
        self._raw = json.dumps({"content": content})

    async def chat(self, messages, model=None, tools=None, format=None, think=None):
        self.calls.append(
            {"messages": messages, "model": model, "tools": tools, "format": format}
        )
        return self._raw, [], model or "general-model"

    async def unload_and_wait(self, model, timeout=2.0):
        return True


class AlwaysGrantScheduler:
    """Minimal scheduler test double: every request is granted immediately,
    so _ensure_reservation's model-switch/unload branch actually runs."""

    async def request(self, job_id, user_id, model, requirements):
        from app.services.resource_scheduler import GRANT, SchedulerDecision

        return SchedulerDecision(decision=GRANT)

    async def release(self, job_id):
        return None

    async def wait_until_available(self, timeout=1.0):
        return None


def _capture(node_agent):
    recorded = {}

    async def capture(job_id, trace, stage, iterations, tool_calls):
        recorded["trace"] = trace

    node_agent._agent.record_trace = capture
    return recorded


def fake_job(task_type, message):
    """A FakeJob carrying a specific classified label and message."""
    return type("_Job", (FakeJob,), {"task_type": task_type, "message": message})()


def _draft_call(node_agent):
    """The recorded Agent.run kwargs for the draft node, which is the only node
    with both generator tools in scope. Needed when an earlier node also runs."""
    return next(
        call
        for call in node_agent._agent.calls
        if "document_generation" in (call.get("tool_names") or ())
    )


def test_greeting_with_attachments_skips_the_document_nodes():
    """Reported bug: with a document attached to the session, "hi" still ran
    extract+retrieve — and retrieve's instruction *demands* a document_search.
    Attachments are a permission to run the document nodes, not an obligation."""
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="hello", iterations=1)]
    )
    recorded = _capture(node_agent)
    result = asyncio.run(
        node_agent.run(
            fake_job("general", "hi"), "/workspace", task_text="hi", attachments=ATTACHMENTS
        )
    )

    assert result.response == "hello"
    trace = recorded["trace"]
    skipped = {entry["node"]: entry["reason"] for entry in trace if entry["type"] == "node_skipped"}
    assert set(skipped) == {"extract", "retrieve", "compute"}
    assert "attached" in skipped["extract"]  # distinguishable from "nothing attached"
    assert "attached" in skipped["retrieve"]
    assert [entry["node"] for entry in trace if entry["type"] == "node_completed"] == ["draft"]
    assert node_agent.last_findings is None


def test_document_request_retrieves_even_when_the_classifier_says_general():
    """The same widening backstop compute has: a document request the ~88%
    classifier misses must not be silently stripped of extraction/retrieval."""
    node_agent = make_agent([])  # FakeAgent's default COMPLETED for every call
    recorded = _capture(node_agent)
    asyncio.run(
        node_agent.run(
            fake_job("general", "Summarize the attached vessel report."),
            "/workspace",
            task_text="Summarize the attached vessel report.",
            attachments=ATTACHMENTS,
        )
    )

    trace = recorded["trace"]
    started = {entry["node"] for entry in trace if entry["type"] == "node_started"}
    assert {"extract", "retrieve", "compute"} <= started


def test_unclassified_job_fails_open_on_attachments():
    """No classifier label means no opinion: attachments alone keep the old
    behaviour, so a job that skipped classification is never gated."""
    node_agent = make_agent([])
    recorded = _capture(node_agent)
    asyncio.run(
        node_agent.run(
            fake_job("", "hi"), "/workspace", task_text="hi", attachments=ATTACHMENTS
        )
    )

    started = {entry["node"] for entry in recorded["trace"] if entry["type"] == "node_started"}
    assert {"extract", "retrieve"} <= started


def test_image_conversion_skips_the_tank_extractor_and_feeds_draft():
    """Reported bug: "convert an image with tables into excel" ran the tank
    extractor, whose only possible output is a findings object it has no
    readings for. On a CPU-offloaded vision model it spent its whole budget
    there (~20 minutes) and then failed.

    The request is about the attachment but is not an assessment, so extract
    must not run — while retrieve still does, and draft (which has no
    document_vision) must receive the attachment's extracted text, because that
    is the only view of the image any node can give it."""
    node_agent = make_agent([])  # FakeAgent's default COMPLETED for every call
    recorded = _capture(node_agent)
    manifest = [
        {
            "doc_id": "doc-img1",
            "filename": "tables.png",
            "media_type": "image/png",
            "kind": "image",
            "pages": None,
            "content": "| Pump | Flow |\n| P-101 | 12 |",
        }
    ]
    asyncio.run(
        node_agent.run(
            fake_job("vision", "convert this image with tables into excel"),
            "/workspace",
            task_text="convert this image with tables into excel",
            attachments=manifest,
        )
    )

    trace = recorded["trace"]
    skipped = {entry["node"]: entry["reason"] for entry in trace if entry["type"] == "node_skipped"}
    assert "extract" in skipped
    assert "assessment" in skipped["extract"]
    started = {entry["node"] for entry in trace if entry["type"] == "node_started"}
    assert "retrieve" in started
    draft_call = _draft_call(node_agent)
    assert "P-101" in draft_call["task_text"]
    assert "document_generation" in draft_call["task_text"]


class _SilentOnFailureAgent(FakeAgent):
    """A model that emitted nothing called no tools, so the simulated tool use
    the FakeAgent fabricates for every node must not be fabricated for a turn
    that failed — otherwise extract would look like it had submitted findings."""

    async def run(self, job, **kwargs):
        self.calls.append(kwargs)
        result = (
            self.results.pop(0)
            if self.results
            else AgentResult(status=AgentStatus.COMPLETED, response="done", iterations=1)
        )
        trace = kwargs.get("trace")
        task = kwargs.get("task_text", "")
        if trace is not None and result.status == AgentStatus.COMPLETED:
            if "submit_findings" in task:
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_call", "tool": "submit_findings", "arguments": FINDINGS}
                )
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_result", "tool": "submit_findings", "ok": True}
                )
            elif "document_search" in task:
                trace.append({"step": len(trace) + 1, "type": "tool_call", "tool": "document_search"})
            elif "code_execution" in task:
                trace.append({"step": len(trace) + 1, "type": "tool_call", "tool": "code_execution"})
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_result", "tool": "code_execution", "ok": True}
                )
        return result


def test_a_generation_limit_degrades_the_node_instead_of_killing_the_job():
    """A model that emits nothing within its budget is a node-level outcome, not
    an infrastructure failure: the node degrades with the model's own reason and
    the rest of the pipeline still runs."""
    results = [
        AgentResult(
            status=AgentStatus.FAILED,
            response="",
            error="OllamaGenerationLimitError: Model 'vision-model' generated no output",
            iterations=1,
        ),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = NodeAgent(
        agent=_SilentOnFailureAgent(results),
        capability_router=CapabilityRouter(build_registry(MODELS)),
        registry=build_registry(MODELS),
    )
    recorded = _capture(node_agent)
    result = asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )

    assert result.status == AgentStatus.COMPLETED
    trace = recorded["trace"]
    degraded = {e["node"]: e["reason"] for e in trace if e["type"] == "node_degraded"}
    assert "OllamaGenerationLimitError" in degraded["extract"]
    assert [e["node"] for e in trace if e["type"] == "node_completed"] == ["retrieve", "draft"]


def test_an_assessment_request_still_runs_the_extractor():
    """The gate must not narrow the flagship tank-inspection flow."""
    node_agent = make_agent([])
    recorded = _capture(node_agent)
    asyncio.run(
        node_agent.run(
            fake_job("document", "Assess Tank 204 using the inspection reports and our SOP."),
            "/workspace",
            task_text="Assess Tank 204 using the inspection reports and our SOP.",
            attachments=ATTACHMENTS,
        )
    )

    started = {entry["node"] for entry in recorded["trace"] if entry["type"] == "node_started"}
    assert "extract" in started


def test_plain_chat_skips_heavy_nodes_and_drafts_only():
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="hello", iterations=1)]
    )
    recorded = _capture(node_agent)
    result = asyncio.run(node_agent.run(FakeJob(), "/workspace", task_text="say hi"))

    assert result.response == "hello"
    trace = recorded["trace"]
    skipped = {entry["node"]: entry["reason"] for entry in trace if entry["type"] == "node_skipped"}
    assert set(skipped) == {"extract", "retrieve", "compute"}
    assert all(reason for reason in skipped.values())
    assert [entry["node"] for entry in trace if entry["type"] == "node_completed"] == ["draft"]
    assert node_agent.last_findings is None
    assert node_agent.last_assessment is None


def test_sequence_routes_four_models_and_compute_sees_typed_object():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="SOP-09 Rev 3, p.3", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables built", iterations=1),
    ]
    node_agent = make_agent(results)
    recorded = _capture(node_agent)
    result = asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )

    trace = recorded["trace"]
    started = {entry["node"]: entry["model"] for entry in trace if entry["type"] == "node_started"}
    assert started == {
        "extract": "doc-model",
        "retrieve": "doc-model",
        "compute": "coder-model",
        "draft": "general-model",
    }
    assert all(
        "confidence" in entry and "runner_up" in entry
        for entry in trace
        if entry["type"] == "node_started"
    )
    assert result.response == "deliverables built"
    compute_task = node_agent._agent.calls[2]["task_text"]
    assert '"readings"' in compute_task  # typed object, not raw transcript
    assert node_agent.last_assessment is not None
    assert node_agent.last_assessment.courses


def test_model_switch_unloads_the_outgoing_model():
    """Every genuine capability switch (doc-model -> coder-model -> general-model)
    force-unloads the model just released; consecutive same-model nodes
    (extract -> retrieve, both doc-model) never do."""
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="SOP-09 Rev 3, p.3", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables built", iterations=1),
    ]
    ollama = SpyOllamaService()
    node_agent = make_agent(results, ollama_service=ollama, scheduler=AlwaysGrantScheduler())
    recorded = _capture(node_agent)
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )

    assert ollama.unload_calls == ["doc-model", "coder-model"]
    unload_entries = [e for e in recorded["trace"] if e["type"] == "model_unloaded"]
    assert [e["model"] for e in unload_entries] == ["doc-model", "coder-model"]
    assert all(e["ok"] for e in unload_entries)


def test_model_unload_failure_never_fails_the_job():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="SOP-09 Rev 3, p.3", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables built", iterations=1),
    ]
    ollama = SpyOllamaService(fail_on={"doc-model"})
    node_agent = make_agent(results, ollama_service=ollama, scheduler=AlwaysGrantScheduler())
    result = asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )

    assert result.status == AgentStatus.COMPLETED
    assert ollama.unload_calls == ["doc-model", "coder-model"]


def test_draft_requires_presentation_generation_when_a_deck_is_requested():
    """Reported bug: 'make me a PPT' still produced a .docx. draft's
    no-assessment path has both generator tools in scope with no gate on
    which one gets called, so a model that defaults to Word must now be
    forced back until it actually calls presentation_generation."""
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="deck made", iterations=1)]
    )
    result = asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text="Make me a PPT summarizing our Q3 sales")
    )

    assert result.status == AgentStatus.COMPLETED
    draft_call = node_agent._agent.calls[0]
    assert draft_call["require_tool_success"] == {"presentation_generation"}


def test_draft_does_not_require_presentation_generation_for_plain_requests():
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="hello", iterations=1)]
    )
    asyncio.run(node_agent.run(FakeJob(), "/workspace", task_text="say hi"))

    draft_call = node_agent._agent.calls[0]
    assert draft_call["require_tool_success"] is None


def test_draft_requires_the_requested_word_count():
    """Reported bug: asked for 500 words in the prompt and in a 500-word
    docx, got ~50 either way. draft's no-assessment path had no structural
    check on content length at all - purely prompt wording
    ("write at least that many words") with nothing behind it."""
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="done", iterations=1)]
    )
    asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="Write a 500 word essay on corrosion monitoring"
        )
    )

    draft_call = node_agent._agent.calls[0]
    validator = draft_call["content_validator"]
    assert validator is not None
    assert validator("way too short", []) is not None  # nudges back
    assert validator("word " * 500, []) is None  # satisfied


def test_draft_word_count_validator_also_counts_submitted_document_content():
    """"Write 500 words and save it as a docx" shouldn't be penalized for a
    short chat confirmation ("here's your file") when the real content is
    inside the document_generation call - whichever channel actually has
    the words should satisfy it."""
    node_agent = make_agent([])
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text="Write 500 words about Tank 204")
    )
    validator = node_agent._agent.calls[0]["content_validator"]

    short_chat_response = "Here is your document."
    trace_with_thin_doc = [
        {
            "type": "tool_call",
            "tool": "document_generation",
            "arguments": {"sections": [{"content": "too short"}]},
        }
    ]
    trace_with_full_doc = [
        {
            "type": "tool_call",
            "tool": "document_generation",
            "arguments": {"sections": [{"content": "word " * 500}]},
        }
    ]
    assert validator(short_chat_response, trace_with_thin_doc) is not None
    assert validator(short_chat_response, trace_with_full_doc) is None


def test_draft_does_not_require_a_word_count_when_none_was_requested():
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="hello", iterations=1)]
    )
    asyncio.run(node_agent.run(FakeJob(), "/workspace", task_text="What's the capital of France?"))

    draft_call = node_agent._agent.calls[0]
    assert draft_call["content_validator"] is None


def test_make_word_count_validator_reports_remaining_gap_in_the_nudge():
    validator = make_word_count_validator(500)
    nudge = validator("only a few words here", [])
    assert "500" in nudge
    assert "short" in nudge.lower()


def test_draft_requires_document_generation_when_a_file_is_requested():
    """Reported bug: "create a doc of 1000 words on merge sort" burned all 8
    draft iterations on the word-count nudge, made zero tool calls, and the job
    ended with no deliverable at all. draft's no-assessment path had both
    generator tools in scope and nothing requiring the one the request named."""
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="written", iterations=1)]
    )
    asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="create a doc of 1000 words on merge sort"
        )
    )

    assert node_agent._agent.calls[0]["require_tool_success"] == {"document_generation"}


def test_draft_does_not_force_a_file_for_a_bare_word_count_chat():
    """"write 1000 words on merge sort" wants an answer, not an artifact - the
    noun regex must not treat "words" as the document noun."""
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="done", iterations=1)]
    )
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text="write 1000 words on merge sort")
    )

    draft_call = node_agent._agent.calls[0]
    assert draft_call["require_tool_success"] is None
    assert draft_call["content_validator"] is not None  # the length gate still applies


def test_draft_does_not_force_a_file_when_a_coding_request_mentions_a_document():
    """'write a script that emits a document' names a document noun but is a
    coding request; forcing document_generation would derail it."""
    node_agent = make_agent([])
    asyncio.run(
        node_agent.run(
            FakeJob(),
            "/workspace",
            task_text="write a python script that generates a document",
        )
    )

    # The coding intent also activates compute, so pick draft's own call.
    draft_call = _draft_call(node_agent)
    assert draft_call["require_tool_success"] is None


# -- the deliverable is rendered in Python, not coaxed out of the model -------
#
# The tests above cover the no-tool-registry fallback (``require_success`` is
# set and the agent is nudged). In production a registry IS wired, and the
# generator is called by Python from content the model writes: gpt-oss:20b
# does not reliably tool-call, and the original bug was exactly that — eight
# iterations, zero tool calls, no deliverable.


def _rendering_agent(response="## Overview\n\nMerge sort divides the list.\n\n## Steps\n\nIt splits, sorts, merges."):
    tools = FakeTools()
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response=response, iterations=2)],
        tools=tools,
    )
    return node_agent, tools


def test_a_document_request_renders_the_file_without_the_model_calling_the_tool():
    """The reported bug, end to end: "create a doc of 1000 words on merge sort"
    produced no deliverable because the model never called document_generation.
    The file is now built in Python from the model's prose, so the deliverable
    does not depend on the model's tool-calling at all."""
    node_agent, tools = _rendering_agent()
    result = asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="create a doc of 1000 words on merge sort"
        )
    )

    assert result.status == AgentStatus.COMPLETED
    assert len(tools.document_generation.calls) == 1
    args = tools.document_generation.calls[0]
    assert args["type"] == "word"
    assert args["filename"].endswith(".docx")
    # The model's own content reached the generator, split on its headings.
    assert [section["heading"] for section in args["sections"]] == ["Overview", "Steps"]


def test_the_model_gets_first_refusal_before_the_content_phase():
    """The generator call is preferred when the model makes it — it picks a
    meaningful filename and title. Only when it does not does the content phase
    run, and that phase is one constrained completion with no tools in reach:
    gpt-oss:20b cannot tool-call inside the loop (it emits a builtin
    ``container.exec`` call and never settles), so the material is written in a
    call where a tool call is structurally unemittable."""
    ollama = FakeOllama()
    tools = FakeTools()
    node_agent = make_agent(
        [
            AgentResult(
                status=AgentStatus.FAILED,
                error="Agent stopped: reached maximum iterations (8)",
                iterations=8,
            )
        ],
        ollama_service=ollama,
        tools=tools,
    )
    result = asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="create a doc of 1000 words on merge sort"
        )
    )

    # The model got its one chance to call the generator itself, with the contract.
    assert len(node_agent._agent.calls) == 1
    assert node_agent._agent.calls[0]["require_tool_success"] == {"document_generation"}

    # The content phase is not an agent run: one constrained completion, no tools
    # offered, so the failure mode above cannot repeat.
    assert len(ollama.calls) == 1
    assert ollama.calls[0]["format"] == CONTENT_SCHEMA
    assert not ollama.calls[0]["tools"]

    # The written material still became the file.
    assert len(tools.document_generation.calls) == 1
    assert tools.document_generation.calls[0]["filename"].endswith(".docx")
    assert result.status == AgentStatus.COMPLETED


def test_an_empty_constrained_reply_degrades_rather_than_claiming_a_file():
    """The content phase is best-effort: a reply with no usable text must be
    reported honestly (the job degrades), never papered over with a file."""
    class NoContentOllama(FakeOllama):
        def __init__(self):
            super().__init__(content="")

    node_agent = make_agent(
        [
            AgentResult(
                status=AgentStatus.FAILED,
                error="Agent stopped: reached maximum iterations (8)",
                iterations=8,
            )
        ],
        ollama_service=NoContentOllama(),
        tools=FakeTools(),
    )
    recorded = _capture(node_agent)
    result = asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="create a doc of 500 words on soil"
        )
    )

    degraded = [e for e in recorded["trace"] if e.get("type") == "node_degraded"]
    assert degraded and degraded[0]["node"] == "draft"
    assert "no deliverable was produced" in result.response.lower()


def test_content_from_json_ignores_anything_that_is_not_content():
    assert _content_from_json('{"content": "  hello  "}') == "hello"
    assert _content_from_json("not json") == ""
    assert _content_from_json('{"tool_calls": []}') == ""
    assert _content_from_json("") == ""


def test_the_deliverable_filename_names_the_request_not_the_word_document():
    """Every deterministic deliverable used to be written as ``document.<ext>``,
    so a deck and a report shared one name and a stale report was one click from
    being mistaken for the deck just asked for."""
    assert deliverable_stem("create a pptx of 3 slides on Operating System") == (
        "operating-system"
    )
    assert deliverable_stem("generate a doc of 200 words on Operating System") == (
        "operating-system"
    )
    assert deliverable_stem("can you please make me a report on corrosion") == "corrosion"


def test_the_deliverable_filename_falls_back_to_the_whole_request():
    """No topic preposition, or a pronoun subject — the slug is the request."""
    assert deliverable_stem("make a pptx of the findings") == "pptx-of-the-findings"
    assert deliverable_stem("make a deck on it") == "deck-on-it"


def test_the_deliverable_filename_is_always_a_safe_filename():
    assert deliverable_stem("") == "document"
    assert deliverable_stem("!!! ??? ...") == "document"
    # A slug never carries a path separator, spaces, or a leading dot.
    stem = deliverable_stem("../../etc/passwd and lorem ipsum dolor sit amet consectetur")
    assert "/" not in stem and "\\" not in stem and ".." not in stem
    assert not stem.startswith("-")
    assert len(stem) <= 48


def test_a_successful_generator_call_is_not_second_guessed():
    """If the model produced the file itself, its own filename and title stand —
    the deterministic backstop must not add a second artifact."""
    tools = FakeTools()
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="Created report.docx.", iterations=2)],
        tools=tools,
    )
    node_agent._agent = _ToolCallingAgent(node_agent._agent, "document_generation")

    asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="create a doc of 1000 words on merge sort"
        )
    )

    assert tools.document_generation.calls == []  # the node did not render one


def test_a_deck_request_renders_a_pptx():
    node_agent, tools = _rendering_agent(response="## Findings\n\nCorrosion is present.\n\n## Actions\n\nRepair course 2.")
    asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="make a pptx of the findings"
        )
    )

    assert len(tools.presentation_generation.calls) == 1
    args = tools.presentation_generation.calls[0]
    assert args["filename"].endswith(".pptx")
    assert [slide["type"] for slide in args["slides"]] == ["bullets", "bullets"]


def test_a_spreadsheet_request_renders_an_xlsx():
    node_agent, tools = _rendering_agent(response="## Rates\n\n0.19 mm/yr")
    asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="build a spreadsheet of the corrosion rates"
        )
    )

    assert tools.document_generation.calls[0]["type"] == "excel"
    assert tools.document_generation.calls[0]["filename"].endswith(".xlsx")


def test_a_plain_chat_answer_never_touches_a_generator():
    """No deliverable named means no render: chat must not gain a surprise .docx."""
    node_agent, tools = _rendering_agent(response="Corrosion allowance is the metal set aside.")
    asyncio.run(
        node_agent.run(
            FakeJob(), "/workspace", task_text="what does corrosion allowance mean?"
        )
    )

    assert tools.document_generation.calls == []
    assert node_agent._agent.calls[0]["tool_names"] is not None
    assert "document_generation" in node_agent._agent.calls[0]["tool_names"]


def test_a_generator_failure_degrades_visibly_instead_of_claiming_success():
    class FailingTool(FakeTool):
        async def execute(self, workspace, arguments):
            self.calls.append(arguments)
            return ToolResult(ok=False, summary="unsafe filename")

    tools = FakeTools()
    tools.document_generation = FailingTool("document_generation")
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="## Body\n\nText.", iterations=1)],
        tools=tools,
    )
    recorded = _capture(node_agent)
    result = asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text="create a doc of 500 words on soil")
    )

    degraded = [e for e in recorded["trace"] if e.get("type") == "node_degraded"]
    assert degraded and degraded[0]["node"] == "draft"
    # The job reports the real reason rather than claiming a deliverable exists.
    assert "no deliverable was produced" in result.response.lower()
    assert "could not be produced" in result.response


def test_content_sections_splits_on_markdown_headings():
    sections = content_sections("## One\n\nfirst\n\nsecond\n\n### Two\n\nthird")
    assert sections == [
        {"heading": "One", "paragraphs": ["first", "second"]},
        {"heading": "Two", "paragraphs": ["third"]},
    ]


def test_content_sections_keeps_text_that_has_no_headings():
    assert content_sections("just a paragraph") == [
        {"heading": "Document", "paragraphs": ["just a paragraph"]}
    ]


def test_content_slides_skips_empty_sections():
    assert content_slides([{"heading": "A", "paragraphs": []}, {"heading": "B", "paragraphs": ["x"]}]) == [
        {"type": "bullets", "title": "B", "bullets": ["x"]}
    ]


def test_presentation_intent_wins_over_a_mentioned_document():
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.COMPLETED, response="deck made", iterations=1)]
    )
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text="make a ppt about the report")
    )

    assert node_agent._agent.calls[0]["require_tool_success"] == {"presentation_generation"}


def test_no_output_message_names_the_draft_failure_not_documents():
    """Reported bug: a job with no attachments at all ended with "Assessment
    could not be grounded in the supplied documents" - blaming documents that
    were never in scope for a failure that was really draft degrading."""
    node_agent = make_agent(
        [AgentResult(status=AgentStatus.FAILED, error="agent gave up", iterations=8)]
    )
    result = asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text="create a doc on merge sort")
    )

    assert result.status == AgentStatus.COMPLETED
    assert "draft step degraded" in result.response
    assert "agent gave up" in result.response
    assert "documents" not in result.response


def test_no_output_reason_falls_back_when_draft_left_no_entry():
    assert no_output_reason([]) == "the run finished without producing output"


def test_compute_runs_on_coding_intent_even_when_the_classifier_says_general():
    """Reported bug: a plain coding request sometimes gets 'the wrong model'.
    Root cause: compute's only signal for 'this is a computational task' was
    job.task_type == 'coding' from the semantic classifier (measured ~88%
    held-out accuracy) - a misclassification silently skips compute and the
    coding-capability model + code_execution tool entirely, falling through
    to draft's general model with no way to actually run code. A cheap
    keyword backstop must widen activation even when task_type says
    'document' (FakeJob's default), never narrow it."""
    node_agent = make_agent([])  # FakeAgent's default "done"/COMPLETED for every call
    recorded = _capture(node_agent)
    result = asyncio.run(
        node_agent.run(
            FakeJob(),
            "/workspace",
            task_text="Write a python function that reverses a string and test it.",
        )
    )

    assert result.status == AgentStatus.COMPLETED
    trace = recorded["trace"]
    started = {entry["node"]: entry["model"] for entry in trace if entry["type"] == "node_started"}
    assert started["compute"] == "coder-model"
    completed = [e["node"] for e in trace if e["type"] == "node_completed"]
    assert "compute" in completed


def test_compute_still_skips_plain_non_coding_requests():
    node_agent = make_agent([])
    recorded = _capture(node_agent)
    asyncio.run(node_agent.run(FakeJob(), "/workspace", task_text="What's the capital of France?"))

    trace = recorded["trace"]
    skipped = {entry["node"]: entry["reason"] for entry in trace if entry["type"] == "node_skipped"}
    assert "compute" in skipped


def test_draft_renders_deterministically_when_assessment_exists():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response="extract", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="SHOULD NOT BE USED", iterations=1),
    ]
    tools = FakeTools()
    node_agent = NodeAgent(
        agent=FakeAgent(results),
        capability_router=CapabilityRouter(build_registry(MODELS)),
        registry=build_registry(MODELS),
        tools=tools,
    )
    result = asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )

    # draft never consumed the fourth scripted turn: rendering was deterministic.
    assert len(node_agent._agent.results) == 1
    assert "Rendered the approval note" in (result.response or "")
    docx = tools.document_generation.calls[0]
    assert docx["filename"] == "approval_note.docx"
    assert any("C2" in row for row in docx["sections"][0]["table"])
    xlsx = tools.document_generation.calls[1]
    assert xlsx["filename"] == "assessment.xlsx"
    pptx = tools.presentation_generation.calls[0]
    assert pptx["filename"] == "assessment.pptx"


def test_compute_budget_exhaustion_degrades_to_incomplete_refer():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.FAILED, response="", error="max iterations", iterations=4),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = make_agent(results)
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )
    by_course = {course.course: course for course in node_agent.last_assessment.courses}
    assert by_course["C2"].status == "REFER"
    assert by_course["C2"].reason_code == "REFER_ASSESSMENT_INCOMPLETE"


def test_nodes_scope_tools_per_step():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = make_agent(results)
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )
    calls = node_agent._agent.calls
    assert calls[0]["tool_names"] == {
        "document_search",
        "document_exact_search",
        "read_document",
        "document_vision",
        "pid_diagram_qa",
        "submit_findings",
        "list_files",
    }  # extract keeps its read tools plus the typed exit
    assert calls[1]["tool_names"] == {"document_search", "document_exact_search"}
    assert calls[2]["tool_names"] == {"code_execution"}
    assert calls[3]["tool_names"] == {
        "document_generation",
        "presentation_generation",
        "list_files",
        "read_file",
        "write_file",
    }


def test_course_without_baseline_keeps_no_baseline_reason():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = make_agent(results)
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )
    by_course = {course.course: course for course in node_agent.last_assessment.courses}
    assert by_course["C5"].status == "REFER"
    assert by_course["C5"].reason_code == "REFER_NO_BASELINE"
    assert by_course["C5"].corrosion_rate_mm_per_year is None
    assert by_course["C2"].corrosion_rate_mm_per_year is not None


class StubbornAgent:
    """Simulates a model that reports COMPLETED without ever running the
    sandbox — the ``require_tool_success`` soft gate inside Agent.run() gives
    up on its own last budgeted turn (see test_agent.py), so nodes.py must not
    trust ``result.status == COMPLETED`` alone for compute."""

    def __init__(self, results):
        self.results = list(results)
        self.calls = []

    async def run(self, job, **kwargs):
        self.calls.append(kwargs)
        task = kwargs.get("task_text", "")
        trace = kwargs.get("trace")
        if trace is not None:
            if "submit_findings" in task:
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_call", "tool": "submit_findings", "arguments": FINDINGS}
                )
                trace.append(
                    {"step": len(trace) + 1, "type": "tool_result", "tool": "submit_findings", "ok": True}
                )
            elif "document_search" in task:
                trace.append({"step": len(trace) + 1, "type": "tool_call", "tool": "document_search"})
            # Deliberately no code_execution simulation here, even though the
            # compute instruction mentions it: this model never actually calls it.
        if not self.results:
            return AgentResult(status=AgentStatus.COMPLETED, response="done", iterations=1)
        return self.results.pop(0)

    async def record_trace(self, *args, **kwargs):
        return None


def test_compute_completed_without_a_verified_sandbox_call_still_degrades():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        # Reports COMPLETED with a confident number, but never ran code_execution.
        AgentResult(status=AgentStatus.COMPLETED, response="corrosion rate is 0.5 mm/yr", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = NodeAgent(
        agent=StubbornAgent(results),
        capability_router=CapabilityRouter(build_registry(MODELS)),
        registry=build_registry(MODELS),
    )
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=ATTACHMENTS)
    )
    by_course = {course.course: course for course in node_agent.last_assessment.courses}
    assert by_course["C2"].reason_code == "REFER_ASSESSMENT_INCOMPLETE"
