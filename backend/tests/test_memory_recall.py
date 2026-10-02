"""Phase 1 deterministic work recall tests."""

import asyncio
import json
from pathlib import Path

from app.schemas.artifact import Artifact, ArtifactStatus
from app.schemas.job import Job, JobStatus
from app.services.agent import Agent
from app.services.artifact_store import InMemoryArtifactStore
from app.services.audit_store import SqliteAuditStore, ensure_audit_handler, set_audit_store
from app.services.job_store import InMemoryJobStore
from app.services.log_context import set_job_context
from app.services.memory_recall import MemoryRecall
from app.services.tools import RecallWorkTool
from app.services.untrusted_content import BEGIN_MARKER, END_MARKER


def make_job(user_id, message, project_id=None, classification=None, document_ids=None):
    return Job(
        user_id=user_id,
        message=message,
        project_id=project_id,
        classification=classification,
        document_ids=document_ids or [],
        status=JobStatus.COMPLETED,
        response="completed outcome",
    )


def make_artifact(job, filename, metadata=None):
    return Artifact(
        artifact_id=f"artifact-{filename}",
        job_id=job.job_id,
        user_id=job.user_id,
        filename=filename,
        type="word",
        path=f"/tmp/{filename}",
        status=ArtifactStatus.COMPLETED,
        metadata=metadata or {},
    )


def test_recall_scopes_user_workspace_and_classification_before_search():
    async def run():
        jobs = InMemoryJobStore()
        artifacts = InMemoryArtifactStore()
        allowed = await jobs.create(
            make_job("user-a", "allowed report", "workspace-a", "internal")
        )
        await jobs.create(make_job("user-b", "secret report", "workspace-a", "internal"))
        await jobs.create(make_job("user-a", "other workspace", "workspace-b", "internal"))
        await jobs.create(make_job("user-a", "restricted classification", "workspace-a", "secret"))
        recall = MemoryRecall(jobs, artifacts)
        found = await recall.find_work(
            "user-a",
            "report",
            workspace_ids=["workspace-a"],
            classifications=["internal"],
        )
        assert [row["job_id"] for row in found] == [allowed.job_id]

    asyncio.run(run())


def test_recall_matches_message_filename_and_artifact_name():
    async def run():
        class DocumentStore:
            async def list_documents(self, user_id):
                return [type("Document", (), {"document_id": "doc-1", "filename": "filename.pdf"})()]

        jobs = InMemoryJobStore()
        artifacts = InMemoryArtifactStore()
        message_job = await jobs.create(make_job("user-a", "pump inspection history"))
        filename_job = await jobs.create(make_job("user-a", "unrelated request", document_ids=["doc-1"]))
        artifact_job = await jobs.create(make_job("user-a", "another request"))
        await artifacts.create(make_artifact(message_job, "message.docx"))
        await artifacts.create(make_artifact(filename_job, "filename.docx"))
        await artifacts.create(make_artifact(artifact_job, "pump-history.xlsx"))
        recall = MemoryRecall(jobs, artifacts, document_store=DocumentStore())
        assert (await recall.find_work("user-a", "inspection"))[0]["job_id"] == message_job.job_id
        assert (await recall.find_work("user-a", "filename.docx"))[0]["job_id"] == filename_job.job_id
        assert (await recall.find_work("user-a", "pump-history"))[0]["job_id"] == artifact_job.job_id

    asyncio.run(run())


def test_recall_tool_empty_result_is_nonce_framed_and_audited(tmp_path):
    async def run():
        jobs = InMemoryJobStore()
        artifacts = InMemoryArtifactStore()
        job = await jobs.create(make_job("user-a", "seeded work"))
        audit = SqliteAuditStore(str(tmp_path / "audit.db"))
        set_audit_store(audit)
        ensure_audit_handler()
        set_job_context(job_id=job.job_id, user_id="user-a")
        tool = RecallWorkTool(MemoryRecall(jobs, artifacts))
        empty = await tool.execute(Path(tmp_path), {"query": "does-not-exist"})
        assert empty.content == "Nothing found"
        found = await tool.execute(Path(tmp_path), {"query": "seeded"})
        observation = Agent._observation("recall_work", found)
        assert BEGIN_MARKER in observation
        assert END_MARKER in observation
        payload = json.loads(found.content)
        assert payload[0]["job_id"] == job.job_id
        events = audit.list(user_id="user-a")
        assert len(events) == 2
        assert events[0].event_type == "RECALL_WORK"
        assert events[0].metadata["result_count"] == 1
        assert events[0].metadata["query"] == "seeded"

    asyncio.run(run())
