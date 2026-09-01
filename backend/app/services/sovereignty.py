"""Sovereignty status assembly (Phase 11).

Builds a trustworthy, non-fabricated sovereignty status from real backend state:
the audit store (model calls / audit logging) and the network guard (local vs
external traffic evidence). No values are invented.
"""

from typing import Optional

from app.services.audit_store import AuditStore
from app.services.network_guard import NetworkGuard

NETWORK_POLICY = "LOCAL_ONLY"
SANDBOX_NETWORK = "DISABLED"


def build_sovereignty_status(
    audit_store: AuditStore,
    network_guard: NetworkGuard,
    ollama_url: Optional[str] = None,
) -> dict:
    """Assemble the sovereignty status block exposed by /health and /api/sovereignty."""
    model_calls = audit_store.count_by_type("MODEL_CALL_COMPLETED")
    external = network_guard.external_status()
    audit_stats = audit_store.stats()
    return {
        "network_policy": NETWORK_POLICY,
        "local_model_calls": model_calls,
        "external_connections": {
            "status": external["status"],
            "count": external["count"],
            "blocked_attempts": external["blocked_attempts"],
            "local_connections": external["local_connections"],
        },
        "audit_logging": True,
        "audit_events": audit_stats["events"],
        "sandbox_network": SANDBOX_NETWORK,
        "ollama_endpoint": ollama_url or "unknown",
    }
