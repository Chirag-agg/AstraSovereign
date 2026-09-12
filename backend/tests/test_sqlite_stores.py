"""Tests for the durable SQLite stores and the hash-chained audit trail."""

import asyncio
import json

from app.schemas.artifact import Artifact, ArtifactStatus
from app.schemas.audit import AuditEvent
from app.schemas.job import Job, JobStatus
from app.services import db
from app.services.artifact_store import SqliteArtifactStore
from app.services.audit_store import SqliteAuditStore
from app.services.job_store import SqliteJobStore


def run(coro):
    return asyncio.run(coro)


def _job(user="user-001", message="hi"):
    return Job(user_id=user, message=message, task_type="general", status=JobStatus.QUEUED)


def _artifact(artifact_id, job_id, user):
    return Artifact(
        artifact_id=artifact_id,
        job_id=job_id,
        user_id=user,
        filename=f"{artifact_id}.docx",
        type="word",
        path=f"/tmp/{artifact_id}.docx",
        status=ArtifactStatus.COMPLETED,
        size_bytes=10,
    )


def _event(i):
    return AuditEvent(
        event_id=f"evt-{i}",
        event_type="JOB_CREATED",
        job_id=f"job-{i}",
        user_id="user-001",
        metadata={"iteration": i},
    )


def test_job_store_round_trip(tmp_path):
    store = SqliteJobStore(str(tmp_path / "test.db"))
    created = run(store.create(_job()))
    assert created.job_id.startswith("job-")

    fetched = run(store.get(created.job_id))
    assert fetched is not None and fetched.message == "hi"

    updated = run(store.update(created.job_id, status=JobStatus.RUNNING, model="m1"))
    assert updated.status == JobStatus.RUNNING and updated.model == "m1"
    assert run(store.get("missing")) is None

    assert [j.job_id for j in run(store.list_all())] == [created.job_id]


def test_job_data_survives_connection_reopen(tmp_path):
    path = str(tmp_path / "test.db")
    created = run(SqliteJobStore(path).create(_job()))
    db.close_connection(path)  # simulate restart

    fresh = SqliteJobStore(path)
    fetched = run(fresh.get(created.job_id))
    assert fetched is not None
    assert fetched.user_id == "user-001"
    assert fetched.status == JobStatus.QUEUED


def test_artifact_store_scopes_by_user(tmp_path):
    store = SqliteArtifactStore(str(tmp_path / "test.db"))
    run(store.create(_artifact("art-a", "job-1", "user-001")))
    run(store.create(_artifact("art-b", "job-2", "user-002")))

    assert [a.artifact_id for a in run(store.list_for_user("user-001"))] == ["art-a"]
    assert [a.artifact_id for a in run(store.list_for_job("job-2"))] == ["art-b"]
    assert store.stats() == {"artifacts": 2, "completed": 2}


def test_audit_chain_verifies(tmp_path):
    store = SqliteAuditStore(str(tmp_path / "test.db"))
    for i in range(10):
        store.append(_event(i))
    assert store.stats()["events"] == 10
    assert store.verify_chain() == (True, None)


def test_audit_tamper_is_detected(tmp_path):
    path = str(tmp_path / "test.db")
    store = SqliteAuditStore(path)
    for i in range(3):
        store.append(_event(i))

    conn = db.get_connection(path)
    second = conn.execute("SELECT seq, data FROM audit_events ORDER BY seq LIMIT 1 OFFSET 1").fetchone()
    tampered = json.loads(second["data"])
    tampered["metadata"]["iteration"] = 999
    conn.execute(
        "UPDATE audit_events SET data = ? WHERE seq = ?",
        (json.dumps(tampered, sort_keys=True, separators=(",", ":")), second["seq"]),
    )
    conn.commit()

    intact, first_bad_seq = store.verify_chain()
    assert intact is False
    assert first_bad_seq == second["seq"]


def test_concurrent_audit_appends_verify(tmp_path):
    store = SqliteAuditStore(str(tmp_path / "test.db"))

    async def write(i):
        await asyncio.to_thread(store.append, _event(i))

    async def main():
        await asyncio.gather(*(write(i) for i in range(50)))

    run(main())
    assert store.stats()["events"] == 50
    assert store.list(limit=500)[0].event_id.startswith("evt-")
    assert store.verify_chain() == (True, None)
