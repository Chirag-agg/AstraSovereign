from tests.conftest import wait_for_job


def test_get_own_job(client):
    resp = client.post("/api/chat", json={"message": "Hello"}, headers={"X-User-ID": "user-001"})
    job_id = resp.json()["job_id"]
    job = wait_for_job(client, job_id, "user-001")
    assert job["job_id"] == job_id
    assert job["user_id"] == "user-001"
    assert job["message"] == "Hello"
    assert job["status"] == "completed"
    assert "response" in job
    assert "error" in job and job["error"] is None


def test_get_job_not_found(client):
    resp = client.get("/api/jobs/job-does-not-exist", headers={"X-User-ID": "user-001"})
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"] == "job_not_found"


def test_user_cannot_read_another_users_job(client):
    resp = client.post("/api/chat", json={"message": "secret A"}, headers={"X-User-ID": "user-001"})
    job_id = resp.json()["job_id"]
    wait_for_job(client, job_id, "user-001")

    resp = client.get(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-002"})
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"] == "forbidden"


def test_user_cannot_cancel_another_users_job(client):
    resp = client.post("/api/chat", json={"message": "secret A"}, headers={"X-User-ID": "user-001"})
    job_id = resp.json()["job_id"]

    resp = client.delete(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-002"})
    assert resp.status_code == 403


def test_list_jobs_only_returns_own(client):
    for uid in ("user-001", "user-001", "user-002"):
        resp = client.post("/api/chat", json={"message": f"hello {uid}"}, headers={"X-User-ID": uid})
        wait_for_job(client, resp.json()["job_id"], uid)

    user1_jobs = client.get("/api/jobs", headers={"X-User-ID": "user-001"}).json()
    assert len(user1_jobs) == 2
    assert all(j["user_id"] == "user-001" for j in user1_jobs)

    user2_jobs = client.get("/api/jobs", headers={"X-User-ID": "user-002"}).json()
    assert len(user2_jobs) == 1
    assert user2_jobs[0]["user_id"] == "user-002"


def test_list_jobs_status_filter(client):
    for uid in ("user-001", "user-001"):
        resp = client.post("/api/chat", json={"message": "x"}, headers={"X-User-ID": uid})
        wait_for_job(client, resp.json()["job_id"], uid)

    completed = client.get(
        "/api/jobs",
        params={"status": "completed"},
        headers={"X-User-ID": "user-001"},
    ).json()
    assert len(completed) == 2
    assert all(j["status"] == "completed" for j in completed)

    running = client.get(
        "/api/jobs",
        params={"status": "running"},
        headers={"X-User-ID": "user-001"},
    ).json()
    assert running == []


def test_list_jobs_limit_and_offset(client):
    job_ids = []
    for _ in range(3):
        resp = client.post("/api/chat", json={"message": "x"}, headers={"X-User-ID": "user-001"})
        job_ids.append(resp.json()["job_id"])
        wait_for_job(client, job_ids[-1], "user-001")

    first_page = client.get("/api/jobs", params={"limit": 2}, headers={"X-User-ID": "user-001"}).json()
    assert len(first_page) == 2
    second_page = client.get(
        "/api/jobs",
        params={"limit": 2, "offset": 2},
        headers={"X-User-ID": "user-001"},
    ).json()
    assert len(second_page) == 1

    first_ids = {j["job_id"] for j in first_page}
    second_ids = {j["job_id"] for j in second_page}
    assert first_ids.isdisjoint(second_ids)
    assert first_ids | second_ids == set(job_ids)


def test_cancel_queued_job(client_factory, delayed_ollama_handler):
    slow = delayed_ollama_handler(0.4)
    with client_factory(slow) as c:
        r1 = c.post("/api/chat", json={"message": "first"}, headers={"X-User-ID": "user-001"})
        r2 = c.post("/api/chat", json={"message": "second"}, headers={"X-User-ID": "user-001"})
        j1, j2 = r1.json()["job_id"], r2.json()["job_id"]

        assert c.get(f"/api/jobs/{j2}", headers={"X-User-ID": "user-001"}).json()["status"] == "queued"

        resp = c.delete(f"/api/jobs/{j2}", headers={"X-User-ID": "user-001"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

        job1 = wait_for_job(c, j1, "user-001")
        assert job1["status"] == "completed"

        job2 = c.get(f"/api/jobs/{j2}", headers={"X-User-ID": "user-001"}).json()
        assert job2["status"] == "cancelled"

        health = c.get("/health").json()
        assert health["jobs"]["completed"] == 1
        assert health["jobs"]["cancelled"] == 1


def test_cannot_cancel_completed_job(client):
    resp = client.post("/api/chat", json={"message": "x"}, headers={"X-User-ID": "user-001"})
    job_id = resp.json()["job_id"]
    wait_for_job(client, job_id, "user-001")

    resp = client.delete(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-001"})
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "invalid_state"
