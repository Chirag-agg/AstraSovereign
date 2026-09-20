"""Direct tests of the controlled agent loop (mocked model, real tools)."""

import asyncio
import json
from pathlib import Path

import httpx

from app.services.agent import Agent, AgentStatus
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
from tests.conftest import make_scripted_handler

DEFAULT_TOOLS = ToolRegistry([ListFilesTool(), ReadFileTool(), WriteFileTool()])


def run_agent(
    script,
    message,
    workspace: Path,
    max_iterations=5,
    max_tool_calls=5,
    tools=None,
):
    async def scenario():
        store = InMemoryJobStore()
        manager = JobManager(store=store, default_model="test-model")
        job = await manager.create_job(user_id="user-001", message=message)
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(
            manager=manager,
            tool_registry=tools if tools is not None else DEFAULT_TOOLS,
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
    return [t["tool"] for t in trace if t["type"] == "tool_call"]


def test_agent_completes_without_tools(tmp_path):
    result, final = run_agent(
        ['{"type":"final","response":"Hello there"}'], "hi", tmp_path
    )
    assert result.status == "completed"
    assert result.response == "Hello there"
    assert result.iterations == 1
    assert result.tool_calls == 0
    assert final.execution_trace[0]["type"] == "agent_started"


def test_agent_calls_list_files(tmp_path):
    (tmp_path / "a.txt").write_text("x", encoding="utf-8")
    result, final = run_agent(
        [
            '{"type":"tool_call","tool":"list_files","arguments":{}}',
            '{"type":"final","response":"done"}',
        ],
        "list files",
        tmp_path,
    )
    assert result.status == "completed"
    assert result.tool_calls == 1
    assert tool_calls_in(final.execution_trace) == ["list_files"]
    result_entries = [t for t in final.execution_trace if t["type"] == "tool_result"]
    assert result_entries[-1]["result_summary"] == "1 file(s) found"


def test_agent_calls_read_file(tmp_path):
    (tmp_path / "report.txt").write_text("key finding", encoding="utf-8")
    result, final = run_agent(
        [
            '{"type":"tool_call","tool":"read_file","arguments":{"path":"report.txt"}}',
            '{"type":"final","response":"done"}',
        ],
        "read report",
        tmp_path,
    )
    assert result.status == "completed"
    assert tool_calls_in(final.execution_trace) == ["read_file"]
    assert final.tool_call_count == 1


def test_agent_calls_write_file(tmp_path):
    result, final = run_agent(
        [
            '{"type":"tool_call","tool":"write_file","arguments":{"path":"out.txt","content":"hello world"}}',
            '{"type":"final","response":"done"}',
        ],
        "write a file",
        tmp_path,
    )
    assert result.status == "completed"
    assert tool_calls_in(final.execution_trace) == ["write_file"]
    assert (tmp_path / "out.txt").read_text(encoding="utf-8") == "hello world"


def test_agent_multiple_tool_calls_and_trace_order(tmp_path):
    (tmp_path / "report.txt").write_text("data", encoding="utf-8")
    result, final = run_agent(
        [
            '{"type":"tool_call","tool":"list_files","arguments":{}}',
            '{"type":"tool_call","tool":"read_file","arguments":{"path":"report.txt"}}',
            '{"type":"tool_call","tool":"write_file","arguments":{"path":"summary.txt","content":"sum"}}',
            '{"type":"final","response":"done"}',
        ],
        "inspect, read, summarize",
        tmp_path,
    )
    assert result.status == "completed"
    assert result.tool_calls == 3
    assert tool_calls_in(final.execution_trace) == ["list_files", "read_file", "write_file"]
    results = [t["tool"] for t in final.execution_trace if t["type"] == "tool_result"]
    assert results == ["list_files", "read_file", "write_file"]
    steps = [t["step"] for t in final.execution_trace]
    assert steps == sorted(steps)
    assert len(set(steps)) == len(steps)


def test_agent_stops_at_max_iterations(tmp_path):
    script = ['{"type":"tool_call","tool":"list_files","arguments":{}}'] * 10
    result, final = run_agent(script, "loop", tmp_path, max_iterations=2)
    assert result.status == "failed"
    assert "maximum iterations" in result.error
    assert result.iterations == 2
    assert final.agent_stage == "failed"


def test_agent_rejects_invalid_tool_name(tmp_path):
    result, final = run_agent(
        [
            '{"type":"tool_call","tool":"nonexistent","arguments":{}}',
            '{"type":"final","response":"recovered"}',
        ],
        "do something",
        tmp_path,
    )
    assert result.status == "completed"
    assert result.response == "recovered"
    failed = [t for t in final.execution_trace if t["type"] == "tool_result" and t.get("ok") is False]
    assert failed and "Unknown tool" in failed[0]["result_summary"]


def test_agent_rejects_invalid_arguments(tmp_path):
    result, final = run_agent(
        [
            '{"type":"tool_call","tool":"read_file","arguments":{}}',
            '{"type":"final","response":"recovered"}',
        ],
        "read something",
        tmp_path,
    )
    assert result.status == "completed"
    failed = [t for t in final.execution_trace if t["type"] == "tool_result" and t.get("ok") is False]
    assert failed and "Missing required argument" in failed[0]["result_summary"]


def test_agent_rejects_path_traversal(tmp_path):
    outside = tmp_path.parent / "secret-outside.txt"
    outside.write_text("secret", encoding="utf-8")
    result, final = run_agent(
        [
            '{"type":"tool_call","tool":"read_file","arguments":{"path":"../secret-outside.txt"}}',
            '{"type":"final","response":"done"}',
        ],
        "read the secret",
        tmp_path,
    )
    assert result.status == "completed"
    failed = [t for t in final.execution_trace if t["type"] == "tool_result" and t.get("ok") is False]
    assert failed and "escapes" in failed[0]["result_summary"]
    assert outside.read_text(encoding="utf-8") == "secret"


def test_agent_plain_text_fallback(tmp_path):
    result, _ = run_agent(["just a plain answer"], "hi", tmp_path)
    assert result.status == "completed"
    assert result.response == "just a plain answer"


class SlowTool(BaseTool):
    name = "slow_tool"
    description = "delays execution"
    input_schema = {"type": "object", "properties": {}, "additionalProperties": False}

    async def execute(self, workspace: Path, arguments: dict) -> ToolResult:
        await asyncio.sleep(0.4)
        return ToolResult(ok=True, summary="done")


def test_agent_cancelled_stops_further_iterations(tmp_path):
    async def scenario():
        store = InMemoryJobStore()
        manager = JobManager(store=store, default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="do stuff")
        script = [
            '{"type":"tool_call","tool":"slow_tool","arguments":{}}',
            '{"type":"final","response":"should not happen"}',
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([SlowTool()]),
            model_client=service,
            max_iterations=5,
            max_tool_calls=5,
        )
        task = asyncio.create_task(
            agent.run(job=job, model="test-model", workspace=tmp_path)
        )
        await asyncio.sleep(0.15)
        await manager.cancel_job("user-001", job.job_id)
        try:
            result = await task
        finally:
            await service.aclose()
        return result

    result = asyncio.run(scenario())
    assert result.status == "cancelled"
    assert result.iterations == 1
    assert result.tool_calls == 1


def test_agent_cancelled_before_run_returns_immediately(tmp_path):
    async def scenario():
        store = InMemoryJobStore()
        manager = JobManager(store=store, default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="do stuff")
        await manager.cancel_job("user-001", job.job_id)
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(
                make_scripted_handler(['{"type":"final","response":"x"}'])
            ),
        )
        agent = Agent(
            manager=manager,
            tool_registry=DEFAULT_TOOLS,
            model_client=service,
            max_iterations=5,
            max_tool_calls=5,
        )
        try:
            return await agent.run(job=job, model="test-model", workspace=tmp_path)
        finally:
            await service.aclose()

    result = asyncio.run(scenario())
    assert result.status == "cancelled"
    assert result.iterations == 0


