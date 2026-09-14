"""Worker + scheduler integration through the API (mock Ollama, in-memory capacity)."""

import time

from tests.conftest import default_capacity, make_scripted_handler, wait_for_job


def models_with_resources(test_models, **resources):
    models = dict(test_models)
    models["general"] = {**models["general"], "resources": resources}
    return models


EIGHT_GB = {"gpu_vram_mb": 8192, "cpu_cores": 2, "memory_mb": 4096}
THIRTY_TWO_GB = {"gpu_vram_mb": 32768, "cpu_cores": 2, "memory_mb": 4096}
UNKNOWN_GPU = {"gpu_id": "GPU-9", "gpu_vram_mb": 8192}


def test_job_completes_and_releases_resources(client_factory, test_models):
    models = models_with_resources(test_models, **EIGHT_GB)
    with client_factory(
        make_scripted_handler(['{"type":"final","response":"ok"}']),
        models=models,
        resource_capacity=default_capacity(),
    ) as c:
        resp = c.post("/api/chat", json={"message": "Hello"}, headers={"X-User-ID": "user-001"})
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

        assert job["status"] == "completed"
        # Per-node reservation is released when the job ends; poll health.
        deadline = time.monotonic() + 5
        health = c.get("/health").json()
        while time.monotonic() < deadline:
            health = c.get("/health").json()
            if health["scheduler"]["running_jobs"] == 0:
                break
            time.sleep(0.02)
        assert health["scheduler"]["running_jobs"] == 0
        assert health["scheduler"]["allocated"]["gpu"]["GPU-0"]["allocated_vram_mb"] == 0


def test_impossible_job_fails_cleanly(client_factory, test_models):
    models = models_with_resources(test_models, **THIRTY_TWO_GB)
    with client_factory(
        make_scripted_handler([]),
        models=models,
        resource_capacity=default_capacity(),
    ) as c:
        resp = c.post("/api/chat", json={"message": "Hello"}, headers={"X-User-ID": "user-001"})
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "failed"
    assert "resource_rejected" in job["error"]
    assert "Requested 32768 MB VRAM, system capacity is 16384 MB" in job["error"]


def test_unknown_gpu_fails_cleanly(client_factory, test_models):
    models = models_with_resources(test_models, **UNKNOWN_GPU)
    with client_factory(
        make_scripted_handler([]),
        models=models,
        resource_capacity=default_capacity(),
    ) as c:
        resp = c.post("/api/chat", json={"message": "Hello"}, headers={"X-User-ID": "user-001"})
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "failed"
    assert "Unknown GPU 'GPU-9'" in job["error"]


def test_cancelled_running_job_releases_resources(client_factory, test_models):
    models = models_with_resources(test_models, **EIGHT_GB)
    handler = make_scripted_handler(
        ['{"type":"tool_call","tool":"list_files","arguments":{}}'] * 20,
        delay_seconds=0.4,
    )
    with client_factory(handler, models=models, resource_capacity=default_capacity()) as c:
        resp = c.post("/api/chat", json={"message": "do it"}, headers={"X-User-ID": "user-001"})
        job_id = resp.json()["job_id"]
        time.sleep(0.2)
        cancel = c.delete(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-001"})
        assert cancel.status_code == 200
        wait_for_job(c, job_id, "user-001", timeout=10)
        # The DELETE marks the job terminal immediately; the worker releases the
        # allocation slightly later. Poll health until it is freed.
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            health = c.get("/health").json()
            if health["scheduler"]["running_jobs"] == 0:
                break
            time.sleep(0.02)
        assert health["scheduler"]["running_jobs"] == 0
        assert health["scheduler"]["allocated"]["gpu"]["GPU-0"]["allocated_vram_mb"] == 0


def test_health_exposes_scheduler_section(client_factory, test_models):
    models = models_with_resources(test_models, **EIGHT_GB)
    with client_factory(
        make_scripted_handler(['{"type":"final","response":"ok"}']),
        models=models,
        resource_capacity=default_capacity(),
    ) as c:
        resp = c.post("/api/chat", json={"message": "Hello"}, headers={"X-User-ID": "user-001"})
        wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)
        health = c.get("/health").json()

    assert "scheduler" in health
    assert set(health["scheduler"]) == {"queued_jobs", "running_jobs", "allocated"}
    assert "gpu" in health["scheduler"]["allocated"]
    assert health["scheduler"]["allocated"]["gpu"]["GPU-0"]["capacity_vram_mb"] == 16384


def test_no_resources_model_runs_unaffected(client_factory):
    """Models without declared resources keep the pre-Phase-6 behavior."""
    with client_factory(make_scripted_handler(['{"type":"final","response":"ok"}'])) as c:
        resp = c.post("/api/chat", json={"message": "Hello"}, headers={"X-User-ID": "user-001"})
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)
    assert job["status"] == "completed"
    assert job["resource_status"] == "not_required"
