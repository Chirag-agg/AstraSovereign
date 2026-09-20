"""HTTP API: local login/logout, verified via a signed session cookie.

Replaces trusting a client-supplied ``X-User-ID``/``X-Role`` header (see
``deps.py``): a session's ``user_id``/``role`` come only from a password
verified against ``UserStore``, never from anything the client asserts.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import get_session
from app.schemas.auth import LoginRequest, SessionInfo
from app.services.auth_store import verify_password
from app.services.session import SESSION_COOKIE_NAME, SessionPayload, create_session_token

logger = logging.getLogger("app.api.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=SessionInfo)
async def login(payload: LoginRequest, request: Request, response: Response) -> SessionInfo:
    settings = request.app.state.settings
    user_store = request.app.state.user_store
    secret = request.app.state.session_secret

    entry = await user_store.get_by_username(payload.username)
    # Same error, same shape, whether the username doesn't exist or the
    # password is wrong — never reveal which one it was.
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": "invalid_credentials", "message": "Invalid username or password."},
    )
    if entry is None:
        raise invalid
    user, password_hash, salt_hex = entry
    if not verify_password(payload.password, salt_hex, password_hash):
        raise invalid

    token = create_session_token(
        user_id=user.id, role=user.role, secret=secret, ttl_seconds=settings.session_ttl_seconds
    )
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        max_age=settings.session_ttl_seconds,
    )
    logger.info("login_succeeded", extra={"event": "login_succeeded", "user_id": user.id})
    return SessionInfo(user_id=user.id, username=user.username, role=user.role)


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"ok": True}


@router.get("/me", response_model=SessionInfo)
async def me(
    request: Request, session: SessionPayload = Depends(get_session)
) -> SessionInfo:
    user_store = request.app.state.user_store
    user = await user_store.get_by_id(session.user_id)
    username = user.username if user is not None else session.user_id
    return SessionInfo(user_id=session.user_id, username=username, role=session.role)