def test_agent_recovers_from_unparseable_decision(tmp_path):
    """A garbled JSON decision should prompt a retry, not kill the job."""
    result, final = run_agent(
        [
            '{"type":"document_search","x":1}',  # model put a tool in "type"
            '{"type":"final","response":"recovered"}',
        ],
        "do the thing",
        tmp_path,
    )
    assert result.status == "completed"
    assert result.response == "recovered"
    assert result.iterations == 2
    assert final.error is None


def test_agent_tolerates_tool_without_type(tmp_path):
    """A model may omit/garble 'type' but still supply a tool call."""
    result, final = run_agent(
        [
            '{"tool":"list_files","arguments":{}}',
            '{"type":"final","response":"done"}',
        ],
        "list files",
        tmp_path,
    )
    assert result.status == "completed"
    assert result.response == "done"
    assert tool_calls_in(final.execution_trace) == ["list_files"]


class FakeCodeExecutionTool(BaseTool):
    name = "code_execution"
    description = "test double for the sandbox"
    input_schema = {
        "type": "object",
        "properties": {"language": {"type": "string"}, "code": {"type": "string"}},
        "required": ["language", "code"],
        "additionalProperties": False,
    }

    async def execute(self, workspace: Path, arguments: dict) -> ToolResult:
        return ToolResult(ok=True, summary="ran ok")


