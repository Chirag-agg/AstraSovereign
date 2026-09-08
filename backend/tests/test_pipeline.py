"""Tests for the multi-model pipeline: complexity gate, planner validation,
capability fallback, and an end-to-end coding+document run."""

import json

import pytest

from app.services.capability_router import CapabilityRouter, CapabilityRoutingError
from app.services.model_registry import ModelConfig, ModelRegistry
from app.services.pipeline import ALLOWED_PIPELINE_CAPABILITIES, ComplexityGate, Planner, StageDef
from app.schemas.resources import ResourceRequirements

from tests.conftest import FakeSandboxRunner, make_scripted_handler, ok_result, wait_for_job


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


def make_registry(enabled_types=("general", "coding", "document")):
    models = {
        "general": ModelConfig(
            model="general-model",
            enabled="general" in enabled_types,
            capabilities=["general", "reasoning"],
        ),
        "coding": ModelConfig(
            model="coder-model",
            enabled="coding" in enabled_types,
            capabilities=["coding"],
        ),
        "math": ModelConfig(model="math-model", enabled="math" in enabled_types, capabilities=["math"]),
        "document": ModelConfig(
            model="doc-model",
            enabled="document" in enabled_types,
            capabilities=["document", "summarization"],
        ),
    }
    return ModelRegistry(models=models)


class FakeOllama:
    """Stub planner backend."""

    def __init__(self, plan=None):
        self._plan = plan

    async def generate(self, prompt, model, format=None):
        if self._plan is None:
            return ('{"stages": [{"capability": "execute_shell"}]}', model)
        return (self._plan, model)


@pytest.fixture
def router():
    return CapabilityRouter(make_registry())


def test_allowed_capabilities_are_fixed():
    assert ALLOWED_PIPELINE_CAPABILITIES == {"reasoning", "math", "coding", "document", "vision", "presentation"}


def test_gate_only_pipelines_multi_capability_requests():
    gate = ComplexityGate(min_prompt_chars=20)
    assert gate.should_pipeline("coding", "Write a Python program and produce a Word document explaining it.") is True
    assert gate.should_pipeline("coding", "write code please") is False  # coding only
    assert gate.should_pipeline("document", "summarize this pdf please give me a good long summary") is False  # doc only
    assert gate.should_pipeline("general", "hi") is False
    assert gate.should_pipeline("general", "Derive the matrix formula and write Python code for it.") is True  # math+coding


def test_capability_router_falls_back_to_general(router):
    result = router.resolve("math")  # math disabled -> general
    assert result.model == "general-model"
    result = router.resolve("reasoning")
    assert result.model == "general-model"
    result = router.resolve("document")
    assert result.model == "doc-model"


def test_capability_router_raises_when_nothing_enabled():
    empty = CapabilityRouter(make_registry(enabled_types=()))
    with pytest.raises(CapabilityRoutingError):
        empty.resolve("coding")


def test_planner_llm_validates_allowlist():
    ollama = FakeOllama(plan=json.dumps({"stages": [{"capability": "reasoning", "instruction": "x"}]}))
    planner = Planner(CapabilityRouter(make_registry()), ollama, max_stages=4)
    from app.schemas.job import Job

    job = Job(job_id="j1", user_id="u1", message="make a matrix program and document it", task_type="coding")
    plan = pytest.importorskip("asyncio").run(planner.plan(job, "coding"))
    assert [s.capability for s in plan.stages] == ["reasoning"]


def test_planner_rejects_invented_capability_and_falls_back():
    ollama = FakeOllama(plan=json.dumps({"stages": [{"capability": "execute_shell", "instruction": "x"}]}))
    planner = Planner(CapabilityRouter(make_registry()), ollama, max_stages=4)
    from app.schemas.job import Job

    job = Job(job_id="j1", user_id="u1", message="Write a Python program and a Word document about it", task_type="coding")
    plan = pytest.importorskip("asyncio").run(planner.plan(job, "coding"))
    assert plan.stages  # deterministic fallback used
    for s in plan.stages:
        assert s.capability in ALLOWED_PIPELINE_CAPABILITIES


def test_fallback_plan_coding_doc(router):
    planner = Planner(router, FakeOllama(plan=None))
    stages = planner.fallback_plan("coding", "Write a Python program and produce a Word document explaining the algorithm")
    assert [s.capability for s in stages] == ["reasoning", "coding", "document"]


def test_end_to_end_pipeline_coding_document(client_factory):
    """Coding+document request decomposes into reasoning->coding->document stages."""
    script = [
        # 1. planner model output (JSON stage plan)
        json.dumps(
            {
                "stages": [
                    {"capability": "reasoning", "instruction": "Analyse the request."},
                    {"capability": "coding", "instruction": "Implement and run the program."},
                    {"capability": "document", "instruction": "Generate the Word deliverable."},
                ]
            }
        ),
        # 2. reasoning stage completes
        final("Analysis complete: use a simple algorithm.", "r"),
        # 3. coding stage: run code in the sandbox
        tool_call("code_execution", {"language": "python", "code": "print(42)"}, "r"),
        final("The program printed 42.", "r"),
        # 4. document stage completes
        final("Document drafted.", "r"),
    ]
    runner = FakeSandboxRunner(results=[ok_result(stdout="42\n")])
    with client_factory(make_scripted_handler(script), sandbox_enabled=True, sandbox_runner=runner) as c:
        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Write a Python program that prints 42, run it, then produce a 5-page Word "
                    "document explaining the algorithm."
                )
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=15)

    assert job["status"] == "completed", job.get("error")
    trace = job["execution_trace"]
    types = [t["type"] for t in trace]
    started = [t for t in trace if t["type"] == "stage_started"]
    completed = [t for t in trace if t["type"] == "stage_completed"]
    assert [t["capability"] for t in started] == ["reasoning", "coding", "document"]
    assert len(completed) == 3
    assert all(t["status"] == "completed" for t in completed)
    assert "Document drafted." in job["response"]
