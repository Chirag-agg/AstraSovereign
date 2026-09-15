"""Unit tests for the code_execution tool (fake runner) and the Docker
invocation (no Docker daemon required for these tests)."""

import asyncio
from pathlib import Path

import pytest

from app.services.sandbox_runner import (
    DockerSandboxRunner,
    ExecutionResult,
    SandboxRunnerError,
)
from app.services.tool_registry import ToolRegistry
from app.services.tools import CodeExecutionTool, ToolError
from tests.conftest import FakeSandboxRunner, ok_result


def make_tool(runner=None, max_stdout=100, max_stderr=100):
    return CodeExecutionTool(
        runner=runner or FakeSandboxRunner(),
        max_stdout_chars=max_stdout,
        max_stderr_chars=max_stderr,
    )


def run_tool(tool, args, workspace=Path(".")):
    return asyncio.run(tool.execute(workspace, args))


def test_code_execution_success(tmp_path):
    tool = make_tool(FakeSandboxRunner(results=[ok_result(stdout="6\n")]))
    result = run_tool(tool, {"language": "python", "code": "print(2 + 4)"}, tmp_path)
    assert result.ok
    assert "Exit code 0" in result.summary
    assert "6\n" in result.content


def test_syntax_error_returns_failure(tmp_path):
    tool = make_tool(
        FakeSandboxRunner(results=[ok_result(stderr="SyntaxError: invalid syntax", exit_code=1)])
    )
    result = run_tool(tool, {"language": "python", "code": "def broken(:"}, tmp_path)
    assert result.ok is False
    assert "SyntaxError" in result.content


def test_nonzero_exit_code(tmp_path):
    tool = make_tool(FakeSandboxRunner(results=[ok_result(exit_code=2)]))
    result = run_tool(tool, {"language": "python", "code": "import sys; sys.exit(2)"}, tmp_path)
    assert result.ok is False
    assert "Exit code 2" in result.summary


def test_timeout_returned(tmp_path):
    tool = make_tool(
        FakeSandboxRunner(results=[ok_result(timed_out=True, duration_ms=3000)])
    )
    result = run_tool(tool, {"language": "python", "code": "while True:\n    pass"}, tmp_path)
    assert result.ok is False
    assert "Timed out" in result.summary
    assert "timed_out=True" in result.content


def test_stdout_returned(tmp_path):
    tool = make_tool(FakeSandboxRunner(results=[ok_result(stdout="hello out\n")]))
    result = run_tool(tool, {"language": "python", "code": "print('hello out')"}, tmp_path)
    assert "hello out\n" in result.content


def test_stderr_returned(tmp_path):
    tool = make_tool(FakeSandboxRunner(results=[ok_result(stderr="boom\n", exit_code=1)]))
    result = run_tool(tool, {"language": "python", "code": "raise ValueError('boom')"}, tmp_path)
    assert "boom\n" in result.content


def test_stdout_limit_enforced(tmp_path):
    tool = make_tool(FakeSandboxRunner(results=[ok_result(stdout="x" * 500)]), max_stdout=20)
    result = run_tool(tool, {"language": "python", "code": "print('x'*500)"}, tmp_path)
    stdout_section = result.content.split("STDOUT:\n")[1].split("\nSTDERR:")[0]
    assert len(stdout_section) <= 20


def test_stderr_limit_enforced(tmp_path):
    tool = make_tool(FakeSandboxRunner(results=[ok_result(stderr="y" * 500, exit_code=1)]), max_stderr=15)
    result = run_tool(tool, {"language": "python", "code": "raise ValueError('y'*500)"}, tmp_path)
    stderr_section = result.content.split("STDERR:\n")[1]
    assert len(stderr_section) <= 15


def test_unsupported_language_rejected(tmp_path):
    tool = make_tool()
    with pytest.raises(ToolError, match="Unsupported language 'javascript'"):
        run_tool(tool, {"language": "javascript", "code": "console.log(1)"}, tmp_path)


def test_empty_code_rejected(tmp_path):
    tool = make_tool()
    with pytest.raises(ToolError, match="code must not be empty"):
        run_tool(tool, {"language": "python", "code": "   "}, tmp_path)


def test_runner_failure_represented_cleanly(tmp_path):
    tool = make_tool(FakeSandboxRunner(error=SandboxRunnerError("Docker is not available on this machine")))
    with pytest.raises(ToolError, match="code_execution failed"):
        run_tool(tool, {"language": "python", "code": "print(1)"}, tmp_path)


def test_malformed_arguments_rejected(tmp_path):
    registry = ToolRegistry([make_tool()])
    with pytest.raises(ToolError, match="Missing required argument: 'code'"):
        asyncio.run(registry.execute("code_execution", {"language": "python"}, tmp_path))
    with pytest.raises(ToolError, match="Unexpected argument"):
        asyncio.run(
            registry.execute(
                "code_execution",
                {"language": "python", "code": "print(1)", "bogus": 1},
                tmp_path,
            )
        )


def test_stdin_passed_to_runner(tmp_path):
    fake = FakeSandboxRunner(results=[ok_result(stdout="42\n")])
    tool = make_tool(fake)
    run_tool(tool, {"language": "python", "code": "import sys; print(sys.stdin.read())", "stdin": "42"}, tmp_path)
    assert fake.calls[0]["stdin"] == "42"


def test_docker_invocation_is_secure(tmp_path):
    runner = DockerSandboxRunner(cpu_limit="0.5", memory_limit="128m")
    args = runner.build_args(tmp_path, "sandbox-test")
    joined = " ".join(args)

    assert "--network" in args and args[args.index("--network") + 1] == "none"
    assert "--privileged" not in args
    assert "--read-only" in args
    assert "--cap-drop" in args and args[args.index("--cap-drop") + 1] == "ALL"
    assert "--security-opt" in args and "no-new-privileges" in args
    assert "--pids-limit" in args and args[args.index("--pids-limit") + 1] == "128"
    assert "--rm" in args
    assert "--cpus" in args and args[args.index("--cpus") + 1] == "0.5"
    assert "--memory" in args and args[args.index("--memory") + 1] == "128m"
    assert "docker.sock" not in joined
    assert "--workdir" in args
    # Only the temp code dir is mounted, read-only — never the app workspace.
    assert "--volume" in args
    volume = args[args.index("--volume") + 1]
    assert volume.endswith("/app:ro")
    assert str(tmp_path) in volume
    assert "workspaces" not in volume
    assert "--tmpfs" in args


def test_runner_has_no_host_execution_fallback():
    runner = DockerSandboxRunner()
    assert not hasattr(runner, "_local_fallback")
    assert not hasattr(runner, "_run_subprocess")
    assert not hasattr(runner, "_run_subprocess_sync")
