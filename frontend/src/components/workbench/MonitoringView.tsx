"use client";

import React, { useEffect, useState, useCallback } from "react";
import { FigurePanel, StatSlab } from "@/components/ui/instrument";
import { Activity, RefreshCw, AlertCircle, Wifi } from "lucide-react";
import { getAdminSystem, getHealth } from "@/lib/api";
import type { AdminSystemHealth, ComponentState, Health } from "@/lib/types";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

const LABELS: { key: keyof AdminSystemHealth; label: string }[] = [
  { key: "ollama", label: "Ollama runtime" },
  { key: "models", label: "Model registry" },
  { key: "worker", label: "Worker" },
  { key: "queue", label: "Job queue" },
  { key: "scheduler", label: "Scheduler" },
  { key: "knowledge_base", label: "Knowledge base" },
  { key: "ocr", label: "OCR" },
  { key: "vision", label: "Vision" },
  { key: "document_generation", label: "Document generation" },
  { key: "audit_store", label: "Audit store" },
];

function stateStyles(state: ComponentState): {
  pill: string;
  dot: string;
  icon: React.ReactNode;
} {
  switch (state) {
    case "HEALTHY":
      return {
        pill: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
        dot: "bg-emerald-500",
        icon: <span className="w-2 h-2 rounded-full bg-emerald-500" />,
      };
    case "DEGRADED":
      return {
        pill: "bg-amber-50 text-amber-700 border-amber-200/60",
        dot: "bg-amber-500",
        icon: <span className="w-2 h-2 rounded-full bg-amber-500" />,
      };
    case "UNAVAILABLE":
      return {
        pill: "bg-rose-50 text-rose-700 border-rose-200/60",
        dot: "bg-rose-500",
        icon: <span className="w-2 h-2 rounded-full bg-rose-500" />,
      };
    default:
      return {
        pill: "bg-slate-100 text-slate-600 border-slate-200/60",
        dot: "bg-slate-400",
        icon: <span className="w-2 h-2 rounded-full bg-slate-400" />,
      };
  }
}

export default function MonitoringView() {
  const [system, setSystem] = useState<AdminSystemHealth | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [sys, h] = await Promise.all([getAdminSystem(), getHealth()]);
      setSystem(sys);
      setHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load system health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const states = LABELS.map(({ key, label }) => ({
    label,
    state: ((system?.[key] as ComponentState) ?? "UNKNOWN") as ComponentState,
  }));
  const okCount = states.filter((s) => s.state === "HEALTHY").length;
  const degraded = states.filter((s) => s.state !== "HEALTHY" && s.state !== "UNKNOWN");

  const TONE: Record<ComponentState, string> = {
    HEALTHY: "var(--metric)",
    DEGRADED: "var(--ochre)",
    UNAVAILABLE: "var(--alert)",
    UNKNOWN: "var(--graphite)",
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Subsystems</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>System health</h1>
            <p style={{ margin: "8px 0 0" }}>
              Ten subsystems, each reporting its own state. UNKNOWN means not yet observed —
              it is not the same as healthy, and this page will not round it up to one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 font-mono uppercase shrink-0"
            style={{ fontSize: 10.5, letterSpacing: "0.08em", padding: "7px 11px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div role="alert" style={{ borderLeft: "2px solid var(--alert)", padding: "10px 14px", background: "var(--alert-surface)", borderRadius: 2, fontSize: 13, color: "var(--alert-ink)" }}>
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,230px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab
              value={`${okCount}/${states.length}`}
              label="Reporting OK"
              tone={okCount === states.length ? "metric" : okCount === 0 ? "neutral" : "signal"}
            />
            {degraded.length > 0 && (
              <FigurePanel figure="2" title="Needs attention">
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {degraded.map((s) => (
                    <li key={s.label} className="flex items-center justify-between gap-2" style={{ padding: "8px 0", borderBottom: "1px solid var(--carbon)" }}>
                      <span style={{ fontSize: 13.5, color: "var(--bone)" }}>{s.label}</span>
                      <span className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: TONE[s.state] }}>
                        {s.state}
                      </span>
                    </li>
                  ))}
                </ul>
              </FigurePanel>
            )}
          </div>

          <FigurePanel figure="1" title="Subsystem states" caption="polled from /health" flush>
            <table>
              <thead>
                <tr><th>Subsystem</th><th>State</th><th>Meaning</th></tr>
              </thead>
              <tbody>
                {states.map((s) => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td>
                      <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: TONE[s.state] }}>
                        <span style={{ width: 5, height: 5, borderRadius: 99, background: TONE[s.state] }} />
                        {s.state}
                      </span>
                    </td>
                    <td style={{ color: "var(--granite)" }}>
                      {s.state === "HEALTHY"
                        ? "responding"
                        : s.state === "UNKNOWN"
                          ? "not observed yet"
                          : s.state === "DEGRADED"
                            ? "responding, but not fully"
                            : "not responding"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FigurePanel>
        </div>
      </div>
    </div>
  );
}
