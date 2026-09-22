"""Local persistent audit store (Phase 11).

Append-only JSONL on the local filesystem. Every meaningful operation emits an
audit event via the structured JSON logger (``event`` extra) — this module maps
those existing log events to audit event types and appends them, so business
logic is never duplicated.

Sovereignty rules:
- local filesystem only, append-only, safe concurrent writes, survives restart
- events never carry confidential content (see ``_SAFE_METADATA_KEYS``)
- no cloud logging, no Elasticsearch, no SaaS observability
"""

import asyncio
import hashlib
import json
import logging
import sqlite3
import threading
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.schemas.audit import AuditEvent
from app.services import db

logger = logging.getLogger("app.audit_store")

# Existing structured log `event` values -> audit event types.
EVENT_TYPE_MAP = {
    "job_created": "JOB_CREATED",
    "job_started": "JOB_STARTED",
    "job_completed": "JOB_COMPLETED",
    "job_failed": "JOB_FAILED",
    "model_selected": "MODEL_SELECTED",
    "model_fallback": "MODEL_FALLBACK",
    "model_call_started": "MODEL_CALL_STARTED",
    "model_call_completed": "MODEL_CALL_COMPLETED",
    "tool_call_started": "TOOL_CALL_STARTED",
    "tool_call_completed": "TOOL_CALL_COMPLETED",
    "document_ingestion_started": "DOCUMENT_INGESTION_STARTED",
    "document_ingestion_completed": "DOCUMENT_INGESTION_COMPLETED",
    "document_pages_unreadable": "DOCUMENT_PAGES_UNREADABLE",
    "document_search_started": "DOCUMENT_SEARCH_STARTED",
    "document_search_completed": "DOCUMENT_SEARCH_COMPLETED",
    "ocr_started": "OCR_STARTED",
    "ocr_completed": "OCR_COMPLETED",
    "vision_started": "VISION_STARTED",
    "vision_completed": "VISION_COMPLETED",
    "code_execution_started": "SANDBOX_STARTED",
    "code_execution_completed": "SANDBOX_COMPLETED",
    "document_generation_started": "DOCUMENT_GENERATION_STARTED",
    "document_generation_completed": "DOCUMENT_GENERATION_COMPLETED",
    "document_generation_failed": "DOCUMENT_GENERATION_FAILED",
    "presentation_generation_started": "PRESENTATION_GENERATION_STARTED",
    "presentation_generation_completed": "PRESENTATION_GENERATION_COMPLETED",
    "presentation_generation_failed": "PRESENTATION_GENERATION_FAILED",
    "resource_allocated": "RESOURCE_ALLOCATED",
    "resource_released": "RESOURCE_RELEASED",
}

# Only these extra fields are ever copied into audit metadata (nothing else).
_SAFE_METADATA_KEYS = {
    "model",
    "task_type",
    "requested",
    "actual",
    "fallback_reason",
    "tool",
    "page",
    "pages",
    "provider",
    "language",
    "exit_code",
    "duration_ms",
    "size_bytes",
    "status",
    "reason",
    "document_id",
    "artifact_id",
    "slide_count",
    "filename",
    "file_name",
    "chunk_count",
    "resource_status",
    "cpu_cores",
    "memory_mb",
    "gpu_id",
    "gpu_vram_mb",
    "waiters",
    "observations",
    "iteration",
    "tool_calls",
    "error",
}

# Standard logging.LogRecord attributes — never treated as audit metadata (they
# would leak source-file/thread info, e.g. `filename` = the emitting source file).
_LOG_STANDARD_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "taskName",
    "message",
    "asctime",
    "event",
}

_MAX_METADATA_STRING = 200


def _cap(value):
    if isinstance(value, str) and len(value) > _MAX_METADATA_STRING:
        return value[:_MAX_METADATA_STRING] + "...[truncated]"
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    text = str(value)
    return text[:_MAX_METADATA_STRING] if len(text) > _MAX_METADATA_STRING else text


def _level_status(levelname: str) -> str:
    if levelname == "ERROR":
        return "failed"
    if levelname == "WARNING":
        return "warning"
    return "ok"


def _event_from_log(record: logging.LogRecord, event_type: str) -> AuditEvent:
    extras = record.__dict__
    status = extras.get("status")
    if not isinstance(status, str) or not status:
        status = _level_status(record.levelname)
    metadata = {
        key: _cap(value)
        for key, value in extras.items()
        if key in _SAFE_METADATA_KEYS
        and key not in _LOG_STANDARD_ATTRS
        and value is not None
    }
    return AuditEvent(
        event_id=f"evt-{uuid.uuid4().hex[:12]}",
        timestamp=datetime.fromtimestamp(record.created, tz=timezone.utc),
        event_type=event_type,
        component=str(record.name).replace("app.", "") or "app",
        status=_cap(str(status))[:80] or "ok",
        job_id=extras.get("job_id") or None,
        user_id=extras.get("user_id") or None,
        metadata=metadata,
    )


