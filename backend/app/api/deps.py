"""Shared FastAPI dependencies (user identity).

``get_session`` is the single seam identity flows through: a verified
``astra_session`` cookie always wins; a raw ``X-User-ID``/``X-Role`` header is
trusted ONLY when ``request.app.state.dev_header_auth`` is ``True`` — a flag
set by a ``create_app(dev_header_auth=True)`` call site in source (see
``tests/conftest.py``) or by ``settings.demo_mode``. ``demo_mode`` is off by
default and is the one switch that turns authentication off; with it on,
anyone who can reach the port can name any user, admin included.
"""

from typing import Optional

from fastapi import Depends, HTTPException, Request, status

from app.services.session import SESSION_COOKIE_NAME, SessionPayload, verify_session_token

X_USER_ID_HEADER = "x-user-id"
DEFAULT_USER_ID = "user-001"


def get_session(request: Request) -> SessionPayload:
    """The caller's verified identity, or a 401 if none can be established."""
    secret = getattr(request.app.state, "session_secret", None)
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token and secret:
        session = verify_session_token(token, secret)
        if session is not None:
            return session

    if getattr(request.app.state, "dev_header_auth", False):
        x_user_id: Optional[str] = request.headers.get("X-User-ID")
        x_role: Optional[str] = request.headers.get("X-Role")
        user_id = (x_user_id or DEFAULT_USER_ID).strip() or DEFAULT_USER_ID
        return SessionPayload(user_id=user_id[:64], role=(x_role or "user"), expires_at=0)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": "not_authenticated", "message": "Log in via /api/auth/login."},
    )


def get_user_id(session: SessionPayload = Depends(get_session)) -> str:
    """The caller's user id, from the verified session. The seam every route
    dependency (``Depends(get_user_id)``) already uses; unchanged signature."""
    return session.user_id
