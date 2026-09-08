"""End-to-end demonstrations: the agent generates code, executes it in the
sandbox, observes the result, and completes. Uses a scripted model + fake
sandbox runner so the demos are fully deterministic (no Docker required)."""

import json

from tests.conftest import FakeSandboxRunner, make_scripted_handler, ok_result, wait_for_job


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


def test_agent_calls_code_execution_and_completes(client_factory, tmp_path):
    """Agent can invoke code_execution and receive a structured result."""
    script = [
        tool_call(
            "code_execution",
            {"language": "python", "code": "print(2 + 2)"},
            "Compute 2+2",
        ),
        final("The result is 4.", "Verified from stdout"),
    ]
    runner = FakeSandboxRunner(results=[ok_result(stdout="4\n")])
    with client_factory(make_scripted_handler(script), sandbox_enabled=True, sandbox_runner=runner) as c:
        resp = c.post("/api/chat", json={"message": "write code to compute 2+2 and run it"}, headers={"X-User-ID": "user-001"})
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "4" in job["response"]
    trace = job["execution_trace"]
    tool_calls = [t for t in trace if t["type"] == "tool_call"]
    assert [t["tool"] for t in tool_calls] == ["code_execution"]
    assert len(runner.calls) == 1


def test_demo_factorial(client_factory, tmp_path):
    """Killer test: write code for factorial(10), run it, verify, report."""
    script = [
        tool_call(
            "code_execution",
            {"language": "python", "code": "import math\nprint(math.factorial(10))"},
            "Compute factorial(10)",
        ),
        final(
            "The factorial of 10 is 3628800.",
            "The program printed 3628800, which is correct.",
        ),
    ]
    runner = FakeSandboxRunner(results=[ok_result(stdout="3628800\n")])
    with client_factory(make_scripted_handler(script), sandbox_enabled=True, sandbox_runner=runner) as c:
        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Write a Python program that calculates the factorial of 10, "
                    "execute it, verify the result, and report the answer."
                )
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "3628800" in job["response"]

    trace = job["execution_trace"]
    tool_calls = [t for t in trace if t["type"] == "tool_call"]
    assert [t["tool"] for t in tool_calls] == ["code_execution"]
    results = [t for t in trace if t["type"] == "tool_result"]
    assert results[-1]["ok"] is True
    assert "Exit code 0" in results[-1]["result_summary"]
    assert len(runner.calls) == 1


def test_demo_bug_fix_loop(client_factory, tmp_path):
    """Agent writes buggy code, observes the error, fixes it, and runs again."""
    script = [
        tool_call(
            "code_execution",
            {"language": "python", "code": "print(1 / 0)"},
            "Run the initial attempt",
        ),
        tool_call(
            "code_execution",
            {"language": "python", "code": "print(15)"},
            "Fix the division-by-zero bug",
        ),
        final("The corrected result is 15.", "The fixed program printed 15."),
    ]
    runner = FakeSandboxRunner(
        results=[
            ok_result(stderr="ZeroDivisionError: division by zero", exit_code=1),
            ok_result(stdout="15\n"),
        ]
    )
    with client_factory(make_scripted_handler(script), sandbox_enabled=True, sandbox_runner=runner) as c:
        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Write a Python program containing an intentional bug, execute "
                    "it, inspect the error, fix it, and run it again."
                )
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "15" in job["response"]

    trace = job["execution_trace"]
    tool_calls = [t for t in trace if t["type"] == "tool_call"]
    assert [t["tool"] for t in tool_calls] == ["code_execution", "code_execution"]
    assert len(runner.calls) == 2
    assert runner.calls[0]["code"] != runner.calls[1]["code"]
    # First run failed (ZeroDivisionError), second succeeded.
    results = [t for t in trace if t["type"] == "tool_result"]
    assert results[0]["ok"] is False
    assert results[1]["ok"] is True
