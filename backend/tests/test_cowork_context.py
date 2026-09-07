"""Tests for Cowork M3/M4: persistent context management and bounded
decision/execution summaries (no raw chain-of-thought stored)."""

import json
import os

from app.services.context import ContextManager
from app.services.projects import CoworkProjects

from tests.conftest import make_scripted_handler, wait_for_job


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


HDR = {"X-User-ID": "user-001"}


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def test_context_manager_persists_and_builds_request(tmp_path):
    projects = CoworkProjects(root=tmp_path / "projects")
    meta = projects.create_project("user-001", "Equip CLI")
    pid = meta.project_id
    projects.write_file("user-001", pid, "src/cli.py", "value = 1\n")
    ctx = ContextManager(projects)

    ctx.set_project_summary("user-001", pid, "A Python CLI for equipment monitoring.")
    ctx.set_active_task("user-001", pid, "Add CSV input support")
    ctx.add_decision("user-001", pid, "Use argparse", "Simple stdlib CLI parsing", source_job="job-1")
    ctx.add_user_message("user-001", pid, "Build the CLI skeleton.")
    ctx.add_assistant_message("user-001", pid, "Created src/cli.py.")

    ctx_dir = tmp_path / "projects" / "user-001" / pid / ".cowork" / "context"
    state = read_json(ctx_dir / "state.json")
    assert state["decisions"][0]["decision"] == "Use argparse"
    assert state["executions"] == []
    messages = read_json(ctx_dir / "messages.json")
    assert [m["role"] for m in messages] == ["user", "assistant"]

    request = ctx.build_request("user-001", pid, "Add auth to the CLI.")
    assert "Equip CLI" in request
    assert "CURRENT FILES ON DISK (authoritative)" in request
    assert "src/cli.py" in request
    assert "Use argparse" in request
    assert "Add CSV input support" in request
    assert "Build the CLI skeleton." in request
    assert "Add auth to the CLI." in request


def test_context_manager_compacts_history(tmp_path):
    projects = CoworkProjects(root=tmp_path / "projects")
    pid = projects.create_project("user-001", "Big project").project_id
    ctx = ContextManager(projects, max_messages=8, keep_messages=3)
    for i in range(20):
        ctx.add_user_message("user-001", pid, f"turn {i}")
        ctx.add_assistant_message("user-001", pid, f"reply {i}")

    ctx_dir = tmp_path / "projects" / "user-001" / pid / ".cowork" / "context"
    messages = read_json(ctx_dir / "messages.json")
    assert len(messages) <= 8
    state = read_json(ctx_dir / "state.json")
    assert state["archived_summary"]  # older turns were compacted, not lost


def test_cowork_context_recorded_after_runs(client_factory, tmp_path):
    script = [
        tool_call("write_file", {"path": "cli.py", "content": "value = 42\n"}, "Create the file"),
        final("Created cli.py with value = 42.", "done"),
        final("Everything is in place.", "done"),
    ]
    root = tmp_path / "projects"
    with client_factory(make_scripted_handler(script), project_root=root) as c:
        pid = c.post("/api/projects", json={"name": "persist"}, headers=HDR).json()["project_id"]

        r1 = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "Please create a project helper file."},
            headers=HDR,
        )
        job1 = wait_for_job(c, r1.json()["job_id"], "user-001", timeout=15)
        assert job1["status"] == "completed"

        r2 = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "Check the project now and report state."},
            headers=HDR,
        )
        job2 = wait_for_job(c, r2.json()["job_id"], "user-001", timeout=15)
        assert job2["status"] == "completed"

        ctx_dir = root / "user-001" / pid / ".cowork" / "context"
        assert (ctx_dir / "messages.json").exists()
        messages = read_json(ctx_dir / "messages.json")
        roles = [m["role"] for m in messages]
        assert roles == ["user", "assistant", "user", "assistant"]
        texts = " ".join(m["text"] for m in messages)
        assert "Please create a project helper file." in texts
        assert "Created cli.py" in texts

        state = read_json(ctx_dir / "state.json")
        assert len(state["executions"]) == 2
        last_execution = state["executions"][-1]
        assert "cli.py" in last_execution["files_touched"] or "cli.py" in " ".join(
            e.get("summary", "") for e in state["executions"]
        )
        # bounded: raw tool noise is never stored wholesale, only short summaries
        assert len(last_execution["summary"]) <= 600


def test_context_is_isolated_per_user(tmp_path):
    projects = CoworkProjects(root=tmp_path / "projects")
    pid = projects.create_project("user-001", "Private").project_id
    ctx = ContextManager(projects)
    ctx.add_user_message("user-001", pid, "secret plan")
    assert ctx.get_messages("user-002", pid) == []
    assert os.path.exists(tmp_path / "projects" / "user-001" / pid / ".cowork" / "context" / "messages.json")
