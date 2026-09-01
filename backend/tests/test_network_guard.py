"""Network guard + sovereignty evidence tests (Phase 11)."""

import pytest

from app.services.network_guard import (
    ExternalNetworkBlocked,
    GuardedTransport,
    NetworkGuard,
    hostname_of,
)


def test_localhost_traffic_classified_local():
    guard = NetworkGuard()
    assert guard.is_local("http://localhost:11434/api/generate")
    assert guard.is_local("http://127.0.0.1:11434/api/generate")
    assert guard.is_local("http://[::1]:11434/api/generate")


def test_configured_local_service_host_is_permitted():
    guard = NetworkGuard(allowed_hosts={"ollama.test"})
    assert guard.is_local("http://ollama.test/api/generate")
    guard.record("http://ollama.test/api/generate")
    assert guard.local_calls() == 1
    assert guard.external_attempts() == 0


def test_external_traffic_blocked():
    guard = NetworkGuard()
    with pytest.raises(ExternalNetworkBlocked, match="External network call blocked"):
        guard.record("https://api.example.com/v1/chat")
    assert guard.external_attempts() == 1
    assert guard.external_succeeded() == 0
    assert guard.local_calls() == 0


def test_external_traffic_surfaces_when_not_blocked():
    guard = NetworkGuard(block_external=False)
    guard.record("https://api.example.com/v1/chat")  # no raise
    assert guard.external_succeeded() == 1
    assert guard.status() == "VERIFIED_EXTERNAL"


def test_unknown_network_state_when_no_traffic():
    guard = NetworkGuard()
    assert guard.status() == "UNKNOWN"
    status = guard.external_status()
    assert status["count"] == 0
    assert status["status"] == "UNKNOWN"
    assert status["blocked_attempts"] == 0


def test_verified_local_after_only_local_traffic():
    guard = NetworkGuard()
    guard.record("http://localhost:11434/api/generate")
    assert guard.status() == "VERIFIED_LOCAL"
    assert guard.external_status()["count"] == 0


def test_hostname_extraction():
    assert hostname_of("http://localhost:11434") == "localhost"
    assert hostname_of("https://api.example.com/x") == "api.example.com"
    assert hostname_of("http://[::1]:80/") == "::1"


class FakeTransport:
    def __init__(self):
        self.seen = []

    async def handle_async_request(self, request):
        self.seen.append(str(request.url))
        return request  # echo

    async def aclose(self):
        pass


def test_guarded_transport_records_and_forwards():
    import httpx

    guard = NetworkGuard()
    inner = FakeTransport()
    transport = GuardedTransport(inner, guard)  # type: ignore[arg-type]

    async def run():
        request = httpx.Request("GET", "http://localhost:11434/api/tags")
        return await transport.handle_async_request(request)

    import asyncio

    asyncio.run(run())
    assert guard.local_calls() == 1
    assert len(inner.seen) == 1
