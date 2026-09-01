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
import json
import logging
import threading
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.schemas.audit import AuditEvent

logger = logging.getLogger("app.audit_store")

# Existing structured log `event` values -> audit event types.
EVENT_TYPE_MAP = {
    "job_created": "JOB_CREATED",
    "job_started": "JOB_STARTED",
    "job_completed": "JOB_COMPLETED",
    "job_failed": "JOB_FAILED",
    "model_selected": "MODEL_SELECTED",
    "model_call_started": "MODEL_CALL_STARTED",
    "model_call_completed": "MODEL_CALL_COMPLETED",
    "tool_call_started": "TOOL_CALL_STARTED",
    "tool_call_completed": "TOOL_CALL_COMPLETED",
    "document_ingestion_started": "DOCUMENT_INGESTION_STARTED",
    "document_ingestion_completed": "DOCUMENT_INGESTION_COMPLETED",
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
    "resource_allocated": "RESOURCE_ALLOCATED",
    "resource_released": "RESOURCE_RELEASED",
}

# Only these extra fields are ever copied into audit metadata (nothing else).
_SAFE_METADATA_KEYS = {
    "model",
    "task_type",
    "tool",
    "page",
    "provider",
    "language",
    "exit_code",
    "duration_ms",
    "size_bytes",
    "status",
    "reason",
    "document_id",
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


class JsonlAuditStore(AuditStore):
    """Append-only JSONL store on the local filesystem.

    ``configure(root)`` points the store at ``<root>/audit.jsonl`` and loads any
    existing lines (restart-safe). Writes are serialized by a ``threading.Lock``.
    """

    def __init__(self) -> None:
        self._path: Optional[Path] = None
        self._events: list[AuditEvent] = []
        self._lock = threading.Lock()

    @property
    def path(self) -> Optional[Path]:
        return self._path

    def configure(self, root: str) -> None:
        with self._lock:
            path = Path(root) / "audit.jsonl"
            path.parent.mkdir(parents=True, exist_ok=True)
            self._events = []
            self._path = path
            if path.exists():
                for line in path.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    try:
                        self._events.append(AuditEvent(**json.loads(line)))
                    except (ValueError, TypeError):
                        continue  # tolerate a corrupt line; never crash startup

    def reset(self) -> None:
        with self._lock:
            self._events = []
            self._path = None

    def append(self, event: AuditEvent) -> None:
        with self._lock:
            self._events.append(event)
            if self._path is not None:
                try:
                    with self._path.open("a", encoding="utf-8") as fh:
                        fh.write(json.dumps(event.model_dump(mode="json")) + "\n")
                except OSError:
                    logger.warning(
                        "audit_append_error",
                        extra={"event": "audit_append_error", "error": "cannot write audit file"},
                    )

    def list(
        self,
        user_id: Optional[str] = None,
        job_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        with self._lock:
            events = list(self._events)
        if user_id is not None:
            events = [e for e in events if e.user_id == user_id]
        if job_id is not None:
            events = [e for e in events if e.job_id == job_id]
        events.sort(key=lambda e: (e.timestamp, e.event_id), reverse=True)
        return events[offset : offset + max(limit, 0)]

    def count_by_type(self, event_type: str) -> int:
        with self._lock:
            return sum(1 for e in self._events if e.event_type == event_type)

    def stats(self) -> dict:
        with self._lock:
            by_type: dict[str, int] = {}
            for e in self._events:
                by_type[e.event_type] = by_type.get(e.event_type, 0) + 1
            return {"events": len(self._events), "by_type": by_type}


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


_default_store = JsonlAuditStore()
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


def get_audit_store() -> JsonlAuditStore:
    return _default_store


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
