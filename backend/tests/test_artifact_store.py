"""ArtifactStore tests: create, get, update, list per job, delete, isolation."""

import asyncio

from app.schemas.artifact import Artifact, ArtifactStatus, ArtifactSummary
from app.services.artifact_store import InMemoryArtifactStore


def run(coro):
    return asyncio.run(coro)


def make_artifact(artifact_id="art-1", job_id="job-1", user_id="user-001", filename="a.docx"):
    return Artifact(
        artifact_id=artifact_id,
        job_id=job_id,
        user_id=user_id,
        filename=filename,
        type="word",
        path=f"/tmp/workspaces/{user_id}/{job_id}/artifacts/{filename}",
        status=ArtifactStatus.CREATING,
    )


def test_create_and_get(tmp_path):
    store = InMemoryArtifactStore()
    artifact = run(store.create(make_artifact()))
    got = run(store.get("art-1"))
    assert got is not None
    assert got.artifact_id == "art-1"
    assert got.job_id == "job-1"
    assert got.user_id == "user-001"
    assert got.status == "creating"


def test_update_status_and_size(tmp_path):
    store = InMemoryArtifactStore()
    run(store.create(make_artifact()))
    updated = run(store.update("art-1", status=ArtifactStatus.COMPLETED, size_bytes=18432))
    assert updated.status == "completed"
    assert updated.size_bytes == 18432
    got = run(store.get("art-1"))
    assert got.status == "completed"
    assert got.size_bytes == 18432


def test_update_missing_returns_none(tmp_path):
    store = InMemoryArtifactStore()
    assert run(store.update("art-nope", status=ArtifactStatus.FAILED)) is None


def test_list_for_job_is_isolated(tmp_path):
    store = InMemoryArtifactStore()
    run(store.create(make_artifact("a1", job_id="job-1")))
    run(store.create(make_artifact("a2", job_id="job-1")))
    run(store.create(make_artifact("a3", job_id="job-2")))
    job1 = run(store.list_for_job("job-1"))
    job2 = run(store.list_for_job("job-2"))
    assert {a.artifact_id for a in job1} == {"a1", "a2"}
    assert {a.artifact_id for a in job2} == {"a3"}


def test_delete(tmp_path):
    store = InMemoryArtifactStore()
    run(store.create(make_artifact()))
    assert run(store.delete("art-1")) is True
    assert run(store.get("art-1")) is None
    assert run(store.delete("art-1")) is False


def test_stats(tmp_path):
    store = InMemoryArtifactStore()
    run(store.create(make_artifact()))
    run(store.create(make_artifact("art-2", filename="b.docx")))
    run(store.update("art-1", status=ArtifactStatus.COMPLETED))
    stats = store.stats()
    assert stats["artifacts"] == 2
    assert stats["completed"] == 1


def test_summary_excludes_path(tmp_path):
    artifact = make_artifact()
    summary = ArtifactSummary.from_artifact(artifact)
    assert summary.artifact_id == artifact.artifact_id
    assert summary.filename == artifact.filename
    assert summary.type == "word"
    assert summary.status == "creating"
    assert not hasattr(summary, "path")
