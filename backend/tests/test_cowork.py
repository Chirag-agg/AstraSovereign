"""Tests for Cowork M1 (projects + files) and M2 (project-aware execution).

Covers ownership/isolation, filesystem containment, text-only file rules, the
project mutation lock (409), and two Cowork chat turns sharing one project
folder so files persist across turns.
"""

import json

from tests.conftest import make_scripted_handler, wait_for_job

HDR = {"X-User-ID": "user-001"}
HDR2 = {"X-User-ID": "user-002"}


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


def make_project(client, name="Demo Project", headers=HDR):
    return client.post("/api/projects", json={"name": name}, headers=headers)


def test_project_crud_and_ownership(client_factory, tmp_path):
    handler = make_scripted_handler([final("ok", "r")])
    with client_factory(handler, project_root=tmp_path / "projects") as c:
        created = make_project(c)
        assert created.status_code == 201
        project = created.json()
        pid = project["project_id"]

        assert c.get("/api/projects", headers=HDR).status_code == 200
        listed = c.get("/api/projects", headers=HDR).json()
        assert [p["project_id"] for p in listed] == [pid]

        # ownership: user-002 cannot see or open user-001's project
        assert c.get("/api/projects", headers=HDR2).json() == []
        assert c.get(f"/api/projects/{pid}", headers=HDR2).status_code == 404
        assert c.delete(f"/api/projects/{pid}", headers=HDR2).status_code == 404

        assert c.delete(f"/api/projects/{pid}", headers=HDR).status_code == 204
        assert c.get(f"/api/projects/{pid}", headers=HDR).status_code == 404


def test_project_files_read_write_tree_and_containment(client_factory, tmp_path):
    handler = make_scripted_handler([final("ok", "r")])
    with client_factory(handler, project_root=tmp_path / "projects") as c:
        pid = make_project(c).json()["project_id"]

        put = c.put(
            f"/api/projects/{pid}/file",
            params={"path": "src/cli.py"},
            json={"content": "print('hi')\n"},
            headers=HDR,
        )
        assert put.status_code == 200

        got = c.get(f"/api/projects/{pid}/file", params={"path": "src/cli.py"}, headers=HDR)
        assert got.status_code == 200
        assert got.json()["content"] == "print('hi')\n"

        tree = c.get(f"/api/projects/{pid}/files", headers=HDR).json()["entries"]
        paths = [e["path"] for e in tree]
        assert "src/cli.py" in paths
        assert all(e["kind"] for e in tree)

        # escape attempts
        assert c.put(
            f"/api/projects/{pid}/file", params={"path": "../escape.py"}, json={"content": "x"}, headers=HDR
        ).status_code == 400
        assert c.put(
            f"/api/projects/{pid}/file", params={"path": "/etc/evil.py"}, json={"content": "x"}, headers=HDR
        ).status_code == 400
        assert c.get(f"/api/projects/{pid}/file", params={"path": "../../outside.txt"}, headers=HDR).status_code == 400

        # binary content rejected
        assert c.put(
            f"/api/projects/{pid}/file", params={"path": "bin.dat"}, json={"content": "a\x00b"}, headers=HDR
        ).status_code == 415

        assert c.delete(f"/api/projects/{pid}/file", params={"path": "src/cli.py"}, headers=HDR).status_code == 204
        assert c.get(f"/api/projects/{pid}/file", params={"path": "src/cli.py"}, headers=HDR).status_code == 404


def test_project_locked_while_running_blocks_file_mutation(client_factory, tmp_path):
    handler = make_scripted_handler([final("ok", "r")])
    with client_factory(handler, project_root=tmp_path / "projects") as c:
        pid = make_project(c).json()["project_id"]
        # simulate a running agent job holding the project lock
        c.app.state.project_locks.acquire("user-001", pid)
        resp = c.put(
            f"/api/projects/{pid}/file",
            params={"path": "note.txt"},
            json={"content": "hello"},
            headers=HDR,
        )
        assert resp.status_code == 409
        assert c.delete(f"/api/projects/{pid}/file", params={"path": "note.txt"}, headers=HDR).status_code == 409
        c.app.state.project_locks.release("user-001", pid)
        assert c.put(
            f"/api/projects/{pid}/file", params={"path": "note.txt"}, json={"content": "hi"}, headers=HDR
        ).status_code == 200


def test_cowork_chat_shares_project_folder_across_turns(client_factory, tmp_path):
    """Turn 1 writes a file into the project; turn 2 (same project) reads it."""
    script = [
        tool_call("write_file", {"path": "cli.py", "content": "value = 42\n"}, "Create the file"),
        final("Created cli.py.", "done"),
        tool_call("read_file", {"path": "cli.py"}, "Read the file I created earlier"),
        final("The file contains value = 42.", "done"),
    ]
    with client_factory(make_scripted_handler(script), project_root=tmp_path / "projects") as c:
        pid = make_project(c).json()["project_id"]

        r1 = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "Please create a project helper file."},
            headers=HDR,
        )
        assert r1.status_code == 202
        job1 = wait_for_job(c, r1.json()["job_id"], "user-001", timeout=15)
        assert job1["status"] == "completed", job1.get("error")

        # file persisted on disk in the project folder and readable via the API
        content = c.get(f"/api/projects/{pid}/file", params={"path": "cli.py"}, headers=HDR).json()["content"]
        assert "value = 42" in content

        r2 = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "Check what is stored in the workspace now and report it."},
            headers=HDR,
        )
        assert r2.status_code == 202
        job2 = wait_for_job(c, r2.json()["job_id"], "user-001", timeout=15)
        assert job2["status"] == "completed", job2.get("error")

        tool_calls = [t for t in job2["execution_trace"] if t["type"] == "tool_call"]
        assert tool_calls and tool_calls[0]["tool"] == "read_file"


def test_cowork_chat_rejects_other_users_project(client_factory, tmp_path):
    handler = make_scripted_handler([])
    with client_factory(handler, project_root=tmp_path / "projects") as c:
        pid = make_project(c).json()["project_id"]
        resp = c.post(
            "/api/cowork/chat",
            json={"project_id": pid, "message": "hi"},
            headers=HDR2,
        )
        assert resp.status_code == 404
