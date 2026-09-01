"use client";

import { isLocalHost } from "@/lib/api";
import type { Health } from "@/lib/types";

/**
 * Sovereignty indicator. Shows only facts verified from the backend `/health`
 * payload: network policy, external-traffic evidence from the NetworkGuard,
 * audit-logging state, and local model call counts. Never fabricates values.
 */
export default function SovereigntyStatus({ health }: { health: Health | null }) {
  const url = health?.ollama.url;
  const reachable = Boolean(health?.ollama.reachable);
  const local = url ? isLocalHost(url) : false;
  const s = health?.sovereignty;
  const external = s?.external_connections;

  const externalLabel = external
    ? `${external.status} · ${external.count} external${
        external.blocked_attempts ? ` · ${external.blocked_attempts} blocked` : ""
      }`
    : "UNKNOWN";

  return (
    <section className="panel sovereignty" aria-label="Sovereignty status">
      <div className="panel-title">Sovereignty</div>
      <div className="sovereign-badge" role="status" aria-label="Local / sovereign mode">
        <span className="sovereign-badge-icon" aria-hidden="true">
          🛡
        </span>
        <span>
          <strong>LOCAL</strong> / SOVEREIGN
        </span>
      </div>
      <dl className="fact-list">
        <div>
          <dt>Network policy</dt>
          <dd>{s?.network_policy ?? "unknown"}</dd>
        </div>
        <div>
          <dt>External network</dt>
          <dd>{externalLabel}</dd>
        </div>
        <div>
          <dt>Model calls</dt>
          <dd>
            {url ? `LOCAL — Ollama at ${url}` : "unknown"} · {s?.local_model_calls ?? 0} total
          </dd>
        </div>
        <div>
          <dt>Ollama</dt>
          <dd>{reachable ? "reachable" : "unreachable"}</dd>
        </div>
        <div>
          <dt>Audit logging</dt>
          <dd>{s?.audit_logging ? "ENABLED" : "DISABLED"}</dd>
        </div>
        <div>
          <dt>Sandbox network</dt>
          <dd>{s?.sandbox_network ?? "DISABLED"}</dd>
        </div>
        <div>
          <dt>Audit events</dt>
          <dd>{s?.audit_events ?? 0}</dd>
        </div>
        <div>
          <dt>Local services</dt>
          <dd>{local ? "on this machine" : "unverified"}</dd>
        </div>
      </dl>
    </section>
  );
}
