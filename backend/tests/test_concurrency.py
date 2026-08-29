"""Concurrency: multiple users submitting jobs without mixing state."""

from tests.conftest import wait_for_job

USERS_AND_PROMPTS = [
    ("user-001", "prompt A"),
    ("user-002", "prompt B"),
    ("user-003", "prompt C"),
    ("user-004", "prompt D"),
    ("user-005", "prompt E"),
]


def test_five_users_submit_and_get_correct_results(client_factory, success_ollama_handler):
    with client_factory(success_ollama_handler) as c:
        submitted = []
        for user_id, prompt in USERS_AND_PROMPTS:
            resp = c.post("/api/chat", json={"message": prompt}, headers={"X-User-ID": user_id})
            assert resp.status_code == 202
            body = resp.json()
            assert body["status"] == "queued"
            submitted.append((user_id, prompt, body["job_id"]))

        job_ids = [job_id for _, _, job_id in submitted]
        assert len(job_ids) == 5
        assert len(set(job_ids)) == 5, "all job ids must be distinct"

        for user_id, prompt, job_id in submitted:
            job = wait_for_job(c, job_id, user_id)
            assert job["status"] == "completed"
            assert job["user_id"] == user_id
            assert job["job_id"] == job_id
            assert job["response"] == f"mocked reply to: {prompt}"

        for user_id, _, _ in submitted:
            own = c.get("/api/jobs", headers={"X-User-ID": user_id}).json()
            assert len(own) == 1
            assert own[0]["user_id"] == user_id

        health = c.get("/health").json()
        assert health["jobs"]["total"] == 5
        assert health["jobs"]["completed"] == 5


def test_fifo_single_worker_processing(client_factory, delayed_ollama_handler):
    slow = delayed_ollama_handler(0.3)
    with client_factory(slow) as c:
        r1 = c.post("/api/chat", json={"message": "first"}, headers={"X-User-ID": "user-001"})
        r2 = c.post("/api/chat", json={"message": "second"}, headers={"X-User-ID": "user-002"})
        j1, j2 = r1.json()["job_id"], r2.json()["job_id"]

        second_now = c.get(f"/api/jobs/{j2}", headers={"X-User-ID": "user-002"}).json()
        assert second_now["status"] == "queued", "second job must wait while the first runs"

        job1 = wait_for_job(c, j1, "user-001")
        job2 = wait_for_job(c, j2, "user-002")

        assert job1["status"] == "completed"
        assert job1["response"] == "mocked reply to: first"
        assert job2["status"] == "completed"
        assert job2["response"] == "mocked reply to: second"
        assert job1["started_at"] <= job2["started_at"]
