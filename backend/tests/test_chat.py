import time

from tests.conftest import wait_for_job


def test_chat_submits_job_and_returns_queued(client):
    resp = client.post("/api/chat", json={"message": "Hello"})
    assert resp.status_code == 202
    body = resp.json()
    assert body["job_id"].startswith("job-")
    assert body["status"] == "queued"


def test_chat_job_completes_with_model_response(client):
    resp = client.post("/api/chat", json={"message": "Hello"})
    job_id = resp.json()["job_id"]
    job = wait_for_job(client, job_id)
    assert job["status"] == "completed"
    assert job["model"] == "test-model"
    assert job["response"] == "mocked reply to: Hello"


def test_chat_default_user_fallback(client):
    resp = client.post("/api/chat", json={"message": "Hello"})
    job_id = resp.json()["job_id"]
    job = wait_for_job(client, job_id)
    assert job["user_id"] == "user-001"


def test_chat_accepts_task_type_and_priority(client):
    resp = client.post(
        "/api/chat",
        json={"message": "Hello", "task_type": "summarization", "priority": 5},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    job = wait_for_job(client, job_id)
    assert job["task_type"] == "summarization"
    assert job["priority"] == 5


def test_chat_rejects_empty_message(client):
    resp = client.post("/api/chat", json={"message": "   "})
    assert resp.status_code == 422


def test_chat_rejects_missing_message(client):
    resp = client.post("/api/chat", json={})
    assert resp.status_code == 422


def test_chat_does_not_wait_for_model(client_factory, delayed_ollama_handler):
    slow = delayed_ollama_handler(1.0)
    with client_factory(slow) as c:
        start = time.monotonic()
        resp = c.post("/api/chat", json={"message": "slow"}, headers={"X-User-ID": "user-001"})
        elapsed = time.monotonic() - start
        assert resp.status_code == 202
        assert resp.json()["status"] == "queued"
        assert elapsed < 0.5
