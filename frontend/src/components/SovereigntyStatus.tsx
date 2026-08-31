"use client";

import { isLocalHost } from "@/lib/api";
import type { Health } from "@/lib/types";

/**
 * Sovereignty indicator. Only shows facts that are verified from the backend
 * `/health` response. The backend does not expose an "external API calls"
 * counter, so we do not fabricate a number.
 */
export default function SovereigntyStatus({ health }: { health: Health | null }) {
  const url = health?.ollama.url;
  const reachable = Boolean(health?.ollama.reachable);
  const local = url ? isLocalHost(url) : false;
  const configuredCount = health ? Object.keys(health.models).length : 0;
  const availableCount = health
    ? Object.values(health.models).filter((m) => m.available).length
    : 0;

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
          <dt>Model calls</dt>
          <dd>{url ? `LOCAL — Ollama at ${url}` : "unknown"}</dd>
        </div>
        <div>
          <dt>Ollama endpoint</dt>
          <dd>
            <StatusBadgeInline ok={reachable} yes="LOCAL" no="UNREACHABLE" />
          </dd>
        </div>
        <div>
          <dt>Internet</dt>
          <dd>{local ? "LOCAL ONLY (single local endpoint)" : "UNVERIFIED"}</dd>
        </div>
        <div>
          <dt>External APIs</dt>
          <dd>not tracked by backend — no counter to display</dd>
        </div>
        <div>
          <dt>Local models</dt>
          <dd>
            {availableCount}/{configuredCount} available
          </dd>
        </div>
      </dl>
    </section>
  );
}

function StatusBadgeInline({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`badge ${ok ? "badge-ok" : "badge-error"}`}>{ok ? yes : no}</span>;
}
