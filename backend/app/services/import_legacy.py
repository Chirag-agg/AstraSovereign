"""One-shot CLI: import legacy JSON/JSONL store data into SQLite.

Reads the pre-SQLite snapshots (``jobs.json``, ``artifacts.json``) and the JSONL
audit trail (``audit.jsonl``), validates each record, and inserts it into the
SQLite database. Invalid records are skipped and counted. The old files are left
in place; delete them manually after verifying the import.

Usage:

    python -m app.services.import_legacy \
        --database data/astra.db \
        --jobs data/jobs/jobs.json \
        --artifacts data/artifacts/artifacts.json \
        --audit data/audit/audit.jsonl
"""

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Optional

from app.config import REPO_ROOT, get_settings
from app.schemas.artifact import Artifact
from app.schemas.audit import AuditEvent
from app.schemas.job import Job
from app.services import db
from app.services.audit_store import SqliteAuditStore


def _insert_job(conn: sqlite3.Connection, job: Job) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO jobs (job_id, user_id, status, created_at, updated_at, data) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            job.job_id,
            job.user_id,
            job.status.value,
            job.created_at.isoformat(),
            (job.completed_at or job.started_at or job.created_at).isoformat(),
            json.dumps(job.model_dump(mode="json")),
        ),
    )


def _insert_artifact(conn: sqlite3.Connection, artifact: Artifact) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO artifacts (artifact_id, job_id, user_id, status, created_at, data) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            artifact.artifact_id,
            artifact.job_id,
            artifact.user_id,
            artifact.status,
            artifact.created_at.isoformat(),
            json.dumps(artifact.model_dump(mode="json")),
        ),
    )


def _read_json_list(path: Path) -> list:
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return []
    return data if isinstance(data, list) else []


def import_all(
    database: str,
    jobs_path: Optional[Path] = None,
    artifacts_path: Optional[Path] = None,
    audit_path: Optional[Path] = None,
) -> dict:
    conn = db.get_connection(database)
    db.init_schema(conn)

    imported = {"jobs": 0, "artifacts": 0, "audit": 0}
    skipped = {"jobs": 0, "artifacts": 0, "audit": 0}

    if jobs_path is not None:
        for item in _read_json_list(jobs_path):
            try:
                job = Job(**item)
            except (TypeError, ValueError):
                skipped["jobs"] += 1
                continue
            _insert_job(conn, job)
            imported["jobs"] += 1
        conn.commit()

    if artifacts_path is not None:
        for item in _read_json_list(artifacts_path):
            try:
                artifact = Artifact(**item)
            except (TypeError, ValueError):
                skipped["artifacts"] += 1
                continue
            _insert_artifact(conn, artifact)
            imported["artifacts"] += 1
        conn.commit()

    if audit_path is not None and audit_path.is_file():
        store = SqliteAuditStore(database)
        for line in audit_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                event = AuditEvent(**json.loads(line))
            except (TypeError, ValueError):
                skipped["audit"] += 1
                continue
            store.append(event)
            imported["audit"] += 1

    return {"imported": imported, "skipped": skipped}


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Import legacy JSON stores into SQLite.")
    parser.add_argument("--database", default=settings.database_path)
    parser.add_argument("--jobs", default=str(REPO_ROOT / "data" / "jobs" / "jobs.json"))
    parser.add_argument(
        "--artifacts", default=str(REPO_ROOT / "data" / "artifacts" / "artifacts.json")
    )
    parser.add_argument("--audit", default=str(REPO_ROOT / "data" / "audit" / "audit.jsonl"))
    args = parser.parse_args()

    result = import_all(
        args.database,
        Path(args.jobs) if args.jobs else None,
        Path(args.artifacts) if args.artifacts else None,
        Path(args.audit) if args.audit else None,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
