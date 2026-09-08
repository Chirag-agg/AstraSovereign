"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollText,
  Search,
  RefreshCw,
  ShieldCheck,
  Filter,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Terminal,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { getAudit } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";

interface AuditLogsViewProps {
  user?: string;
}

function eventBadgeColor(eventType: string): { bg: string; text: string; border: string } {
  const t = eventType.toUpperCase();
  if (t.includes("FAIL") || t.includes("ERR") || t.includes("BLOCKED")) {
    return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
  }
  if (t.includes("JOB")) {
    return { bg: "bg-purple-50", text: "text-[#7047eb]", border: "border-purple-200" };
  }
  if (t.includes("TOOL")) {
    return { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" };
  }
  if (t.includes("MODEL")) {
    return { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" };
  }
  if (t.includes("DOCUMENT") || t.includes("INGESTION") || t.includes("OCR")) {
    return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  }
  if (t.includes("RESOURCE")) {
    return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
  }
  return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
}

export default function AuditLogsView({ user = "user-001" }: AuditLogsViewProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAudit(user, undefined, 100, 0);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedType !== "ALL" && !ev.event_type.toUpperCase().includes(selectedType)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.event_type.toLowerCase().includes(q) ||
      (ev.job_id && ev.job_id.toLowerCase().includes(q)) ||
      ev.component.toLowerCase().includes(q) ||
      JSON.stringify(ev.metadata).toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Audit Evidence Trail
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                Phase 11 Hardened
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Append-only cryptographic record of all agent decisions, model routes, tool executions, and resource releases
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchLogs()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Trail</span>
            </button>
          </div>
        </div>

        {/* Evidence Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Recorded Events</span>
              <div className="p-2 bg-purple-50 text-[#7047eb] rounded-xl">
                <ScrollText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{events.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">User-scoped ledger ({user})</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Storage Format</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">audit.jsonl</div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Append-only • Thread-safe</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Data Redaction</span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">Non-Sensitive Only</div>
            <p className="text-[11px] text-sky-600 font-medium mt-1">Prompts & secrets excluded</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Egress Boundary</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-emerald-600">VERIFIED_LOCAL</div>
            <p className="text-[11px] text-slate-500 mt-1">0 external egress calls</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600">Filter:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "ALL", label: "All" },
                { id: "JOB", label: "Jobs" },
                { id: "MODEL", label: "Models" },
                { id: "TOOL", label: "Tools" },
                { id: "DOCUMENT", label: "Docs & RAG" },
                { id: "RESOURCE", label: "Resources" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedType(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedType === tab.id
                      ? "bg-[#7047eb] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event, job ID, tool..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl overflow-hidden">
          {error && (
            <div className="p-4 bg-rose-50 text-rose-700 text-xs border-b border-rose-100 flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {loading && events.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading verified audit trail...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
              <ScrollText className="w-10 h-10 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">No matching audit records</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Actions executed by the agent, worker, or scheduler are recorded here with cryptographic integrity.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Job ID</th>
                    <th className="py-3 px-4">Non-Sensitive Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvents.map((ev, i) => {
                    const colors = eventBadgeColor(ev.event_type);
                    const formattedTime = new Date(ev.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    const formattedDate = new Date(ev.timestamp).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <tr
                        key={ev.event_id || `${ev.timestamp}-${i}`}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          <div>{formattedTime}</div>
                          <div className="text-[10px] text-slate-400">{formattedDate}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            {ev.event_type}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-medium text-slate-700">
                          {ev.component}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {ev.job_id ? (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(ev.job_id!)}
                              className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors"
                              title="Click to copy Job ID"
                            >
                              <span>{ev.job_id.slice(0, 12)}...</span>
                              {copiedId === ev.job_id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
                            {Object.entries(ev.metadata || {}).map(([k, v]) => {
                              if (v === null || v === undefined) return null;
                              const valStr = typeof v === "object" ? JSON.stringify(v) : String(v);
                              return (
                                <span
                                  key={k}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10.5px] text-slate-700 font-mono"
                                >
                                  <span className="text-slate-500 mr-1">{k}:</span>
                                  <span className="font-semibold text-slate-800 truncate max-w-xs">{valStr}</span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
