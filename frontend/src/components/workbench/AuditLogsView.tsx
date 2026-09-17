"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ScrollText, RefreshCw, AlertCircle, Download, FileText, CheckCircle2 } from "lucide-react";
import { getAudit } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";

function activeUserId(): string {
  if (typeof window === "undefined") return "user-001";
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-950/40 text-emerald-400 border-emerald-900/50/60",
  ok: "bg-emerald-950/40 text-emerald-400 border-emerald-900/50/60",
  completed: "bg-emerald-950/40 text-emerald-400 border-emerald-900/50/60",
  allowed: "bg-emerald-950/40 text-emerald-400 border-emerald-900/50/60",
  denied: "bg-rose-950/40 text-rose-400 border-rose-900/50/60",
  blocked: "bg-rose-950/40 text-rose-400 border-rose-900/50/60",
  failed: "bg-rose-950/40 text-rose-400 border-rose-900/50/60",
  running: "bg-amber-950/40 text-amber-400 border-amber-900/50/60",
  queued: "bg-slate-100 text-zinc-400 border-zinc-800/60",
};

function statusClass(status: string): string {
  const key = status.toLowerCase();
  return (
    STATUS_COLORS[key] ||
    "bg-slate-100 text-zinc-400 border-zinc-800/60"
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
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

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

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloadSuccess(`Downloaded ${filename}`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadJSON = () => {
    const dataToExport = {
      system: "AstraSovereign",
      export_timestamp: new Date().toISOString(),
      user: activeUserId(),
      total_events: filtered.length,
      air_gap_policy: "STRICT_VERIFIED",
      events: filtered,
    };
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerBlobDownload(blob, `AstraSovereign-Audit-Report-${dateStr}.json`);
  };

  const handleDownloadCSV = () => {
    const headers = ["Timestamp", "Event ID", "Event Type", "Component", "Status", "Job ID", "User ID", "Metadata"];
    const rows = filtered.map((e) => [
      `"${e.timestamp || ""}"`,
      `"${e.event_id || ""}"`,
      `"${e.event_type || ""}"`,
      `"${e.component || ""}"`,
      `"${e.status || ""}"`,
      `"${e.job_id || ""}"`,
      `"${e.user_id || ""}"`,
      `"${JSON.stringify(e.metadata || {}).replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerBlobDownload(blob, `AstraSovereign-Audit-Report-${dateStr}.csv`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#09090b]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              Audit Trail
            </h1>
            <p className="text-sm text-zinc-400 font-medium mt-1 leading-relaxed">
              Tamper-evident verification, immutable execution trail, and downloadable regulatory audit logs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 font-mono"
              title="Download Audit Report as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-red-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJSON}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-red-800/50 bg-red-950/40 hover:bg-red-900/50 px-3.5 py-2 text-xs font-semibold text-red-300 transition-all cursor-pointer shadow-xs disabled:opacity-50 font-mono"
              title="Download Audit Report as JSON file"
            >
              <FileText className="w-3.5 h-3.5 text-red-400" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-60 font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-900/50 text-emerald-800 rounded-xl px-4 py-2.5 text-xs font-semibold animate-fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-900/50/80 text-rose-400 rounded-xl px-4 py-3 text-sm font-medium">
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
                  ? "bg-[#111115] shadow-sm text-zinc-100 border-zinc-800"
                  : "bg-transparent text-zinc-400 hover:text-zinc-200 border-transparent"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm py-16">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading audit trail...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-[#18181b]/30">
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
                      <td colSpan={5} className="py-12 text-center text-zinc-400 text-sm">
                        No audit events recorded.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((ev) => (
                      <tr key={ev.event_id} className="hover:bg-[#18181b]/50 transition-colors">
                        <td className="py-3 px-5 text-zinc-400 whitespace-nowrap">
                          {formatTime(ev.timestamp)}
                        </td>
                        <td className="py-3 px-5 font-medium text-zinc-200">
                          <span className="flex items-center gap-1.5">
                            <ScrollText className="w-3.5 h-3.5 text-zinc-500" />
                            {ev.event_type}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-zinc-400">{ev.component}</td>
                        <td className="py-3 px-5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusClass(ev.status)}`}>
                            {ev.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-xs font-mono text-zinc-400 whitespace-nowrap">
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
