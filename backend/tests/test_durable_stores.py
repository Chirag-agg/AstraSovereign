"""Durable store tests: history survives a simulated restart.

The JSON-snapshot behavior these tests used to cover was replaced by SQLite
stores (see Task B), so the durability assertions now target
``SqliteJobStore``/``SqliteArtifactStore``. ``InMemory*`` stores are pure
in-memory test doubles.
"""

import asyncio

from app.schemas.artifact import Artifact, ArtifactStatus
from app.schemas.job import Job, JobStatus
from app.services import db
from app.services.artifact_store import InMemoryArtifactStore, SqliteArtifactStore
from app.services.job_store import InMemoryJobStore, SqliteJobStore


def run(coro):
    return asyncio.run(coro)


def _restart(path):
    """Drop the cached connection to simulate a process restart."""
    db.close_connection(path)


async def _job_demo(path):
    store = SqliteJobStore(path)
    created = await store.create(
        Job(user_id="user-001", message="hello", task_type="general", status=JobStatus.QUEUED)
    )
    await store.update(created.job_id, status=JobStatus.RUNNING, model="test-model")
    return created.job_id


def test_job_store_persists_across_restart(tmp_path):
    path = str(tmp_path / "astra.db")
    job_id = run(_job_demo(path))
    _restart(path)

    fresh = SqliteJobStore(path)
    jobs = run(fresh.list_all())
    assert len(jobs) == 1
    job = jobs[0]
    assert job.job_id == job_id
    assert job.user_id == "user-001"
    assert job.status == JobStatus.RUNNING
    assert job.model == "test-model"


def test_in_memory_job_store_stays_in_memory(tmp_path):
    store = InMemoryJobStore()
    created = run(store.create(Job(user_id="u", message="x")))
    assert created.job_id.startswith("job-")
    assert not (tmp_path / "jobs.json").exists()


async def _artifact_demo(path):
    store = SqliteArtifactStore(path)
    created = await store.create(
        Artifact(
            artifact_id="art-1",
            job_id="job-1",
            user_id="user-001",
            filename="note.docx",
            type="word",
            path="/tmp/note.docx",
            status=ArtifactStatus.COMPLETED,
            size_bytes=10,
        )
    )
    await store.update("art-1", size_bytes=99)
    return created.artifact_id


def test_artifact_store_persists_across_restart(tmp_path):
    path = str(tmp_path / "astra.db")
    art_id = run(_artifact_demo(path))
    _restart(path)

    fresh = SqliteArtifactStore(path)
    artifact = run(fresh.get(art_id))
    assert artifact is not None
    assert artifact.status == ArtifactStatus.COMPLETED
    assert artifact.size_bytes == 99
    assert artifact.job_id == "job-1"


def test_artifact_store_delete_persists(tmp_path):
    path = str(tmp_path / "astra.db")
    run(_artifact_demo(path))
    store = SqliteArtifactStore(path)
    assert run(store.delete("art-1")) is True
    _restart(path)

    fresh = SqliteArtifactStore(path)
    assert run(fresh.get("art-1")) is None
    assert run(fresh.list_for_user("user-001")) == []


def test_in_memory_artifact_store_scopes_by_user():
    store = InMemoryArtifactStore()
    run(
        store.create(
            Artifact(
                artifact_id="art-a",
                job_id="job-1",
                user_id="user-001",
                filename="a.docx",
                type="word",
                path="/tmp/a.docx",
            )
        )
    )
    run(
        store.create(
            Artifact(
                artifact_id="art-b",
                job_id="job-2",
                user_id="user-002",
                filename="b.docx",
                type="word",
                path="/tmp/b.docx",
            )
        )
    )
    assert [a.artifact_id for a in run(store.list_for_user("user-001"))] == ["art-a"]
