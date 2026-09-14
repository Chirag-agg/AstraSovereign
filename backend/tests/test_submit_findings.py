"""submit_findings: extract's typed tool exit, and the ambiguity assessment rule."""

import asyncio
import json
from pathlib import Path

import httpx
import pytest

from app.schemas.findings import FindingsObject
from app.services.agent import Agent, AgentStatus
from app.services.findings import REASON_AMBIGUOUS, assess
from app.services.job_manager import JobManager
from app.services.job_store import InMemoryJobStore
from app.services.ollama_service import OllamaService
from app.services.tool_registry import ToolRegistry
from app.services.tools import SubmitFindingsTool, ToolError
from tests.conftest import make_scripted_handler

FINDINGS = {
    "tank": "TANK-204",
    "readings": [
        {"course": "C2", "value_mm": 10.9, "survey_date": "2026-08-15", "source": "doc"},
    ],
}


def test_submit_findings_accepts_a_valid_object(tmp_path):
    result = asyncio.run(SubmitFindingsTool().execute(tmp_path, FINDINGS))
    assert result.ok is True
    assert "1 reading" in result.summary


def test_submit_findings_rejects_a_malformed_object(tmp_path):
    with pytest.raises(ToolError):
        asyncio.run(SubmitFindingsTool().execute(tmp_path, {"readings": [{"course": "C2"}]}))


def test_submit_findings_accepts_an_empty_readings_list(tmp_path):
    # Q&A/retrieval documents have no readings; the node degrades, the tool accepts.
    result = asyncio.run(SubmitFindingsTool().execute(tmp_path, {"readings": []}))
    assert result.ok is True


def test_terminal_tool_completes_without_a_final_turn(tmp_path):
    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="assess tank 204")
        # Exactly one model call: the terminal tool ends the run. If the loop
        # asked for a second decision, the scripted handler would raise.
        script = [
            json.dumps(
                {
                    "type": "tool_call",
                    "tool": "submit_findings",
                    "arguments": FINDINGS,
                    "reasoning": "submit",
                }
            )
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([SubmitFindingsTool()]),
            model_client=service,
        )
        return await agent.run(
            job,
            model="test-model",
            workspace=tmp_path,
            terminal_tools={"submit_findings"},
        )

    result = asyncio.run(scenario())
    assert result.status == AgentStatus.COMPLETED
    assert "findings accepted" in (result.response or "")


def test_terminal_tool_is_enforced_when_the_model_answers_prose(tmp_path):
    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="assess tank 204")
        script = [
            json.dumps({"type": "final", "response": "here is my assessment in prose"}),
            json.dumps(
                {
                    "type": "tool_call",
                    "tool": "submit_findings",
                    "arguments": FINDINGS,
                    "reasoning": "submit",
                }
            ),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([SubmitFindingsTool()]),
            model_client=service,
        )
        return await agent.run(
            job,
            model="test-model",
            workspace=tmp_path,
            terminal_tools={"submit_findings"},
        )

    result = asyncio.run(scenario())
    assert result.status == AgentStatus.COMPLETED
    assert "findings accepted" in (result.response or "")


def test_ambiguous_reading_is_referred_never_silently_picked():
    findings = FindingsObject.model_validate(
        {
            "readings": [
                {
                    "course": "C5",
                    "value_mm": 11.6,
                    "survey_date": "2026-08-15",
                    "candidates_mm": [10.4, 11.6],
                },
                {"course": "C5", "value_mm": 11.2, "survey_date": "2021-06-02"},
            ]
        }
    )
    result = assess(findings, min_thickness_mm=10.0, alert_thickness_mm=11.0)
    course = {c.course: c for c in result.courses}["C5"]
    assert course.status == "REFER"
    assert course.reason_code == REASON_AMBIGUOUS
