"""Signed session tokens (Phase: real local authentication).

Stdlib-only: ``hmac``/``hashlib``/``base64``/``secrets``. A token is
``base64(user_id|role|expires_at|hmac_sha256_hex)``; verification recomputes
the HMAC and compares with ``hmac.compare_digest``, then checks expiry.
Malformed/tampered/expired input always returns ``None`` — never raises past
this module, since a bad cookie must never crash a request.

``user_id``/``role`` are internally generated (``usr-<hex>`` ids, a small
fixed set of role strings) and never contain ``|``, so the plain split below
is safe; this module does not accept externally-chosen values into either
field.
"""

import base64
import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

SESSION_COOKIE_NAME = "astra_session"


@dataclass
class SessionPayload:
    user_id: str
    role: str
    expires_at: int


def _sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def create_session_token(user_id: str, role: str, secret: str, ttl_seconds: int) -> str:
    expires_at = int(time.time()) + int(ttl_seconds)
    payload = f"{user_id}|{role}|{expires_at}"
    signature = _sign(payload, secret)
    raw = f"{payload}|{signature}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def verify_session_token(token: str, secret: str) -> Optional[SessionPayload]:
    if not token:
        return None
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        user_id, role, expires_at_str, signature = raw.split("|", 3)
        expected = _sign(f"{user_id}|{role}|{expires_at_str}", secret)
        if not hmac.compare_digest(signature, expected):
            return None
        expires_at = int(expires_at_str)
    except Exception:
        return None
    if expires_at < int(time.time()):
        return None
    return SessionPayload(user_id=user_id, role=role, expires_at=expires_at)


def load_or_create_session_secret(session_secret: str, session_secret_file: str) -> str:
    """Env var first; otherwise read-or-create a secret file under ``data/``
    so restarts don't invalidate every session (a fresh random secret on
    every boot would log every user out each time)."""
    if session_secret:
        return session_secret
    path = Path(session_secret_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    secret = secrets.token_hex(32)
    path.write_text(secret, encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return secret
