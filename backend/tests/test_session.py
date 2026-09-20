"""Unit tests for signed session tokens (pure functions, no app needed)."""

import time

from app.services.session import create_session_token, verify_session_token


def test_valid_token_round_trips():
    token = create_session_token("usr-1", "user", secret="s3cret", ttl_seconds=3600)
    session = verify_session_token(token, secret="s3cret")
    assert session is not None
    assert session.user_id == "usr-1"
    assert session.role == "user"


def test_tampered_signature_is_rejected():
    token = create_session_token("usr-1", "admin", secret="s3cret", ttl_seconds=3600)
    tampered = token[:-4] + ("0000" if not token.endswith("0000") else "1111")
    assert verify_session_token(tampered, secret="s3cret") is None


def test_wrong_secret_is_rejected():
    token = create_session_token("usr-1", "user", secret="s3cret", ttl_seconds=3600)
    assert verify_session_token(token, secret="different-secret") is None


def test_expired_token_is_rejected():
    token = create_session_token("usr-1", "user", secret="s3cret", ttl_seconds=-10)
    assert verify_session_token(token, secret="s3cret") is None


def test_malformed_token_does_not_raise():
    assert verify_session_token("not-even-base64!!!", secret="s3cret") is None
    assert verify_session_token("", secret="s3cret") is None
    import base64

    garbage = base64.urlsafe_b64encode(b"missing|pipes").decode()
    assert verify_session_token(garbage, secret="s3cret") is None


def test_role_is_carried_through():
    token = create_session_token("usr-2", "admin", secret="s3cret", ttl_seconds=3600)
    session = verify_session_token(token, secret="s3cret")
    assert session.role == "admin"


def test_expires_at_is_in_the_future_for_a_fresh_token():
    token = create_session_token("usr-1", "user", secret="s3cret", ttl_seconds=100)
    session = verify_session_token(token, secret="s3cret")
    assert session.expires_at > int(time.time())
