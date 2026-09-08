"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Globe,
  Server,
  Cpu,
  FileClock,
  ScanEye,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { getSovereignty, getHealth } from "@/lib/api";
import type { SovereigntyStatus, Health } from "@/lib/types";

function Pill({ tone, children }: { tone: "ok" | "bad" | "warn" | "neutral"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
      : tone === "bad"
      ? "bg-rose-50 text-rose-700 border-rose-200/60"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200/60"
      : "bg-slate-100 text-slate-600 border-slate-200/60";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {children}
    </span>
  );
}

type PillTone = "ok" | "bad" | "warn" | "neutral";

function externalTone(status: string): PillTone {
  if (status === "VERIFIED_LOCAL") return "ok";
  if (status === "VERIFIED_EXTERNAL") return "bad";
  if (status === "NOT_TRACKED") return "neutral";
  return "warn";
}

export default function SecurityConsoleView() {
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [sovereigntyData, healthData] = await Promise.all([
        getSovereignty(),
        getHealth(),
      ]);
      setSovereignty(sovereigntyData);
      setHealth(healthData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load security status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards: {
    icon: React.ReactNode;
    title: string;
    value: string;
    detail: string;
    pill: React.ReactNode;
  }[] = [];

  if (sovereignty) {
    const netTone =
      /local|block|air.?gap/i.test(sovereignty.network_policy) ? "ok" : "neutral";
    const s = sovereignty;
    cards.push({
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "Network policy",
      value: s.network_policy,
      detail: `Sandbox egress: ${s.sandbox_network}`,
      pill: (
        <Pill tone={netTone}>
          {/local|block/i.test(s.network_policy) ? "Restricted" : "Configured"}
        </Pill>
      ),
    });
    cards.push({
      icon: <Globe className="w-5 h-5" />,
      title: "External connections",
      value: s.external_connections.status.replace("_", " "),
      detail: `${s.external_connections.count} tracked · ${s.external_connections.blocked_attempts} blocked · ${s.external_connections.local_connections} local`,
      pill: (
        <Pill tone={externalTone(s.external_connections.status)}>
          {s.external_connections.status}
        </Pill>
      ),
    });
    cards.push({
      icon: <Server className="w-5 h-5" />,
      title: "Sandbox network",
      value: s.sandbox_network,
      detail: "Network access granted to generated code",
      pill: (
        <Pill tone={/block|none|isolated/i.test(s.sandbox_network) ? "ok" : "warn"}>
          {/block|none|isolated/i.test(s.sandbox_network) ? "Isolated" : "Open"}
        </Pill>
      ),
    });
    cards.push({
      icon: <Cpu className="w-5 h-5" />,
      title: "Local model calls",
      value: String(s.local_model_calls),
      detail: "Inference calls kept on this machine",
      pill: <Pill tone="ok">Local only</Pill>,
    });
    cards.push({
      icon: <FileClock className="w-5 h-5" />,
      title: "Audit logging",
      value: s.audit_logging ? "Enabled" : "Disabled",
      detail: `${s.audit_events} audit events recorded`,
      pill: s.audit_logging ? (
        <Pill tone="ok">On</Pill>
      ) : (
        <Pill tone="bad">Off</Pill>
      ),
    });
  }

  if (health) {
    const ollamaReachable = health.ollama.reachable;
    const workerRunning = health.worker.state === "running" || health.worker.state === "active";
    cards.push({
      icon: <ScanEye className="w-5 h-5" />,
      title: "Ollama endpoint",
      value: health.ollama.url,
      detail: `Default model: ${health.default_model}`,
      pill: ollamaReachable ? (
        <Pill tone="ok">
          <CheckCircle2 className="w-3 h-3" /> Reachable
        </Pill>
      ) : (
        <Pill tone="bad">
          <XCircle className="w-3 h-3" /> Unreachable
        </Pill>
      ),
    });
    cards.push({
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "Worker",
      value: health.worker.state,
      detail: `Active job: ${health.worker.active_job_id || "none"}`,
      pill: workerRunning ? (
        <Pill tone="ok">
          <CheckCircle2 className="w-3 h-3" /> Running
        </Pill>
      ) : (
        <Pill tone="warn">
          <HelpCircle className="w-3 h-3" /> {health.worker.state}
        </Pill>
      ),
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Security & Privacy
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Air-gap compliance and data sovereignty status
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Re-run verification</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16 bg-white border border-slate-200/80 rounded-2xl">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Verifying sovereignty status...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((c) => (
              <div
                key={c.title}
                className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                    {c.icon}
                  </div>
                  <h2 className="text-base font-bold text-slate-800">{c.title}</h2>
                  <span className="ml-auto">{c.pill}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 break-all">{c.value}</p>
                <p className="text-sm text-slate-600">{c.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
