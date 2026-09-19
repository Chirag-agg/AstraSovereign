"""Unit tests for code_execution's internal auto-repair loop (fake runner,
fake repair-model client — no Docker, no Ollama required)."""

import asyncio
from pathlib import Path

import pytest

from app.services.tools import CodeExecutionTool, ToolError
from tests.conftest import FakeSandboxRunner, ok_result


class FakeRepairClient:
    """Scriptable stand-in for OllamaService.generate(), used only by the
    repair loop (single-turn, no tools)."""

    def __init__(self, responses=None, error=None):
        self.responses = list(responses or [])
        self.error = error
        self.calls: list[str] = []

    async def generate(self, prompt, model=None, format=None):
        self.calls.append(prompt)
        if self.error:
            raise self.error
        if not self.responses:
            raise AssertionError("repair model called more times than scripted")
        return self.responses.pop(0), model


def make_tool(
    runner=None,
    repair_client=None,
    repair_model="coder-model",
    max_repair_attempts=2,
    repair_deadline_seconds=90.0,
    max_stdout=4096,
    max_stderr=4096,
):
    return CodeExecutionTool(
        runner=runner or FakeSandboxRunner(),
        max_stdout_chars=max_stdout,
        max_stderr_chars=max_stderr,
        repair_model_client=repair_client,
        repair_model=repair_model if repair_client is not None else None,
        max_repair_attempts=max_repair_attempts,
        repair_deadline_seconds=repair_deadline_seconds,
    )


def run_tool(tool, args, workspace=Path(".")):
    return asyncio.run(tool.execute(workspace, args))


def test_repair_succeeds_on_second_attempt(tmp_path):
    runner = FakeSandboxRunner(
        results=[
            ok_result(stderr="ZeroDivisionError: division by zero", exit_code=1),
            ok_result(stdout="15\n"),
        ]
    )
    repair = FakeRepairClient(responses=["print(15)"])
    tool = make_tool(runner=runner, repair_client=repair)
    result = run_tool(tool, {"language": "python", "code": "print(1 / 0)"}, tmp_path)

    assert result.ok is True
    assert "fixed after 2 attempts" in result.summary
    assert len(runner.calls) == 2
    assert runner.calls[0]["code"] != runner.calls[1]["code"]
    assert len(repair.calls) == 1


def test_successful_final_attempt_content_survives_truncation(tmp_path):
    """MAX_OBSERVATION_CHARS truncates from the front, keeping the start and
    cutting the end — so the decisive final attempt must come first in the
    tool's own content, not last, or it gets truncated away upstream."""
    long_stdout = "x" * 5000  # exceeds MAX_OBSERVATION_CHARS (4000) on its own
    runner = FakeSandboxRunner(
        results=[
            ok_result(stderr="NameError: name 'x' is not defined", exit_code=1),
            ok_result(stdout=long_stdout),
        ]
    )
    repair = FakeRepairClient(responses=["print('x' * 5000)"])
    tool = make_tool(runner=runner, repair_client=repair, max_stdout=6000, max_stderr=6000)
    result = run_tool(tool, {"language": "python", "code": "print(x)"}, tmp_path)

    assert result.ok is True
    # The successful attempt's real output is at the START of content.
    assert result.content.startswith("exit_code=0")
    assert long_stdout in result.content[:5100]
    assert "earlier failed attempt" in result.content


def test_all_repair_attempts_exhausted_reports_last_real_failure(tmp_path):
    runner = FakeSandboxRunner(
        results=[
            ok_result(stderr="err 1", exit_code=1),
            ok_result(stderr="err 2", exit_code=1),
            ok_result(stderr="err 3", exit_code=1),
        ]
    )
    repair = FakeRepairClient(responses=["attempt 2 code", "attempt 3 code"])
    tool = make_tool(runner=runner, repair_client=repair, max_repair_attempts=2)
    result = run_tool(tool, {"language": "python", "code": "broken()"}, tmp_path)

    assert result.ok is False
    assert "err 3" in result.content
    assert len(runner.calls) == 3  # original + 2 repair attempts, budget spent
    assert len(repair.calls) == 2