def test_require_tool_success_blocks_an_unverified_final_answer(tmp_path):
    """A number the model asserts without running it is not accepted: the
    agent is steered back until code_execution actually succeeds."""

    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="compute something")
        script = [
            json.dumps({"type": "final", "response": "the answer is 42"}),
            json.dumps(
                {
                    "type": "tool_call",
                    "tool": "code_execution",
                    "arguments": {"language": "python", "code": "print(42)"},
                    "reasoning": "verify",
                }
            ),
            json.dumps({"type": "final", "response": "the answer is 42, verified by the sandbox"}),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([FakeCodeExecutionTool()]),
            model_client=service,
        )
        try:
            result = await agent.run(
                job,
                model="test-model",
                workspace=tmp_path,
                require_tool_success={"code_execution"},
                max_iterations=5,
                max_tool_calls=5,
            )
            final = await manager.get_job_for_worker(job.job_id)
            return result, final
        finally:
            await service.aclose()

    result, final = asyncio.run(scenario())
    assert result.status == AgentStatus.COMPLETED
    assert result.response == "the answer is 42, verified by the sandbox"
    assert result.iterations == 3
    assert tool_calls_in(final.execution_trace) == ["code_execution"]


class CountingSearchTool(BaseTool):
    name = "document_search"
    description = "test double for the knowledge base"
    input_schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}, "top_k": {"type": "integer"}},
        "required": ["query"],
        "additionalProperties": False,
    }

    def __init__(self):
        self.calls = 0

    async def execute(self, workspace: Path, arguments: dict) -> ToolResult:
        self.calls += 1
        return ToolResult(ok=True, summary="found 1 chunk", content="some passage")


def test_identical_consecutive_document_search_calls_are_deduped(tmp_path):
    """A model that repeats the exact same search (observed: top_k=1 called
    twice, identically) must not burn a second real lookup on it."""

    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="find the SOP")
        tool = CountingSearchTool()
        script = [
            json.dumps(
                {
                    "type": "tool_call",
                    "tool": "document_search",
                    "arguments": {"query": "pressure relief valve", "top_k": 1},
                    "reasoning": "search",
                }
            ),
            json.dumps(
                {
                    "type": "tool_call",
                    "tool": "document_search",
                    "arguments": {"query": "pressure relief valve", "top_k": 1},
                    "reasoning": "search again",
                }
            ),
            json.dumps({"type": "final", "response": "done"}),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([tool]),
            model_client=service,
            max_iterations=5,
            max_tool_calls=5,
        )
        try:
            result = await agent.run(job, model="test-model", workspace=tmp_path)
            final = await manager.get_job_for_worker(job.job_id)
            return result, final, tool
        finally:
            await service.aclose()

    result, final, tool = asyncio.run(scenario())
    assert result.status == AgentStatus.COMPLETED
    # The second, identical call was never actually executed against the KB.
    assert tool.calls == 1
    tool_results = [
        e for e in final.execution_trace if e["type"] == "tool_result" and e["tool"] == "document_search"
    ]
    assert len(tool_results) == 2
    assert tool_results[0]["ok"] is True
    assert tool_results[1]["ok"] is False
    assert "already called" in tool_results[1]["result_summary"]


