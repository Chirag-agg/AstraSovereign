"""Development admin API tests: role gate, real data, privacy boundaries."""

import pytest

from tests.conftest import make_scripted_handler, wait_for_job

ADMIN = {"X-User-ID": "user-001", "X-Role": "admin"}
USER = {"X-User-ID": "user-001"}


def test_admin_endpoints_require_dev_admin_role(client):
    # without the dev admin header -> 403 (not real auth, but an explicit boundary)
    assert client.get("/api/admin/overview", headers=USER).status_code == 403
    assert client.get("/api/admin/jobs", headers=USER).status_code == 403
    assert client.get("/api/admin/audit", headers=USER).status_code == 403
    overview = client.get("/api/admin/overview", headers=ADMIN)
    assert overview.status_code == 200


def test_admin_overview_reflects_real_state(client):
    body = client.get("/api/admin/overview", headers=ADMIN).json()
    assert "jobs" in body and "total" in body["jobs"]
    assert "models_available" in body
    assert "scheduler" in body
    assert "sovereignty" in body
    assert body["sovereignty"]["network_policy"] == "LOCAL_ONLY"


def test_admin_jobs_and_detail_exclude_private_content(client_factory):
    script = ['{"type":"final","response":"classified answer"}']
    with client_factory(make_scripted_handler(script)) as c:
        resp = c.post(
            "/api/chat",
            json={"message": "SECRET PROMPT"},
            headers={"X-User-ID": "user-002"},
        )
        wait_for_job(c, resp.json()["job_id"], "user-002", timeout=10)
        jobs = c.get("/api/admin/jobs", headers=ADMIN).json()
        job = jobs[0]
        detail = c.get(f"/api/admin/jobs/{job['job_id']}", headers=ADMIN).json()

    assert any(j["user_id"] == "user-002" for j in jobs)  # cross-user visibility
    assert "message" not in detail
    assert "response" not in detail
    assert "SECRET PROMPT" not in str(jobs)
    assert "classified answer" not in str(jobs)
    assert isinstance(detail["execution_trace"], list)


def test_admin_users_models_resources_knowledge_system(client):
    assert client.get("/api/admin/users", headers=ADMIN).status_code == 200
    users = client.get("/api/admin/users", headers=ADMIN).json()
    assert any(u["user_id"] == "user-001" for u in users)
    assert all("documents" in u and "artifacts" in u and "jobs" in u for u in users)

    models = client.get("/api/admin/models", headers=ADMIN).json()
    assert models and "task_type" in models[0] and "model" in models[0]

    resources = client.get("/api/admin/resources", headers=ADMIN).json()
    assert "capacity" in resources and "allocated" in resources

    kb = client.get("/api/admin/knowledge", headers=ADMIN).json()
    assert "documents" in kb

    system = client.get("/api/admin/system", headers=ADMIN).json()
    assert system["ollama"] in ("HEALTHY", "DEGRADED", "UNAVAILABLE", "UNKNOWN")
    assert system["sandbox_network"] == "DISABLED"


def test_admin_audit_filters(client_factory):
    script = ['{"type":"final","response":"ok"}']
    with client_factory(make_scripted_handler(script)) as c:
        resp = c.post("/api/chat", json={"message": "hi"}, headers={"X-User-ID": "user-001"})
        wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)
        all_events = c.get("/api/admin/audit", headers=ADMIN).json()
        filtered = c.get(
            "/api/admin/audit?user_id=user-001&event_type=JOB_COMPLETED", headers=ADMIN
        ).json()

    assert any(e["event_type"] == "JOB_COMPLETED" for e in all_events)
    assert filtered and all(e["event_type"] == "JOB_COMPLETED" for e in filtered)
    assert all(e["user_id"] == "user-001" for e in filtered)


def test_regular_user_api_remains_scoped(client_factory):
    script = ['{"type":"final","response":"ok"}']
    with client_factory(make_scripted_handler(script)) as c:
        c.post("/api/chat", json={"message": "mine"}, headers={"X-User-ID": "user-001"})
        other = c.get("/api/jobs", headers={"X-User-ID": "user-002"}).json()
        audit = c.get("/api/audit", headers={"X-User-ID": "user-002"}).json()
    assert other == []
    assert audit == []
