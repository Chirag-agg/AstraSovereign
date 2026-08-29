import json

import httpx


def test_chat_success(client):
    resp = client.post("/api/chat", json={"message": "Hello"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["model"] == "test-model"
    assert "mocked reply" in body["response"]


def test_chat_rejects_empty_message(client):
    resp = client.post("/api/chat", json={"message": "   "})
    assert resp.status_code == 422


def test_chat_rejects_missing_message(client):
    resp = client.post("/api/chat", json={})
    assert resp.status_code == 422


def test_chat_ollama_unavailable(client_factory):
    def down_handler(request):
        raise httpx.ConnectError("connection refused")

    with client_factory(down_handler) as c:
        resp = c.post("/api/chat", json={"message": "Hello"})
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"] == "ollama_unavailable"


def test_chat_model_not_found(client_factory):
    def missing_handler(request):
        return httpx.Response(404, json={"error": "model 'test-model' not found"})

    with client_factory(missing_handler) as c:
        resp = c.post("/api/chat", json={"message": "Hello"})
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"] == "model_not_found"


def test_chat_timeout(client_factory):
    def timeout_handler(request):
        raise httpx.ReadTimeout("timed out")

    with client_factory(timeout_handler) as c:
        resp = c.post("/api/chat", json={"message": "Hello"})
    assert resp.status_code == 504
    assert resp.json()["detail"]["error"] == "ollama_timeout"


def test_chat_bad_ollama_payload(client_factory):
    def bad_handler(request):
        return httpx.Response(200, json={"unexpected": "shape"})

    with client_factory(bad_handler) as c:
        resp = c.post("/api/chat", json={"message": "Hello"})
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"] == "ollama_request_error"


def test_chat_ollama_internal_error(client_factory):
    def error_handler(request):
        return httpx.Response(500, json={"error": "internal"})

    with client_factory(error_handler) as c:
        resp = c.post("/api/chat", json={"message": "Hello"})
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"] == "ollama_request_error"