def test_require_tool_success_gives_up_only_on_the_last_budgeted_turn(tmp_path):
    """A model that never calls the tool is re-prompted every turn but the
    budget check still terminates the loop deterministically (the node layer
    is responsible for not trusting this last-ditch, unverified answer)."""

    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="compute something")
        script = [
            json.dumps({"type": "final", "response": "the answer is 42"}),
            json.dumps({"type": "final", "response": "still 42, trust me"}),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([FakeCodeExecutionTool()]),
            model_client=service,
        )
        try:
            return await agent.run(
                job,
                model="test-model",
                workspace=tmp_path,
                require_tool_success={"code_execution"},
                max_iterations=2,
                max_tool_calls=5,
            )
        finally:
            await service.aclose()

    result = asyncio.run(scenario())
    # Exhausted the budget without ever verifying: the loop still terminates
    # (never hangs), but callers that need a hard guarantee (nodes.py compute)
    # must re-check the trace themselves rather than trust this status alone.
    assert result.status == AgentStatus.COMPLETED
    assert result.iterations == 2


class FakeSubmitFindingsTool(BaseTool):
    name = "submit_findings"
    description = "test double for a terminal typed-output tool"
    input_schema = {
        "type": "object",
        "properties": {"readings": {"type": "array"}},
        "required": [],
        "additionalProperties": True,
    }

    async def execute(self, workspace: Path, arguments: dict) -> ToolResult:
        return ToolResult(ok=True, summary="findings accepted")


class FakeSearchTool(BaseTool):
    name = "document_search"
    description = "test double for the knowledge base"
    input_schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
        "additionalProperties": False,
    }

    async def execute(self, workspace: Path, arguments: dict) -> ToolResult:
        return ToolResult(ok=True, summary="found nothing useful", content="")


def _capture_requested_tools(handler, sink: list):
    """Wrap a scripted handler to record each call's ``tools`` names, so a
    test can assert on what the model was actually allowed to call."""

    async def wrapped(request: httpx.Request) -> httpx.Response:
        if request.url.path in ("/api/chat", "/api/generate"):
            try:
                payload = json.loads(request.content.decode())
            except ValueError:
                payload = {}
            tools = payload.get("tools") or []
            sink.append(sorted(t["function"]["name"] for t in tools))
        return await handler(request)

    return wrapped


def test_terminal_tool_is_the_only_option_on_the_last_budgeted_turn(tmp_path):
    """A model that keeps answering in prose instead of calling the terminal
    tool gets that tool as its ONLY choice on the final allowed call, instead
    of a wide-open menu it can keep ignoring (the extract-node scenario:
    submit_findings never called across the whole iteration budget)."""

    captured: list[list[str]] = []

    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="extract readings")
        script = [
            json.dumps({"type": "final", "response": "I see some numbers"}),
            json.dumps({"type": "final", "response": "still no structured call"}),
            json.dumps(
                {
                    "type": "tool_call",
                    "tool": "submit_findings",
                    "arguments": {"readings": []},
                    "reasoning": "last chance",
                }
            ),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(
                _capture_requested_tools(make_scripted_handler(script), captured)
            ),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([FakeSubmitFindingsTool(), FakeSearchTool()]),
            model_client=service,
        )
        try:
            return await agent.run(
                job,
                model="test-model",
                workspace=tmp_path,
                terminal_tools={"submit_findings"},
                max_iterations=3,
                max_tool_calls=5,
            )
        finally:
            await service.aclose()

    result = asyncio.run(scenario())
    assert result.status == AgentStatus.COMPLETED
    assert "findings accepted" in result.response
    # The first two calls saw the full menu; only the narrowed, final call
    # saw submit_findings alone.
    assert captured == [
        ["document_search", "submit_findings"],
        ["document_search", "submit_findings"],
        ["submit_findings"],
    ]


