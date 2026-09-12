"""Native Ollama tool calling.

These tests exercise the real ``/api/chat`` shape Ollama emits (not the
JSON-envelope adapter the older tests use), including the two argument encodings
(object and JSON string) and the malformed case: a tool call missing a required
argument, which must surface as a recoverable schema error rather than leaking
into the final answer.
"""

import asyncio

import httpx

from app.services.agent import Agent
from app.services.job_manager import JobManager
from app.services.job_store import InMemoryJobStore
from app.services.ollama_service import OllamaService
from app.services.tool_registry import ToolRegistry
from app.services.tools import ListFilesTool, ReadFileTool, WriteFileTool
from tests.conftest import make_native_chat_handler

TOOLS = ToolRegistry([ListFilesTool(), ReadFileTool(), WriteFileTool()])


def run_agent(handler, message, workspace, max_iterations=5, max_tool_calls=5):
    async def scenario():
        store = InMemoryJobStore()
        manager = JobManager(store=store, default_model="test-model")
        job = await manager.create_job(user_id="user-001", message=message)
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(handler),
        )
        agent = Agent(
            manager=manager,
            tool_registry=TOOLS,
            model_client=service,
            max_iterations=max_iterations,
            max_tool_calls=max_tool_calls,
        )
        try:
            result = await agent.run(job=job, model="test-model", workspace=workspace)
            final = await manager.get_job_for_worker(job.job_id)
            return result, final
        finally:
            await service.aclose()

    return asyncio.run(scenario())


def tool_calls_in(trace):
    return [entry["tool"] for entry in trace if entry["type"] == "tool_call"]


def test_native_tool_call_with_object_arguments(tmp_path):
    (tmp_path / "report.txt").write_text("key finding", encoding="utf-8")
    handler = make_native_chat_handler(
        [
            {
                "content": "",
                "tool_calls": [{"name": "read_file", "arguments": {"path": "report.txt"}}],
            },
            {"content": "Read it: key finding"},
        ]
    )
    result, final = run_agent(handler, "read report", tmp_path)
    assert result.status == "completed"
    assert result.response == "Read it: key finding"
    assert tool_calls_in(final.execution_trace) == ["read_file"]
    assert result.tool_calls == 1


def test_native_tool_call_with_string_arguments(tmp_path):
    (tmp_path / "a.txt").write_text("x", encoding="utf-8")
    handler = make_native_chat_handler(
        [
            {"content": "", "tool_calls": [{"name": "list_files", "arguments": {}}]},
            {"content": "Listed."},
        ],
        arguments_as_string=True,
    )
    result, final = run_agent(handler, "list files", tmp_path)
    assert result.status == "completed"
    assert tool_calls_in(final.execution_trace) == ["list_files"]


def test_native_tool_call_missing_required_argument_recovers(tmp_path):
    """The 3B model's real failure mode: a tool call missing a required argument
    must become a schema error the loop can recover from, not a leaked envelope."""
    handler = make_native_chat_handler(
        [
            {"content": "", "tool_calls": [{"name": "read_file", "arguments": {}}]},
            {"content": "I could not read the file."},
        ]
    )
    result, final = run_agent(handler, "read something", tmp_path)
    assert result.status == "completed"
    assert result.response == "I could not read the file."
    failed = [
        entry
        for entry in final.execution_trace
        if entry["type"] == "tool_result" and entry.get("ok") is False
    ]
    assert failed and "Missing required argument" in failed[0]["result_summary"]
    assert "tool_call" not in (result.response or "")
