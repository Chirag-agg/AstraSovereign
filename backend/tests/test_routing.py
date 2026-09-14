"""Integration tests: a job is classified, and each node routes to its own
capability model (per-node routing is the only routing)."""

from tests.conftest import make_ollama_handler, wait_for_job


def _submit(client, message, user_id="user-001"):
    resp = client.post("/api/chat", json={"message": message}, headers={"X-User-ID": user_id})
    assert resp.status_code == 202
    return resp.json()["job_id"]


def _node_models(job, node):
    return [
        step.get("model")
        for step in job.get("execution_trace", [])
        if step.get("type") == "node_started" and step.get("node") == node
    ]


def test_general_request_classifies_general_and_drafts_with_general_model(client):
    job_id = _submit(client, "Explain how a heat exchanger works.")
    job = wait_for_job(client, job_id)
    assert job["status"] == "completed"
    assert job["task_type"] == "general"
    assert _node_models(job, "draft") == ["test-model"]


def test_coding_request_classifies_coding_and_computes_with_coding_model(client):
    job_id = _submit(client, "write a Python function to reverse a string")
    job = wait_for_job(client, job_id)
    assert job["status"] == "completed"
    assert job["task_type"] == "coding"
    assert _node_models(job, "compute") == ["coder-model"]


def test_code_snippet_classifies_coding(client):
    job_id = _submit(client, "```python\nprint('hi')\n```")
    job = wait_for_job(client, job_id)
    assert job["status"] == "completed"
    assert job["task_type"] == "coding"
    assert _node_models(job, "compute") == ["coder-model"]


def test_two_jobs_use_two_different_node_models(client):
    general_id = _submit(client, "Explain heat transfer.")
    coding_id = _submit(client, "debug this python code")
    general_job = wait_for_job(client, general_id)
    coding_job = wait_for_job(client, coding_id)

    assert general_job["task_type"] == "general"
    assert coding_job["task_type"] == "coding"
    general_models = _node_models(general_job, "draft")
    coding_models = _node_models(coding_job, "compute")
    assert general_models and coding_models
    assert general_models != coding_models


def test_job_stores_selected_task_type(client):
    job_id = _submit(client, "fix this bug in my Python script")
    job = wait_for_job(client, job_id)
    assert job["task_type"] == "coding"
    assert _node_models(job, "compute") == ["coder-model"]


def test_disabled_document_model_floors_to_general_without_failing(
    client_factory, test_models, available_models
):
    handler = make_ollama_handler(available_models)
    with client_factory(handler) as c:
        job_id = _submit(c, "summarize this document")
        job = wait_for_job(c, job_id)
    # A disabled capability no longer fails the job; the node floors to general.
    assert job["status"] == "completed"
    assert job["task_type"] == "document"


def test_missing_vision_model_does_not_fail_a_text_job(client_factory, test_models):
    models = {k: v for k, v in test_models.items() if k != "vision"}
    handler = make_ollama_handler({"test-model", "coder-model"})
    with client_factory(handler, models=models) as c:
        job_id = _submit(c, "describe what is in this image")
        job = wait_for_job(c, job_id)
    assert job["status"] == "completed"
    assert job["task_type"] == "vision"


def test_configured_but_unavailable_coding_model_fails_cleanly(client_factory, test_models):
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


def test_job_listing_exposes_task_type(client):
    job_id = _submit(client, "write a bash script to list files")
    wait_for_job(client, job_id)
    listing = client.get("/api/jobs", headers={"X-User-ID": "user-001"}).json()
    assert listing[0]["task_type"] == "coding"