def test_terminal_tool_narrowing_does_not_fire_before_the_last_turn(tmp_path):
    """Narrowing is specific to the single final allowed call; a model still
    has iterations left sees the ordinary full tool menu throughout."""

    captured: list[list[str]] = []

    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="extract readings")
        script = [
            json.dumps(
                {
                    "type": "tool_call",
                    "tool": "submit_findings",
                    "arguments": {"readings": []},
                    "reasoning": "first turn",
                }
            ),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(
                _capture_requested_tools(make_scripted_handler(script), captured)
            ),
        )
        agent = Agent(
            manager=manager,
            tool_registry=ToolRegistry([FakeSubmitFindingsTool(), FakeSearchTool()]),
            model_client=service,
        )
        try:
            return await agent.run(
                job,
                model="test-model",
                workspace=tmp_path,
                terminal_tools={"submit_findings"},
                max_iterations=5,
                max_tool_calls=5,
            )
        finally:
            await service.aclose()

    result = asyncio.run(scenario())
    assert result.status == AgentStatus.COMPLETED
    assert captured == [["document_search", "submit_findings"]]


def test_content_validator_steers_the_model_back_until_satisfied(tmp_path):
    """Generic content_validator hook: the caller decides what "enough"
    means (e.g. a word count) and gets a chance to nudge before a thin final
    answer is accepted, mirroring how require_tool_success works for tool
    calls rather than content."""

    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="write 500 words")
        script = [
            json.dumps({"type": "final", "response": "Too short."}),
            json.dumps({"type": "final", "response": "word " * 500}),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(manager=manager, tool_registry=DEFAULT_TOOLS, model_client=service)

        def validator(response: str, trace_segment: list[dict]):
            if len(response.split()) < 500:
                return "Too short, expand it."
            return None

        try:
            return await agent.run(
                job,
                model="test-model",
                workspace=tmp_path,
                content_validator=validator,
                max_iterations=5,
                max_tool_calls=5,
            )
        finally:
            await service.aclose()

    result = asyncio.run(scenario())
    assert result.status == AgentStatus.COMPLETED
    assert len(result.response.split()) >= 500
    assert result.iterations == 2


def test_content_validator_gives_up_only_on_the_last_budgeted_turn(tmp_path):
    async def scenario():
        manager = JobManager(store=InMemoryJobStore(), default_model="test-model")
        job = await manager.create_job(user_id="user-001", message="write 500 words")
        script = [
            json.dumps({"type": "final", "response": "still too short"}),
            json.dumps({"type": "final", "response": "still too short again"}),
        ]
        service = OllamaService(
            base_url="http://ollama.test",
            default_model="test-model",
            timeout_seconds=5,
            transport=httpx.MockTransport(make_scripted_handler(script)),
        )
        agent = Agent(manager=manager, tool_registry=DEFAULT_TOOLS, model_client=service)

        def validator(response: str, trace_segment: list[dict]):
            return None if len(response.split()) >= 500 else "too short"

        try:
            return await agent.run(
                job,
                model="test-model",
                workspace=tmp_path,
                content_validator=validator,
                max_iterations=2,
                max_tool_calls=5,
            )
        finally:
            await service.aclose()

    result = asyncio.run(scenario())
    # Exhausted the budget without ever satisfying the validator: the loop
    # still terminates (never hangs) and returns the model's last answer,
    # same soft-gate shape as require_tool_success.
    assert result.status == AgentStatus.COMPLETED
    assert result.iterations == 2
    assert result.response == "still too short again"
