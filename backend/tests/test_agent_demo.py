"""End-to-end agent demonstration (synthetic) plus running-job cancellation."""

import time
from pathlib import Path

from tests.conftest import make_scripted_handler, wait_for_job

DEMO_SCRIPT = [
    (
        '{"type":"tool_call","tool":"list_files","arguments":{},'
        '"reasoning":"Inspect the workspace files"}'
    ),
    (
        '{"type":"tool_call","tool":"read_file","arguments":{"path":"report.txt"},'
        '"reasoning":"Read the report to find the key findings"}'
    ),
    (
        '{"type":"tool_call","tool":"write_file",'
        '"arguments":{"path":"summary.txt","content":"Revenue grew 12% in Q3."},'
        '"reasoning":"Write a summary of the key findings"}'
    ),
    (
        '{"type":"final","response":"Created summary.txt with the key findings.",'
        '"reasoning":"Summary written"}'
    ),
]


def test_agent_demo_end_to_end(client_factory, app_settings):
    """Hackathon demo: inspect workspace -> read report -> write summary."""
    handler = make_scripted_handler(DEMO_SCRIPT, delay_seconds=0.2)
    with client_factory(handler) as c:
        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Inspect the files in my workspace, read the relevant report, "
                    "and create a summary.txt containing the key findings."
                )
            },
            headers={"X-User-ID": "user-001"},
        )
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]

        workspace = Path(app_settings.workspaces_root) / "user-001" / job_id
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and not workspace.exists():
            time.sleep(0.02)
        assert workspace.is_dir(), "the worker must create the job workspace"
        (workspace / "report.txt").write_text(
            "Revenue grew 12% in Q3. Costs declined 4%.", encoding="utf-8"
        )

        job = wait_for_job(c, job_id, "user-001", timeout=10)

    assert job["status"] == "completed"
    assert job["task_type"] == "general"
    assert job["response"]

    trace = job["execution_trace"]
    tool_calls = [t for t in trace if t["type"] == "tool_call"]
    assert [t["tool"] for t in tool_calls] == ["list_files", "read_file", "write_file"]

    tool_results = [t for t in trace if t["type"] == "tool_result"]
    assert [t["tool"] for t in tool_results] == ["list_files", "read_file", "write_file"]
    assert all(t["ok"] for t in tool_results)

    steps = [t["step"] for t in trace]
    assert steps == sorted(steps)
    assert len(set(steps)) == len(steps)

    assert job["tool_call_count"] == 3
    assert job["agent_stage"] == "completed"

    assert (workspace / "summary.txt").read_text(encoding="utf-8") == "Revenue grew 12% in Q3."


def test_cancel_running_job_stops_agent(client_factory):
    handler = make_scripted_handler(
        ['{"type":"tool_call","tool":"list_files","arguments":{}}'] * 20,
        delay_seconds=0.4,
    )
    with client_factory(handler) as c:
        resp = c.post(
            "/api/chat", json={"message": "do the thing"}, headers={"X-User-ID": "user-001"}
        )
        job_id = resp.json()["job_id"]

        time.sleep(0.2)  # let the worker pick the job up (RUNNING / first model call)

        cancel = c.delete(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-001"})
        assert cancel.status_code == 200
        assert cancel.json()["status"] == "cancelled"

        wait_for_job(c, job_id, "user-001", timeout=10)

        # The DELETE marks the job terminal immediately; the agent observes the
        # cancellation and stops slightly later. Wait for it to stop.
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            fresh = c.get(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-001"}).json()
            if fresh["agent_stage"] == "cancelled":
                job = fresh
                break
            time.sleep(0.02)
        else:
            job = fresh

    assert job["status"] == "cancelled"
    assert job["agent_stage"] == "cancelled"
    assert job["execution_trace"][-1]["type"] == "agent_cancelled"