class AuditStore(ABC):
    @abstractmethod
    def configure(self, root: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def append(self, event: AuditEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    def list(
        self,
        user_id: Optional[str] = None,
        job_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        raise NotImplementedError

    @abstractmethod
    def count_by_type(self, event_type: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def stats(self) -> dict:
        raise NotImplementedError


class SqliteAuditStore(AuditStore):
    """Durable, hash-chained audit store backed by SQLite.

    ``configure(path)`` treats its argument as the database path. ``append`` is
    synchronous (the ABC is synchronous and appends run from a logging handler on
    the event loop), guarded by the audit-specific write lock so appends are
    strictly serialized and the chain stays consistent.
    """

    def __init__(self, path: Optional[str] = None) -> None:
        self._conn: Optional[sqlite3.Connection] = None
        if path:
            self.configure(path)

    def configure(self, path: str) -> None:
        self._conn = db.get_audit_connection(path)
        db.init_schema(self._conn, role="audit")

    @staticmethod
    def _canonical(event: AuditEvent) -> str:
        return json.dumps(event.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))

    @staticmethod
    def _row_hash(canonical: str, prev_hash: str) -> str:
        return hashlib.sha256((canonical + prev_hash).encode("utf-8")).hexdigest()

    def append(self, event: AuditEvent) -> None:
        if self._conn is None:
            return
        canonical = self._canonical(event)
        with db.audit_lock:
            row = self._conn.execute("SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
            prev_hash = row["hash"] if row is not None else "0" * 64
            row_hash = self._row_hash(canonical, prev_hash)
            self._conn.execute(
                "INSERT INTO audit_events "
                "(timestamp, event_type, job_id, user_id, data, prev_hash, hash) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    event.timestamp.isoformat(),
                    event.event_type,
                    event.job_id,
                    event.user_id,
                    canonical,
                    prev_hash,
                    row_hash,
                ),
            )
            self._conn.commit()

    def list(
        self,
        user_id: Optional[str] = None,
        job_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        if self._conn is None:
            return []
        clauses = []
        params: list[object] = []
        if user_id is not None:
            clauses.append("user_id = ?")
            params.append(user_id)
        if job_id is not None:
            clauses.append("job_id = ?")
            params.append(job_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        params.extend([max(limit, 0), max(offset, 0)])
        with db.audit_lock:
            rows = self._conn.execute(
                f"SELECT data FROM audit_events {where} ORDER BY seq DESC LIMIT ? OFFSET ?",
                params,
            ).fetchall()
        return [AuditEvent(**json.loads(row["data"])) for row in rows]

    def count_by_type(self, event_type: str) -> int:
        if self._conn is None:
            return 0
        with db.audit_lock:
            row = self._conn.execute(
                "SELECT COUNT(*) AS n FROM audit_events WHERE event_type = ?", (event_type,)
            ).fetchone()
        return int(row["n"])

    def stats(self) -> dict:
        if self._conn is None:
            return {"events": 0, "by_type": {}}
        with db.audit_lock:
            by_type = {
                row["event_type"]: row["n"]
                for row in self._conn.execute(
                    "SELECT event_type, COUNT(*) AS n FROM audit_events GROUP BY event_type"
                ).fetchall()
            }
            total = self._conn.execute("SELECT COUNT(*) AS n FROM audit_events").fetchone()["n"]
        return {"events": int(total), "by_type": by_type}

    def verify_chain(self) -> tuple[bool, Optional[int]]:
        """Walk every row recomputing hashes. Returns (intact, first_bad_seq)."""
        if self._conn is None:
            return (True, None)
        with db.audit_lock:
            rows = self._conn.execute(
                "SELECT seq, data, prev_hash, hash FROM audit_events ORDER BY seq ASC"
            ).fetchall()
        prev_hash = "0" * 64
        for row in rows:
            if row["prev_hash"] != prev_hash:
                return (False, int(row["seq"]))
            if self._row_hash(row["data"], prev_hash) != row["hash"]:
                return (False, int(row["seq"]))
            prev_hash = row["hash"]
        return (True, None)


class AuditLogHandler(logging.Handler):
    """Routes structured log events into the audit store."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            event = record.__dict__.get("event")
            event_type = EVENT_TYPE_MAP.get(event)
            if event_type is None:
                return
            _default_store.append(_event_from_log(record, event_type))
        except Exception:  # audit must never break logging or the app
            pass


_default_store: AuditStore = SqliteAuditStore()
_audit_handler: Optional[AuditLogHandler] = None
_audit_handler_installed = False

# Loggers that emit auditable events. Their level is lifted to INFO so audit
# records reach the handler even when the root logger level is higher (tests
# commonly set root to ERROR to keep output quiet).
_AUDIT_LOGGERS = (
    "app.job_manager",
    "app.worker",
    "app.agent",
    "app.tools",
    "app.multimodal",
    "app.embedding",
    "app.vision",
    "app.resource_scheduler",
    "app.knowledge_base",
)


def get_audit_store() -> AuditStore:
    return _default_store


def set_audit_store(store: AuditStore) -> None:
    """Replace the process-wide audit store (wiring seam)."""
    global _default_store
    _default_store = store


def ensure_audit_handler() -> None:
    """Attach the audit handler to the root logger once per process."""
    global _audit_handler_installed, _audit_handler
    if _audit_handler_installed:
        return
    _audit_handler = AuditLogHandler()
    _audit_handler.setLevel(logging.INFO)
    logging.getLogger().addHandler(_audit_handler)
    for name in _AUDIT_LOGGERS:
        logging.getLogger(name).setLevel(logging.INFO)
    _audit_handler_installed = True
