"""Node sequence: per-node routing records, recorded skips, typed handoff, degrade."""

import asyncio
import json

from app.services.agent import AgentResult, AgentStatus
from app.services.capability_router import CapabilityRouter
from app.services.nodes import NodeAgent
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
    message = "Assess Tank 204 using the inspection reports and our SOP."


class FakeAgent:
    def __init__(self, results):
        self.results = list(results)
        self.calls = []

    async def run(self, job, **kwargs):
        self.calls.append(kwargs)
        if not self.results:
            return AgentResult(status=AgentStatus.COMPLETED, response="done", iterations=1)
        return self.results.pop(0)

    async def record_trace(self, *args, **kwargs):
        return None


def make_agent(results):
    return NodeAgent(
        agent=FakeAgent(results),
        capability_router=CapabilityRouter(build_registry(MODELS)),
        registry=build_registry(MODELS),
    )


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
    result = asyncio.run(node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message))

    trace = recorded["trace"]
    started = {entry["node"]: entry["model"] for entry in trace if entry["type"] == "node_started"}
    assert started == {
        "extract": "vision-model",
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


def test_compute_budget_exhaustion_degrades_to_incomplete_refer():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.FAILED, response="", error="max iterations", iterations=4),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = make_agent(results)
    asyncio.run(node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message))
    by_course = {course.course: course for course in node_agent.last_assessment.courses}
    assert by_course["C2"].status == "REFER"
    assert by_course["C2"].reason_code == "REFER_ASSESSMENT_INCOMPLETE"


def test_course_without_baseline_keeps_no_baseline_reason():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = make_agent(results)
    asyncio.run(node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message))
    by_course = {course.course: course for course in node_agent.last_assessment.courses}
    assert by_course["C5"].status == "REFER"
    assert by_course["C5"].reason_code == "REFER_NO_BASELINE"
    assert by_course["C5"].corrosion_rate_mm_per_year is None
    assert by_course["C2"].corrosion_rate_mm_per_year is not None
