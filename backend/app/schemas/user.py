"""User identity model (Phase: real local authentication).

Never carries a password field — password hashes/salts live only in
``auth_store.py``'s storage layer, never in a model that could accidentally
be serialized into a response or a log line.
"""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(BaseModel):
    id: str
    username: str
    role: str = "user"
    created_at: datetime = Field(default_factory=utcnow)
