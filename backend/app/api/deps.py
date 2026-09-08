"""Shared FastAPI dependencies (user identity)."""

from typing import Optional

from fastapi import Header

X_USER_ID_HEADER = "x-user-id"
DEFAULT_USER_ID = "user-001"


def get_user_id(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-ID"),
) -> str:
    """Return the caller's user id from the ``X-User-ID`` header.

    Development fallback: if the header is absent, a safe default id is used.
    This dependency is the single seam where real authentication can be
    plugged in later without touching the routes.
    """
    user_id = (x_user_id or DEFAULT_USER_ID).strip()
    if not user_id:
        user_id = DEFAULT_USER_ID
    return user_id[:64]
