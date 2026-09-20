"""Node sequence: per-node routing records, recorded skips, typed handoff, degrade."""

import asyncio
import json

from app.services.agent import AgentResult, AgentStatus
from app.services.capability_router import CapabilityRouter
from app.services.nodes import NodeAgent
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


def make_agent(results, ollama_service=None, scheduler=None):
    return NodeAgent(
        agent=FakeAgent(results),
        capability_router=CapabilityRouter(build_registry(MODELS)),
        registry=build_registry(MODELS),
        ollama_service=ollama_service,
        scheduler=scheduler,
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
