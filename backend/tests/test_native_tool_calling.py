"""Native Ollama tool calling.

These tests exercise the real ``/api/chat`` shape Ollama emits (not the
JSON-envelope adapter the older tests use), including the two argument encodings
(object and JSON string) and the malformed case: a tool call missing a required
argument, which must surface as a recoverable schema error rather than leaking
into the final answer.
"""

import asyncio
import json

import httpx

from app.services.agent import Agent
from app.services.job_manager import JobManager
from app.services.job_store import InMemoryJobStore
from app.services.ollama_service import OllamaService
from app.services.tool_registry import ToolRegistry
from app.services.tools import (
    BaseTool,
    ListFilesTool,
    ReadFileTool,
    ToolResult,
    WriteFileTool,
)
from tests.conftest import make_native_chat_handler

TOOLS = ToolRegistry([ListFilesTool(), ReadFileTool(), WriteFileTool()])


class SearchStub(BaseTool):
    name = "document_search"
    description = "search"
    input_schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}, "top_k": {"type": "integer"}},
        "required": ["query"],
        "additionalProperties": False,
    }

    def __init__(self):
        self.calls = []

    async def execute(self, workspace, arguments):
        self.calls.append(arguments)
        return ToolResult(ok=True, summary=f"searched top_k={arguments.get('top_k')}")


def run_agent(handler, message, workspace, max_iterations=5, max_tool_calls=5, tools=None):
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
            tool_registry=tools if tools is not None else TOOLS,
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
    assert result.legacy_envelope_used == 0


def test_legacy_envelope_fallback_is_counted(tmp_path):
    """A model that ignores the tools API and emits the old envelope still works,
    and the fallback is counted so it can be expired once unused."""
    handler = make_native_chat_handler(
        [{"content": '{"type":"final","response":"legacy answer"}'}]
    )
    result, final = run_agent(handler, "hi", tmp_path)
    assert result.status == "completed"
    assert result.response == "legacy answer"
    assert result.legacy_envelope_used == 1
    assert any(entry["type"] == "legacy_envelope_used" for entry in final.execution_trace)


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


def test_tool_history_roundtrips_ids_and_parallel_calls(tmp_path):
    """Two calls in one assistant turn must produce two tool messages carrying
    their ids, so the next completion sees a real tool-calling history."""
    (tmp_path / "a.txt").write_text("x", encoding="utf-8")
    requests = []
    script = [
        {
            "content": "",
            "tool_calls": [
                {"id": "call_1", "name": "list_files", "arguments": {}},
                {"id": "call_2", "name": "read_file", "arguments": {"path": "a.txt"}},
            ],
        },
        {"content": "done"},
    ]

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "test-model"}]})
        if request.url.path == "/api/chat":
            payload = json.loads(request.content)
            requests.append(payload)
            turn = script.pop(0)
            message = {"role": "assistant", "content": turn.get("content", "")}
            if turn.get("tool_calls"):
                message["tool_calls"] = [
                    {
                        "id": call["id"],
                        "function": {"name": call["name"], "arguments": call["arguments"]},
                    }
                    for call in turn["tool_calls"]
                ]
            return httpx.Response(200, json={"model": "test-model", "message": message})
        return httpx.Response(404, json={"error": "not found"})

    result, _final = run_agent(handler, "inspect", tmp_path)
    assert result.status == "completed"
    assert result.tool_calls == 2
    assert len(requests) == 2
    second_messages = requests[1]["messages"]
    assistant = [
        message
        for message in second_messages
        if message.get("role") == "assistant" and message.get("tool_calls")
    ]
    assert assistant and len(assistant[-1]["tool_calls"]) == 2
    tool_messages = [message for message in second_messages if message.get("role") == "tool"]
    assert {message["tool_call_id"] for message in tool_messages} == {"call_1", "call_2"}


def test_string_integer_argument_is_coerced_and_recorded(tmp_path):
    tool = SearchStub()
    handler = make_native_chat_handler(
        [
            {
                "content": "",
                "tool_calls": [
                    {"name": "document_search", "arguments": {"query": "x", "top_k": "5"}}
                ],
            },
            {"content": "done"},
        ]
    )
    result, final = run_agent(handler, "search x", tmp_path, tools=ToolRegistry([tool]))
    assert result.status == "completed"
    assert tool.calls == [{"query": "x", "top_k": 5}]
    assert result.argument_coercions == 1
    coerced = [entry for entry in final.execution_trace if entry["type"] == "tool_argument_coerced"]
    assert coerced and coerced[0]["fields"] == ["top_k"]


def test_rejected_tool_call_returns_as_tool_message_and_retries(tmp_path):
    (tmp_path / "a.txt").write_text("x", encoding="utf-8")
    handler = make_native_chat_handler(
        [
            {"content": "", "tool_calls": [{"name": "read_file", "arguments": {}}]},
            {
                "content": "",
                "tool_calls": [{"name": "read_file", "arguments": {"path": "a.txt"}}],
            },
            {"content": "done"},
        ]
    )
    result, final = run_agent(handler, "read the file", tmp_path)
    assert result.status == "completed"
    assert result.tool_calls == 2
    results = [entry for entry in final.execution_trace if entry["type"] == "tool_result"]
    assert [entry["ok"] for entry in results] == [False, True]
    assert "Missing required argument" in results[0]["result_summary"]