def test_wall_clock_deadline_stops_the_loop(tmp_path):
    """A deadline of 0s means any real elapsed time exceeds it, so the loop
    must stop after the first (already-run) attempt without ever proposing a
    fix — exercised with the real clock rather than a faked one, since
    time.monotonic() is also used by asyncio's own internals and faking it
    globally makes the event loop itself misbehave."""
    runner = FakeSandboxRunner(
        results=[ok_result(stderr="err 1", exit_code=1), ok_result(stdout="ok\n")]
    )
    repair = FakeRepairClient(responses=["fixed code"])
    tool = make_tool(runner=runner, repair_client=repair, repair_deadline_seconds=0.0)

    result = run_tool(tool, {"language": "python", "code": "broken()"}, tmp_path)

    assert result.ok is False
    assert "err 1" in result.content
    assert len(runner.calls) == 1  # never got a chance to repair
    assert len(repair.calls) == 0


def test_repair_model_failure_degrades_to_last_real_result(tmp_path):
    runner = FakeSandboxRunner(results=[ok_result(stderr="err 1", exit_code=1)])
    repair = FakeRepairClient(error=RuntimeError("repair model unreachable"))
    tool = make_tool(runner=runner, repair_client=repair)
    result = run_tool(tool, {"language": "python", "code": "broken()"}, tmp_path)

    assert result.ok is False
    assert "err 1" in result.content
    assert len(runner.calls) == 1


def test_identical_code_short_circuits(tmp_path):
    runner = FakeSandboxRunner(
        results=[ok_result(stderr="err", exit_code=1), ok_result(stderr="err", exit_code=1)]
    )
    # Repair model returns the exact same (broken) code back — a no-op fix.
    repair = FakeRepairClient(responses=["broken()"])
    tool = make_tool(runner=runner, repair_client=repair)
    result = run_tool(tool, {"language": "python", "code": "broken()"}, tmp_path)

    assert result.ok is False
    assert len(runner.calls) == 1  # stopped before re-running the identical code
    assert len(repair.calls) == 1


def test_repair_disabled_matches_pre_repair_behavior_exactly(tmp_path):
    runner = FakeSandboxRunner(results=[ok_result(stderr="boom", exit_code=1)])
    tool = make_tool(runner=runner, repair_client=None)  # no repair wired at all
    result = run_tool(tool, {"language": "python", "code": "broken()"}, tmp_path)

    assert result.ok is False
    assert result.summary == "Exit code 1 in 10ms\nboom"
    assert result.content == (
        "exit_code=1 timed_out=False duration_ms=10\n"
        "STDOUT:\n\n"
        "STDERR:\nboom"
    )
    assert len(runner.calls) == 1


def test_repair_strips_markdown_code_fences(tmp_path):
    runner = FakeSandboxRunner(
        results=[ok_result(stderr="err", exit_code=1), ok_result(stdout="ok\n")]
    )
    repair = FakeRepairClient(responses=["```python\nprint('ok')\n```"])
    tool = make_tool(runner=runner, repair_client=repair)
    run_tool(tool, {"language": "python", "code": "broken()"}, tmp_path)

    assert runner.calls[1]["code"] == "print('ok')"


def test_infra_failure_on_first_attempt_still_raises(tmp_path):
    from app.services.sandbox_runner import SandboxRunnerError

    runner = FakeSandboxRunner(error=SandboxRunnerError("docker unavailable"))
    repair = FakeRepairClient(responses=["irrelevant"])
    tool = make_tool(runner=runner, repair_client=repair)
    with pytest.raises(ToolError):
        run_tool(tool, {"language": "python", "code": "print(1)"}, tmp_path)
