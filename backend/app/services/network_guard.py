"""External network guard + local-only traffic evidence (Phase 11).

Every outbound HTTP request the backend makes passes through a ``NetworkGuard``
(via ``GuardedTransport``). Loopback and the explicitly configured local service
endpoint are permitted and counted as LOCAL; anything else is an external
attempt — recorded and (by default) blocked, so no external request succeeds.

This makes the claim "the application makes no external HTTP calls" measurable
from real request traffic rather than a UI statement. OS-level packet capture is
intentionally not used (no privileged tooling).
"""

import logging
import urllib.parse
from typing import Optional, Union

import httpx

logger = logging.getLogger("app.network_guard")

LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


class ExternalNetworkBlocked(Exception):
    """An outbound HTTP request to a non-local destination was blocked."""


def hostname_of(url: Union[str, "httpx.URL"]) -> Optional[str]:
    try:
        parsed = urllib.parse.urlsplit(str(url))
        host = parsed.hostname
        return host.lower() if host else None
    except ValueError:
        return None


class NetworkGuard:
    """Classifies outbound HTTP destinations as LOCAL or EXTERNAL.

    ``allowed_hosts`` are the explicitly permitted local service endpoints
    (e.g. the configured Ollama host); loopback is always permitted. When
    ``block_external`` is True (default), external destinations raise
    ``ExternalNetworkBlocked`` instead of connecting.
    """

    def __init__(self, allowed_hosts=None, block_external: bool = True) -> None:
        self._allowed = set(allowed_hosts or ()) | LOOPBACK_HOSTS
        self._block_external = block_external
        self._local_calls = 0
        self._external_attempts = 0
        self._external_succeeded = 0

    @property
    def block_external(self) -> bool:
        return self._block_external

    def is_local(self, url) -> bool:
        host = hostname_of(url)
        if host is None:
            return True  # unparseable -> treat as local to avoid false blocks
        return host in self._allowed

    def record(self, url) -> None:
        if self.is_local(url):
            self._local_calls += 1
            return
        host = hostname_of(url) or "unknown"
        self._external_attempts += 1
        logger.warning(
            "external_network_attempt",
            extra={"event": "external_network_attempt", "destination_host": host},
        )
        if self._block_external:
            raise ExternalNetworkBlocked(f"External network call blocked (host '{host}')")
        self._external_succeeded += 1

    def local_calls(self) -> int:
        return self._local_calls

    def external_attempts(self) -> int:
        return self._external_attempts

    def external_succeeded(self) -> int:
        return self._external_succeeded

    def status(self) -> str:
        """VERIFIED_LOCAL / VERIFIED_EXTERNAL / UNKNOWN."""
        if self._external_succeeded > 0:
            return "VERIFIED_EXTERNAL"
        if self._local_calls == 0 and self._external_attempts == 0:
            return "UNKNOWN"
        return "VERIFIED_LOCAL"

    def external_status(self) -> dict:
        return {
            "status": self.status(),
            "count": self._external_succeeded,
            "blocked_attempts": self._external_attempts,
            "local_connections": self._local_calls,
        }


class GuardedTransport(httpx.AsyncBaseTransport):
    """Wraps any httpx transport and records each request with the guard."""

    def __init__(self, inner: httpx.AsyncBaseTransport, guard: NetworkGuard) -> None:
        self._inner = inner
        self._guard = guard

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self._guard.record(request.url)
        return await self._inner.handle_async_request(request)

    async def aclose(self) -> None:
        await self._inner.aclose()


def make_guarded_transport(
    transport: Optional[httpx.AsyncBaseTransport], guard: NetworkGuard
) -> httpx.AsyncBaseTransport:
    """Wrap ``transport`` (or the default) so all traffic passes the guard."""
    inner = transport if transport is not None else httpx.AsyncHTTPTransport()
    return GuardedTransport(inner, guard)
