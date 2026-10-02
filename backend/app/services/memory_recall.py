"""Deterministic, user-scoped recall of prior jobs and deliverables."""

import json
import re
from datetime import datetime
from typing import Optional

from app.schemas.job import Job
from app.services.artifact_store import ArtifactStore
from app.services.job_store import JobStore


class MemoryRecall:
    """Query the existing job and artifact stores without model assistance."""

    def __init__(self, job_store: JobStore, artifact_store: ArtifactStore, document_store=None):
        self._jobs = job_store
        self._artifacts = artifact_store
        self._documents = document_store

    async def recent_work(
        self,
        user_id: str,
        limit: int,
        workspace_ids: Optional[list[str]] = None,
        classifications: Optional[list[str]] = None,
    ) -> list[dict]:
        candidates = await self._jobs.list_for_recall(
            user_id, workspace_ids=workspace_ids, classifications=classifications
        )
        candidates.sort(key=lambda job: (job.created_at, job.job_id), reverse=True)
        return await self._results(candidates[: max(0, min(limit, 100))], user_id)

    async def find_work(
        self,
        user_id: str,
        query: str,
        since: Optional[datetime] = None,
        limit: int = 10,
        workspace_ids: Optional[list[str]] = None,
        classifications: Optional[list[str]] = None,
    ) -> list[dict]:
        query = (query or "").strip()
        if not query:
            return []
        candidates = await self._jobs.list_for_recall(
            user_id, workspace_ids=workspace_ids, classifications=classifications
        )
        candidates = [
            job for job in candidates
            if since is None or job.created_at >= since
        ]
        rows = await self._search_candidates(candidates, user_id, query)
        rows.sort(key=lambda row: (row["job"].created_at, row["job"].job_id), reverse=True)
        return await self._results(
            [row["job"] for row in rows[: max(0, min(limit, 100))]], user_id
        )

    async def _search_candidates(self, jobs: list[Job], user_id: str, query: str) -> list[dict]:
        indexed: list[dict] = []
        for job in jobs:
            artifacts = [
                artifact for artifact in await self._artifacts.list_for_job(job.job_id)
                if artifact.user_id == user_id
            ]
            documents = await self._document_names(user_id, job.document_ids)
            names = documents + [artifact.filename for artifact in artifacts]
            indexed.append({"job": job, "content": " ".join([job.message, *names])})

        try:
            import sqlite3

            connection = sqlite3.connect(":memory:")
            connection.execute("CREATE VIRTUAL TABLE recall_fts USING fts5(job_id UNINDEXED, content)")
            connection.executemany(
                "INSERT INTO recall_fts(job_id, content) VALUES (?, ?)",
                [(row["job"].job_id, row["content"]) for row in indexed],
            )
            terms = [term for term in re.findall(r"[A-Za-z0-9_]+", query)]
            if not terms:
                return []
            match = " OR ".join(f'"{term.replace(chr(34), "")}"' for term in terms)
            found = connection.execute(
                "SELECT job_id FROM recall_fts WHERE recall_fts MATCH ?", (match,)
            ).fetchall()
            ids = {row[0] for row in found}
            return [row for row in indexed if row["job"].job_id in ids]
        except (ImportError, sqlite3.OperationalError):
            lowered = query.casefold()
            return [row for row in indexed if lowered in row["content"].casefold()]

    async def _document_names(self, user_id: str, document_ids: list[str]) -> list[str]:
        if not document_ids or self._documents is None:
            return list(document_ids)
        documents = await self._documents.list_documents(user_id)
        names = {document.document_id: document.filename for document in documents}
        return [names.get(document_id, document_id) for document_id in document_ids]

    async def _results(self, jobs: list[Job], user_id: str) -> list[dict]:
        results = []
        for job in jobs:
            artifacts = [
                artifact for artifact in await self._artifacts.list_for_job(job.job_id)
                if artifact.user_id == user_id
            ]
            documents = await self._document_names(user_id, job.document_ids)
            results.append(
                {
                    "job_id": job.job_id,
                    "timestamp": job.created_at.isoformat(),
                    "task_type": job.task_type,
                    "documents_used": documents,
                    "artifacts_produced": [artifact.filename for artifact in artifacts],
                    "outcome": job.response or job.error or job.status.value,
                }
            )
        return results


async def recent_work(job_store, artifact_store, user_id, limit, **scope):
    return await MemoryRecall(job_store, artifact_store).recent_work(user_id, limit, **scope)


async def find_work(job_store, artifact_store, user_id, query, since=None, limit=10, **scope):
    return await MemoryRecall(job_store, artifact_store).find_work(
        user_id, query, since=since, limit=limit, **scope
    )
