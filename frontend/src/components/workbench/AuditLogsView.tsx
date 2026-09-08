"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ScrollText, RefreshCw, AlertCircle } from "lucide-react";
import { getAudit } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  allowed: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  denied: "bg-rose-50 text-rose-700 border-rose-200/60",
  blocked: "bg-rose-50 text-rose-700 border-rose-200/60",
  failed: "bg-rose-50 text-rose-700 border-rose-200/60",
  running: "bg-amber-50 text-amber-700 border-amber-200/60",
  queued: "bg-slate-100 text-slate-600 border-slate-200/60",
};

function statusClass(status: string): string {
  const key = status.toLowerCase();
  return (
    STATUS_COLORS[key] ||
    "bg-slate-100 text-slate-600 border-slate-200/60"
  );
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export default function AuditLogsView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getAudit(activeUserId(), undefined, 200);
      setEvents(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statuses = Array.from(new Set(events.map((e) => e.status)));

  const filtered = statusFilter === "all"
    ? events
    : events.filter((e) => e.status === statusFilter);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Audit Trail
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Track all system actions and events
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

        <div className="flex flex-wrap items-center gap-2">
          {["all", ...statuses].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors text-xs font-semibold capitalize border ${
                statusFilter === st
                  ? "bg-white shadow-sm text-slate-800 border-slate-200/80"
                  : "bg-transparent text-slate-500 hover:text-slate-700 border-transparent"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading audit trail...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3 px-5">Time</th>
                    <th className="py-3 px-5">Event type</th>
                    <th className="py-3 px-5">Component</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Job / User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 text-sm">
                        No audit events recorded.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((ev) => (
                      <tr key={ev.event_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-5 text-slate-600 whitespace-nowrap">
                          {formatTime(ev.timestamp)}
                        </td>
                        <td className="py-3 px-5 font-medium text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <ScrollText className="w-3.5 h-3.5 text-slate-400" />
                            {ev.event_type}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-slate-600">{ev.component}</td>
                        <td className="py-3 px-5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusClass(ev.status)}`}>
                            {ev.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-xs font-mono text-slate-500 whitespace-nowrap">
                          {ev.job_id || ev.user_id || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
