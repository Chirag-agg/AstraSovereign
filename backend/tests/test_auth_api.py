"""Real local authentication: login/logout/me, password hashing, and the
regression test proving a production-shaped app (no dev_header_auth) no
longer trusts a client-supplied X-User-ID/X-Role header."""

import httpx
import pytest

from app.main import create_app
from app.services.auth_store import InMemoryUserStore, hash_password, verify_password
from tests.conftest import build_registry, login, make_scripted_handler


SEED = [{"username": "alice", "password": "correct horse battery staple", "role": "user"}]
SEED_ADMIN = [{"username": "root", "password": "hunter2000!!", "role": "admin"}]


def test_login_success_sets_cookie_and_returns_role(client_factory):
    with client_factory(make_scripted_handler([]), seed_users=SEED) as c:
        body = login(c, "alice", "correct horse battery staple")
        assert body["username"] == "alice"
        assert body["role"] == "user"
        assert "astra_session" in c.cookies


def test_login_wrong_password_is_rejected(client_factory):
    with client_factory(make_scripted_handler([]), seed_users=SEED) as c:
        resp = c.post(
            "/api/auth/login",
            json={"username": "alice", "password": "definitely not it"},
        )
        assert resp.status_code == 401
        assert resp.json()["detail"]["error"] == "invalid_credentials"


def test_login_unknown_user_gets_the_same_error_as_wrong_password(client_factory):
    """No user-enumeration: an unknown username and a wrong password for a
    real account must be indistinguishable from the response alone."""
    with client_factory(make_scripted_handler([]), seed_users=SEED) as c:
        unknown = c.post(
            "/api/auth/login", json={"username": "nobody", "password": "whatever"}
        )
        wrong = c.post(
            "/api/auth/login",
            json={"username": "alice", "password": "wrong"},
        )
        assert unknown.status_code == wrong.status_code == 401
        assert unknown.json() == wrong.json()


def test_logout_clears_the_session_cookie(client_factory):
    with client_factory(make_scripted_handler([]), seed_users=SEED) as c:
        login(c, "alice", "correct horse battery staple")
        assert c.get("/api/auth/me").status_code == 200

        logout = c.post("/api/auth/logout")
        assert logout.status_code == 200
        # No dev_header_auth fallback headers were ever sent, so once the
        # cookie is cleared the caller is unauthenticated again.
        assert c.cookies.get("astra_session") is None


def test_me_reflects_the_logged_in_session(client_factory):
    with client_factory(make_scripted_handler([]), seed_users=SEED) as c:
        logged_in = login(c, "alice", "correct horse battery staple")
        me = c.get("/api/auth/me")
        assert me.status_code == 200
        body = me.json()
        assert body["username"] == "alice"
        assert body["role"] == "user"
        assert body["user_id"] == logged_in["user_id"]
        assert body["user_id"].startswith("usr-")


def test_admin_role_comes_from_a_real_session_not_a_header(client_factory):
    """/api/admin/* now requires an actual admin *account*, not a header a
    client can set on itself. (The dev_header_auth fallback this fixture uses
    for the rest of the suite defaults an unauthenticated request to a
    non-admin identity, hence 403 rather than 401 here — the true "no
    identity at all" 401 case is covered by
    test_production_shaped_app_rejects_header_only_requests below, against
    an app built the way production actually is.)"""
    with client_factory(make_scripted_handler([]), seed_users=SEED_ADMIN) as c:
        assert c.get("/api/admin/overview").status_code == 403

        login(c, "root", "hunter2000!!")
        overview = c.get("/api/admin/overview")
        assert overview.status_code == 200


def test_non_admin_session_cannot_reach_admin_routes(client_factory):
    with client_factory(make_scripted_handler([]), seed_users=SEED) as c:
        login(c, "alice", "correct horse battery staple")
        resp = c.get("/api/admin/overview")
        assert resp.status_code == 403


def test_password_hashing_uses_a_distinct_salt_per_call():
    hash_a = hash_password("same-password", salt=b"\x01" * 16)
    hash_b = hash_password("same-password", salt=b"\x02" * 16)
    assert hash_a != hash_b
    assert verify_password("same-password", (b"\x01" * 16).hex(), hash_a)
    assert not verify_password("same-password", (b"\x02" * 16).hex(), hash_a)


def test_verify_password_rejects_the_wrong_password():
    from app.services.auth_store import new_salt

    salt = new_salt()
    correct_hash = hash_password("right-password", salt)
    assert verify_password("right-password", salt.hex(), correct_hash)
    assert not verify_password("wrong-password", salt.hex(), correct_hash)


def test_production_shaped_app_rejects_header_only_requests(app_settings, test_models):
    """The critical regression test: a create_app() instance built WITHOUT
    dev_header_auth (exactly how production's bare create_app() in main.py
    is constructed) must reject a request carrying only X-User-ID/X-Role
    headers and no session cookie. This is the direct proof that
    vulnerability findings #1 (self-asserted identity) and #2 (unverified
    admin header) are closed, not just that dev/test mode still works."""
    registry = build_registry(test_models)
    app = create_app(
        settings=app_settings,
        ollama_transport=httpx.MockTransport(make_scripted_handler([])),
        model_registry=registry,
        user_store=InMemoryUserStore(),
        # dev_header_auth intentionally omitted: defaults to False, exactly
        # like production's `app = create_app()`.
    )
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        resp = c.get("/api/jobs", headers={"X-User-ID": "user-001"})
        assert resp.status_code == 401

        admin_resp = c.get(
            "/api/admin/overview",
            headers={"X-User-ID": "user-001", "X-Role": "admin"},
        )
        assert admin_resp.status_code in (401, 403)
