import httpx

from tests.conftest import wait_for_job


def _submit_and_wait(client, message="Hello"):
    resp = client.post("/api/chat", json={"message": message}, headers={"X-User-ID": "user-001"})
    job_id = resp.json()["job_id"]
    return wait_for_job(client, job_id, "user-001")


def test_worker_fails_job_when_ollama_down(client_factory):
    def down_handler(request):
        raise httpx.ConnectError("connection refused")

    with client_factory(down_handler) as c:
        job = _submit_and_wait(c)
    assert job["status"] == "failed"
    assert "OllamaUnavailableError" in job["error"]
    assert job["response"] is None


def test_worker_fails_job_when_model_missing(client_factory):
    def missing_handler(request):
        return httpx.Response(404, json={"error": "model not found"})

    with client_factory(missing_handler) as c:
        job = _submit_and_wait(c)
    assert job["status"] == "failed"
    assert "OllamaModelNotFoundError" in job["error"]


def test_worker_fails_job_on_timeout(client_factory):
    def timeout_handler(request):
        raise httpx.ReadTimeout("timed out")

    with client_factory(timeout_handler) as c:
        job = _submit_and_wait(c)
    assert job["status"] == "failed"
    assert "OllamaTimeoutError" in job["error"]


def test_worker_fails_job_on_bad_ollama_payload(client_factory):
    def bad_handler(request):
        return httpx.Response(200, json={"unexpected": "shape"})

    with client_factory(bad_handler) as c:
        job = _submit_and_wait(c)
    assert job["status"] == "failed"
    assert "OllamaRequestError" in job["error"]


def test_failed_jobs_are_reported_in_health(client_factory):
    def down_handler(request):
        raise httpx.ConnectError("connection refused")

    with client_factory(down_handler) as c:
        job = _submit_and_wait(c)
        health = c.get("/health").json()
    assert job["status"] == "failed"
    assert health["jobs"]["failed"] == 1
    assert health["jobs"]["total"] == 1
