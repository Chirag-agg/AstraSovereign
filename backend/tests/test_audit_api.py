"""Audit + sovereignty API tests: user isolation, job audit, real status (Phase 11)."""

from tests.conftest import make_scripted_handler, wait_for_job


def test_sovereignty_endpoint_reflects_real_state(client):
    body = client.get("/api/sovereignty").json()
    assert body["network_policy"] == "LOCAL_ONLY"
    assert body["audit_logging"] is True
    assert body["sandbox_network"] == "DISABLED"
    # real counts, never fabricated: status is either verified-local (health
    # polling already made local calls) or unknown, and external count is 0
    assert body["external_connections"]["status"] in ("VERIFIED_LOCAL", "UNKNOWN")
    assert body["external_connections"]["count"] == 0
    assert isinstance(body["local_model_calls"], int)


def test_health_includes_sovereignty(client):
    body = client.get("/health").json()
    assert "sovereignty" in body
    assert body["sovereignty"]["network_policy"] == "LOCAL_ONLY"
    assert "external_connections" in body["sovereignty"]


def test_audit_api_returns_only_caller_events(client_factory, app_settings):
    script = ['{"type":"final","response":"ok"}']
    with client_factory(make_scripted_handler(script)) as c:
        resp = c.post(
            "/api/chat", json={"message": "hello"}, headers={"X-User-ID": "user-001"}
        )
        wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

        own = c.get("/api/audit", headers={"X-User-ID": "user-001"}).json()
        other = c.get("/api/audit", headers={"X-User-ID": "user-002"}).json()

    assert len(own) >= 2  # JOB_CREATED + JOB_COMPLETED (+ model events)
    assert all(e["user_id"] == "user-001" for e in own)
    assert other == []


def test_audit_api_job_filter(client_factory, app_settings):
    script = ['{"type":"final","response":"ok"}']
    with client_factory(make_scripted_handler(script)) as c:
        resp = c.post(
            "/api/chat", json={"message": "hello"}, headers={"X-User-ID": "user-001"}
        )
        job_id = resp.json()["job_id"]
        wait_for_job(c, job_id, "user-001", timeout=10)
        filtered = c.get(f"/api/audit?job_id={job_id}", headers={"X-User-ID": "user-001"}).json()

    assert filtered
    assert all(e["job_id"] == job_id for e in filtered)


def test_audit_api_excludes_sensitive_payloads(client_factory, app_settings):
    script = ['{"type":"final","response":"classified answer"}']
    with client_factory(make_scripted_handler(script)) as c:
        resp = c.post(
            "/api/chat",
            json={"message": "SECRET-QUESTION-123"},
            headers={"X-User-ID": "user-001"},
        )
        wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)
        raw = c.get("/api/audit", headers={"X-User-ID": "user-001"}).text

    assert "SECRET-QUESTION-123" not in raw
    assert "classified answer" not in raw


def test_job_audit_endpoint_ownership(client_factory, app_settings):
    script = ['{"type":"final","response":"ok"}']
    with client_factory(make_scripted_handler(script)) as c:
        resp = c.post(
            "/api/chat", json={"message": "hello"}, headers={"X-User-ID": "user-001"}
        )
        job_id = resp.json()["job_id"]
        wait_for_job(c, job_id, "user-001", timeout=10)

        own = c.get(f"/api/jobs/{job_id}/audit", headers={"X-User-ID": "user-001"})
        forbidden = c.get(f"/api/jobs/{job_id}/audit", headers={"X-User-ID": "user-002"})
        missing = c.get("/api/jobs/job-nope/audit", headers={"X-User-ID": "user-001"})

    assert own.status_code == 200
    assert all(e["job_id"] == job_id for e in own.json())
    assert forbidden.status_code == 403
    assert missing.status_code == 404
