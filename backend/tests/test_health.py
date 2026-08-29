import httpx


def test_health_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["ollama"]["reachable"] is True
    assert body["ollama"]["url"] == "http://ollama.test"
    assert body["default_model"] == "test-model"


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
