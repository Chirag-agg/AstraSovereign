"""Durable store snapshot tests: job/artifact history survives restart."""

import asyncio

from app.schemas.artifact import Artifact, ArtifactStatus
from app.schemas.job import Job, JobStatus
from app.services.artifact_store import InMemoryArtifactStore
from app.services.job_store import InMemoryJobStore


def run(coro):
    return asyncio.run(coro)


async def _job_demo(root):
    store = InMemoryJobStore(str(root))
    created = await store.create(
        Job(user_id="user-001", message="hello", task_type="general", status=JobStatus.QUEUED)
    )
    await store.update(created.job_id, status=JobStatus.RUNNING, model="test-model")
    return created.job_id


def test_job_store_persists_across_restart(tmp_path):
    job_id = run(_job_demo(tmp_path))

    # simulate a process restart: fresh store pointed at the same root
    fresh = InMemoryJobStore(str(tmp_path))
    jobs = run(fresh.list_all())
    assert len(jobs) == 1
    job = jobs[0]
    assert job.job_id == job_id
    assert job.user_id == "user-001"
    assert job.status == JobStatus.RUNNING
    assert job.model == "test-model"


def test_job_store_without_root_stays_in_memory(tmp_path):
    store = InMemoryJobStore()
    created = run(store.create(Job(user_id="u", message="x")))
    assert created.job_id.startswith("job-")
    assert not (tmp_path / "jobs.json").exists()


async def _artifact_demo(root):
    store = InMemoryArtifactStore(str(root))
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
    art_id = run(_artifact_demo(tmp_path))

    fresh = InMemoryArtifactStore(str(tmp_path))
    artifact = run(fresh.get(art_id))
    assert artifact is not None
    assert artifact.status == ArtifactStatus.COMPLETED
    assert artifact.size_bytes == 99
    assert artifact.job_id == "job-1"


def test_artifact_store_delete_persists(tmp_path):
    run(_artifact_demo(tmp_path))
    store = InMemoryArtifactStore(str(tmp_path))
    assert run(store.delete("art-1")) is True

    fresh = InMemoryArtifactStore(str(tmp_path))
    assert run(fresh.get("art-1")) is None
    assert run(fresh.list_for_user("user-001")) == []
