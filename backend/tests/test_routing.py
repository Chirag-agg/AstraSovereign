"""Integration tests: jobs are classified and routed to configured models."""

from tests.conftest import make_ollama_handler, wait_for_job


def _submit(client, message, user_id="user-001"):
    resp = client.post("/api/chat", json={"message": message}, headers={"X-User-ID": user_id})
    assert resp.status_code == 202
    return resp.json()["job_id"]


def test_general_request_routes_to_general_model(client):
    job_id = _submit(client, "Explain how a heat exchanger works.")
    job = wait_for_job(client, job_id)
    assert job["status"] == "completed"
    assert job["task_type"] == "general"
    assert job["model"] == "test-model"


def test_coding_request_routes_to_coding_model(client):
    job_id = _submit(client, "write a Python function to reverse a string")
    job = wait_for_job(client, job_id)
    assert job["status"] == "completed"
    assert job["task_type"] == "coding"
    assert job["model"] == "coder-model"


def test_code_snippet_routes_to_coding_model(client):
    job_id = _submit(client, "```python\nprint('hi')\n```")
    job = wait_for_job(client, job_id)
    assert job["status"] == "completed"
    assert job["task_type"] == "coding"
    assert job["model"] == "coder-model"


def test_two_jobs_route_to_two_different_models(client):
    general_id = _submit(client, "Explain heat transfer.")
    coding_id = _submit(client, "debug this python code")
    general_job = wait_for_job(client, general_id)
    coding_job = wait_for_job(client, coding_id)

    assert general_job["task_type"] == "general"
    assert general_job["model"] == "test-model"
    assert coding_job["task_type"] == "coding"
    assert coding_job["model"] == "coder-model"
    assert general_job["model"] != coding_job["model"]


def test_job_stores_selected_task_type_and_model(client):
    job_id = _submit(client, "fix this bug in my Python script")
    job = wait_for_job(client, job_id)
    assert job["task_type"] == "coding"
    assert job["model"] == "coder-model"


def test_disabled_model_fails_job_cleanly(client_factory, test_models, available_models):
    handler = make_ollama_handler(available_models)
    with client_factory(handler) as c:
        job_id = _submit(c, "summarize this document")
        job = wait_for_job(c, job_id)
    assert job["status"] == "failed"
    assert job["task_type"] == "document"
    assert "model_routing_error" in job["error"]
    assert "disabled" in job["error"]


def test_missing_model_config_fails_job_cleanly(client_factory, test_models):
    models = {k: v for k, v in test_models.items() if k != "vision"}
    handler = make_ollama_handler({"test-model", "coder-model"})
    with client_factory(handler, models=models) as c:
        job_id = _submit(c, "describe what is in this image")
        job = wait_for_job(c, job_id)
    assert job["status"] == "failed"
    assert job["task_type"] == "vision"
    assert "model_routing_error" in job["error"]
    assert "No model configured for task type 'vision'" in job["error"]


def test_configured_but_unavailable_model_fails_cleanly(client_factory, test_models):
    models = dict(test_models)
    models["coding"] = {
        "provider": "ollama",
        "model": "ghost-model",
        "enabled": True,
        "capabilities": ["coding"],
    }
    handler = make_ollama_handler({"test-model"})  # ghost-model not available
    with client_factory(handler, models=models) as c:
        job_id = _submit(c, "write python code")
        job = wait_for_job(c, job_id)
    assert job["status"] == "failed"
    assert "OllamaModelNotFoundError" in job["error"]
    assert "ghost-model" in job["error"]


def test_job_listing_exposes_task_type_and_model(client):
    job_id = _submit(client, "write a bash script to list files")
    wait_for_job(client, job_id)
    listing = client.get("/api/jobs", headers={"X-User-ID": "user-001"}).json()
    assert listing[0]["task_type"] == "coding"
    assert listing[0]["model"] == "coder-model"
