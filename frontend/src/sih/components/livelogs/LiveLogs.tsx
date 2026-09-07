import { useEffect, useState } from "react";
import { Route, Package, ScrollText, ShieldCheck, WifiOff } from "lucide-react";
import { AuditFeed, LiveBadge } from "../common/AuditFeed";
import type { AuditEntry, Turn } from "../../lib/types";

function StatTile({ icon: Icon, value, label }: { icon: typeof Route; value: string; label: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-4"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="mono text-xl font-semibold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="mt-1 truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>{label}</p>
      </div>
    </div>
  );
}

export function LiveLogs({ turns, auditLog }: { turns: Turn[]; auditLog: AuditEntry[] }) {
  const [lastCheck, setLastCheck] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setLastCheck(new Date()), 4000);
    return () => clearInterval(id);
  }, []);

  const deliverableCount = turns.filter((t) => t.scenario.deliverable && t.approval !== "rejected").length;
  const securityEvents = auditLog.filter((e) => e.category === "security").length;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Live logs
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Governance and observability. Every action the agent takes this session is written here, in order, as it happens.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Route} value={String(turns.length)} label="Tasks this session" />
          <StatTile icon={Package} value={String(deliverableCount)} label="Deliverables" />
          <StatTile icon={ScrollText} value={String(auditLog.length)} label="Audit events" />
          <StatTile icon={ShieldCheck} value={String(securityEvents)} label="Security checks" />
        </div>

        <div
          className="mt-6 flex items-center gap-3 rounded-lg border p-4"
          style={{ borderColor: "var(--safe-100)", background: "var(--safe-100)" }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.5)", color: "var(--safe-600)" }}
          >
            <WifiOff size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: "var(--safe-600)" }}>0 external requests this session</p>
            <p className="mono mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              last checked {lastCheck.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="mb-3 mt-8 flex items-center justify-between">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            Full activity log
          </p>
          <LiveBadge count={auditLog.length} />
        </div>
        <div
          className="flex h-[420px] flex-col rounded-lg border"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <AuditFeed entries={auditLog} dense={false} className="px-4 py-2" />
        </div>
      </div>
    </div>
  );
}
