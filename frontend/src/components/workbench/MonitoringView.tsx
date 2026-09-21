"use client";

import React, { useEffect, useState, useCallback } from "react";
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

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Monitoring
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              System health and performance tracking
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
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
            Loading system health...
          </div>
        ) : (
          <>
            {system?.sandbox_network && (
              <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-3">
                <Wifi className="w-4 h-4 text-[var(--accent)]" />
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-800">Sandbox network:</span>{" "}
                  {system.sandbox_network}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {LABELS.map(({ key, label }) => {
                const state: ComponentState = (system?.[key] as ComponentState) ?? "UNKNOWN";
                const s = stateStyles(state);
                return (
                  <div
                    key={key}
                    className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex items-center gap-3"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.pill}`}>
                      {s.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{label}</p>
                      <p className="text-xs text-slate-400 capitalize">{key.replace("_", " ")}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.pill}`}>
                      {state}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100 mb-4">
                Runtime checks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Ollama</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono truncate ml-3">
                    {health?.ollama.url}
                  </span>
                  <span
                    className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      health?.ollama.reachable
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                        : "bg-rose-50 text-rose-700 border-rose-200/60"
                    }`}
                  >
                    {health?.ollama.reachable ? "reachable" : "unreachable"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Worker</span>
                  </div>
                  <span
                    className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                      health?.worker.state === "running" || health?.worker.state === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                        : health?.worker.state === "idle"
                        ? "bg-amber-50 text-amber-700 border-amber-200/60"
                        : "bg-slate-100 text-slate-600 border-slate-200/60"
                    }`}
                  >
                    {health?.worker.state ?? "unknown"}
                  </span>
                  {health?.worker.active_job_id && (
                    <span className="text-xs font-mono text-slate-500 ml-2 truncate">
                      {health.worker.active_job_id}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
