import { useEffect, useState } from "react";
import { ScrollText, Network as NetworkIcon, Cpu, Route, ShieldCheck } from "lucide-react";
import { getHealth, getSovereignty } from "@/lib/api";
import type { Health, SovereigntyStatus } from "@/lib/types";
import type { AuditEntry, Turn } from "../../lib/types";
import { AuditFeed, LiveBadge } from "../common/AuditFeed";

type Tab = "audit" | "network" | "models";

export function RightRail({ auditLog, activeTurn }: { auditLog: AuditEntry[]; activeTurn?: Turn }) {
  const [tab, setTab] = useState<Tab>("audit");

  return (
    <aside
      className="flex w-[320px] shrink-0 flex-col border-l"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
    >
      <div className="flex border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <RailTab active={tab === "audit"} icon={ScrollText} label="Audit" onClick={() => setTab("audit")} />
        <RailTab active={tab === "network"} icon={NetworkIcon} label="Network" onClick={() => setTab("network")} />
        <RailTab active={tab === "models"} icon={Cpu} label="Models" onClick={() => setTab("models")} />
      </div>

      {tab === "audit" && <AuditTab entries={auditLog} />}
      {tab === "network" && <NetworkTab />}
      {tab === "models" && <ModelsTab activeTurn={activeTurn} />}
    </aside>
  );
}

function RailTab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof ScrollText; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[12px] font-medium transition-colors"
      style={{
        borderColor: active ? "var(--accent-strong)" : "transparent",
        color: active ? "var(--accent-strong)" : "var(--text-tertiary)",
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function AuditTab({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2" style={{ borderColor: "var(--border-subtle)" }}>
        <LiveBadge count={entries.length} />
      </div>
      <AuditFeed entries={entries} />
    </div>
  );
}

interface Endpoint {
  addr: string;
  label: string;
  kind: "local" | "lan";
}

function NetworkTab() {
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const load = () => {
    Promise.all([getSovereignty(), getHealth()])
      .then(([sov, h]) => {
        setSovereignty(sov);
        setHealth(h);
        setError(null);
        setLastCheck(new Date());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load network state."));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endpoints: Endpoint[] = [
    { addr: "127.0.0.1:8000", label: "Workbench API gateway", kind: "local" },
    { addr: sovereignty?.ollama_endpoint?.replace(/^https?:\/\//, "") || "127.0.0.1:11434", label: "Local model runtime (Ollama)", kind: "local" },
    { addr: health?.knowledge_base.vector_store || "127.0.0.1:6333", label: "Local vector database", kind: "local" },
  ];

  const externalCount = sovereignty?.external_connections?.count ?? 0;
  const blocked = sovereignty?.external_connections?.blocked_attempts ?? 0;
  const verifiedLocal = sovereignty?.external_connections?.status === "VERIFIED_LOCAL";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {error ? (
        <p className="mb-3 rounded-md px-3 py-2 text-[11.5px]" style={{ background: "var(--alert-100)", color: "var(--alert-600)" }}>
          {error}
        </p>
      ) : null}
      <div
        className="rounded-lg border p-3.5"
        style={{ borderColor: verifiedLocal ? "var(--safe-100)" : "var(--amber-100)", background: verifiedLocal ? "var(--safe-100)" : "var(--amber-100)" }}
      >
        <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: verifiedLocal ? "var(--safe-600)" : "var(--amber-600)" }}>
          <ShieldCheck size={13} />
          {externalCount} external request{externalCount === 1 ? "" : "s"} this session · {blocked} blocked
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {verifiedLocal
            ? "Network policy default-deny, verified local-only. Only loopback services below are reachable."
            : "Network state not yet verified."}
        </p>
        <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          {sovereignty ? `policy: ${sovereignty.network_policy}` : ""} · last checked {lastCheck.toLocaleTimeString()}
        </p>
      </div>

      <p className="mb-2 mt-4 px-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
        Allowed endpoints
      </p>
      <ul className="flex flex-col gap-2">
        {endpoints.map((n) => (
          <li
            key={n.addr}
            className="flex items-center justify-between rounded-md border px-2.5 py-2"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="min-w-0">
              <p className="mono text-[11.5px]" style={{ color: "var(--text-primary)" }}>{n.addr}</p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{n.label}</p>
            </div>
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase"
              style={{ background: "var(--bg-sunken)", color: "var(--text-tertiary)" }}
            >
              {n.kind}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModelsTab({ activeTurn }: { activeTurn?: Turn }) {
  const [models, setModels] = useState<Record<string, { available: boolean; enabled: boolean }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getHealth()
      .then((h) => {
        if (!alive) return;
        const map: Record<string, { available: boolean; enabled: boolean }> = {};
        for (const [name, av] of Object.entries(h.models)) {
          map[name] = { available: av.available, enabled: av.enabled };
        }
        setModels(map);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load model status."));
    return () => {
      alive = false;
    };
  }, []);

  const routedId = activeTurn?.scenario.routedModelId;
  const routedName =
    activeTurn && (routedId && Object.keys(models).includes(routedId) ? routedId : activeTurn.scenario.routedModelName) || activeTurn?.scenario.routedModelName;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div
        className="mb-4 rounded-lg border p-3.5"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-sunken)" }}
      >
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
          <Route size={13} />
          Active routing
        </div>
        {activeTurn ? (
          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {activeTurn.scenario.categoryLabel} routed to{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{routedName ?? "a local model"}</span>.
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            No task running. The router selects a model automatically once a request is submitted.
          </p>
        )}
      </div>

      <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
        Local models
      </p>
      {error ? (
        <p className="rounded-md px-3 py-2 text-[11.5px]" style={{ background: "var(--alert-100)", color: "var(--alert-600)" }}>
          {error}
        </p>
      ) : Object.keys(models).length === 0 ? (
        <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>Loading model status…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {Object.entries(models).map(([name, av]) => {
            const active = name === routedName;
            return (
              <li
                key={name}
                className="rounded-lg border p-3 transition-colors"
                style={{
                  borderColor: active ? "var(--accent-strong)" : "var(--border-subtle)",
                  background: active ? "var(--bg-selected)" : "transparent",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="break-words text-[12.5px] font-medium leading-tight" style={{ color: "var(--text-primary)" }}>{name}</p>
                  <span className="flex shrink-0 items-center gap-1 text-[10.5px]" style={{ color: av.available ? "var(--safe-600)" : "var(--text-tertiary)" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: av.available ? "var(--safe-500)" : "var(--text-tertiary)" }} />
                    {av.available ? (av.enabled ? "ready" : "disabled") : "offline"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
