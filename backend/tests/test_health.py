import httpx

from tests.conftest import wait_for_job


def test_health_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["ollama"]["reachable"] is True
    assert body["ollama"]["url"] == "http://ollama.test"
    assert body["default_model"] == "test-model"
    assert body["queue_size"] == 0
    assert body["jobs"] == {
        "total": 0,
        "queued": 0,
        "running": 0,
        "completed": 0,
        "failed": 0,
        "cancelled": 0,
    }
    assert body["worker"]["state"] in ("idle", "running")
    assert body["models"]["general"] == {
        "configured": "test-model",
        "available": True,
        "enabled": True,
    }
    assert body["models"]["coding"] == {
        "configured": "coder-model",
        "available": True,
        "enabled": True,
    }
    assert body["models"]["document"]["available"] is False
    assert body["models"]["document"]["enabled"] is False
    assert body["models"]["vision"]["available"] is False
    assert body["models"]["vision"]["enabled"] is False
    assert body["models_missing"] == []
    assert body["models_resolved"]["general"]["effective"] == "test-model"
    assert body["models_resolved"]["general"]["fallback_active"] is False


def test_health_reports_ollama_down(client_factory):
    def down_handler(request):
        raise httpx.ConnectError("connection refused")

    with client_factory(down_handler) as c:
        resp = c.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["ollama"]["reachable"] is False
    assert "error" in body["ollama"]
    assert all(
        not m["available"] for m in body["models"].values()
    )


def test_health_reports_job_stats(client):
    resp = client.post("/api/chat", json={"message": "Hello"}, headers={"X-User-ID": "user-001"})
    job_id = resp.json()["job_id"]
    wait_for_job(client, job_id)

    body = client.get("/health").json()
    assert body["jobs"]["total"] == 1
    assert body["jobs"]["completed"] == 1
    assert body["queue_size"] == 0


def test_cors_allows_frontend_origin(client):
    headers = {"Origin": "http://localhost:3000"}
    resp = client.options(
        "/api/chat",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-user-id",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"

    resp = client.get("/health", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_rejects_unknown_origin(client):
    resp = client.get("/health", headers={"Origin": "http://evil.example"})
    assert resp.headers.get("access-control-allow-origin") is None


def test_health_preflight_reports_missing_models(client_factory, success_ollama_handler):
    models = {
        "general": {
            "provider": "ollama",
            "model": "ghost-model",
            "enabled": True,
            "capabilities": ["general", "reasoning"],
        },
        "coding": {
            "provider": "ollama",
            "model": "coder-model",
            "enabled": True,
            "capabilities": ["coding"],
        },
    }
    with client_factory(success_ollama_handler, models=models) as c:
        body = c.get("/health").json()
        assert body["models"]["general"]["available"] is False
        assert body["models"]["coding"]["available"] is True
        assert body["models_missing"] == [{"task_type": "general", "model": "ghost-model"}]
