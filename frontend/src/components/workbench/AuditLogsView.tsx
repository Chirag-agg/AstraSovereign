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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Audit Trail
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Tamper-evident verification, immutable execution trail, and downloadable regulatory audit logs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Download Audit Report as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-[#7047eb]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJSON}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3.5 py-2 text-xs font-semibold text-[#7047eb] transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Download Audit Report as JSON file"
            >
              <FileText className="w-3.5 h-3.5 text-[#7047eb]" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2.5 text-xs font-semibold animate-fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

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
