"""M6 integration: the full Cowork story over HTTP with persistent projects,
scoped file APIs, project-aware execution, code in the sandbox, and context
recording — everything except a real model (scripted + fake sandbox)."""

import json

from tests.conftest import FakeSandboxRunner, make_scripted_handler, ok_result, wait_for_job

HDR = {"X-User-ID": "user-001"}


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def test_cowork_end_to_end_build_modify_run(client_factory, tmp_path):
    """Create a project -> agent builds a file -> user inspects it -> second
    turn modifies/verifies by running code in the sandbox -> context recorded."""
    script = [
        # Turn 1 (general): draft writes the project file and reports.
        tool_call("write_file", {"path": "app.py", "content": "x = 1\n"}, "Create the helper file"),
        final("Created app.py with x = 1.", "done"),
        # Turn 2 (coding): compute runs the code, then draft inspects and reports.
        tool_call("code_execution", {"language": "python", "code": "print(21 * 2)"}, "Run a verification"),
        final("42", "verified in sandbox"),
        tool_call("read_file", {"path": "app.py"}, "Inspect the file I built"),
        final("The script prints 42.", "verified in sandbox"),
    ]
    runner = FakeSandboxRunner(results=[ok_result(stdout="42\n")])
    root = tmp_path / "projects"
    with client_factory(make_scripted_handler(script), sandbox_enabled=True, sandbox_runner=runner, project_root=root) as c:
        # create project
        pid = c.post("/api/projects", json={"name": "M6 Demo CLI"}, headers=HDR).json()["project_id"]

        # turn 1: build
        r1 = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "Please create a project helper file."},
            headers=HDR,
        )
        job1 = wait_for_job(c, r1.json()["job_id"], "user-001", timeout=15)
        assert job1["status"] == "completed", job1.get("error")

        # user inspects the file that now exists on disk and is served by the API
        content = c.get(f"/api/projects/{pid}/file", params={"path": "app.py"}, headers=HDR)
        assert content.status_code == 200
        assert "x = 1" in content.json()["content"]

        # turn 2: inspect + run in the sandbox
        r2 = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "Change the helper script so it computes 21 times 2 and run it."},
            headers=HDR,
        )
        job2 = wait_for_job(c, r2.json()["job_id"], "user-001", timeout=15)
        assert job2["status"] == "completed", job2.get("error")

        tools2 = [t["tool"] for t in job2["execution_trace"] if t["type"] == "tool_call"]
        assert "code_execution" in tools2
        assert len(runner.calls) == 1
        ok_results = [t for t in job2["execution_trace"] if t["type"] == "tool_result"]
        assert ok_results[-1]["ok"] is True

        # project file still intact across turns
        current = c.get(f"/api/projects/{pid}/file", params={"path": "app.py"}, headers=HDR).json()["content"]
        assert current.replace("\r\n", "\n") == "x = 1\n"

        # context recorded: messages for both turns, executions summarized
        ctx_dir = root / "user-001" / pid / ".cowork" / "context"
        messages = read_json(ctx_dir / "messages.json")
        assert [m["role"] for m in messages] == ["user", "assistant", "user", "assistant"]
        state = read_json(ctx_dir / "state.json")
        assert len(state["executions"]) == 2
        assert state["executions"][0]["files_touched"] == ["app.py"]
        assert any("42" in e.get("summary", "") for e in state["executions"])

        # history endpoint exposes the same data the IDE uses
        history = c.get(f"/api/projects/{pid}/history", headers=HDR).json()
        assert len(history["messages"]) == 4
        assert len(history["executions"]) == 2


def test_cowork_doc_generation_lands_in_project(client_factory, tmp_path):
    """A document-generation request inside a project writes the .docx under the
    project folder and the artifact is visible to the same user."""
    script = [
        tool_call(
            "document_generation",
            {
                "type": "word",
                "filename": "report.docx",
                "title": "Summary",
                "sections": [{"heading": "Findings", "content": "All good."}],
            },
            "Generate the report",
        ),
        final("Report generated.", "done"),
    ]
    root = tmp_path / "projects"
    with client_factory(make_scripted_handler(script), project_root=root) as c:
        pid = c.post("/api/projects", json={"name": "Report"}, headers=HDR).json()["project_id"]
        r = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "Please generate a short word document inside the project."},
            headers=HDR,
        )
        job = wait_for_job(c, r.json()["job_id"], "user-001", timeout=15)
        assert job["status"] == "completed", job.get("error")

        tree = c.get(f"/api/projects/{pid}/files", headers=HDR).json()["entries"]
        paths = [e["path"] for e in tree]
        assert any("report.docx" in p for p in paths)
        # artifact registered to the user (vault/summary surface)
        assert job["artifacts"] and job["artifacts"][0]["status"] == "completed"
