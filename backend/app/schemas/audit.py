"""Audit event models (Phase 11).

Audit events are non-sensitive by design: they never carry prompts, generated
responses, document contents, OCR text, vision output, source code, or secrets —
only identifiers and small metadata values.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuditEvent(BaseModel):
    event_id: str
    timestamp: datetime = Field(default_factory=utcnow)
    event_type: str
    component: str = "app"
    status: str = "ok"
    job_id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
