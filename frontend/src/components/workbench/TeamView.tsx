"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, RefreshCw, AlertCircle } from "lucide-react";
import { getAdminUsers } from "@/lib/api";
import type { AdminUserRow } from "@/lib/types";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

function formatActivity(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export default function TeamView() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setRows(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Team
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              User management and access control
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

        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3 px-5">User</th>
                    <th className="py-3 px-5 text-right">Jobs</th>
                    <th className="py-3 px-5 text-right">Active</th>
                    <th className="py-3 px-5 text-right">Failed</th>
                    <th className="py-3 px-5 text-right">Documents</th>
                    <th className="py-3 px-5 text-right">Artifacts</th>
                    <th className="py-3 px-5">Recent activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#7047eb]/10 text-[#7047eb] flex items-center justify-center text-xs font-bold uppercase">
                              {u.user_id === activeUserId() ? "You" : u.user_id.slice(0, 2)}
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">{u.user_id}</span>
                              {u.user_id === activeUserId() && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#7047eb]/10 text-[#7047eb]">
                                  current
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-right font-semibold text-slate-700">{u.jobs}</td>
                        <td className="py-3 px-5 text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                            {u.active_jobs}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right">
                          {u.failed_jobs > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                              {u.failed_jobs}
                            </span>
                          ) : (
                            <span className="text-slate-600">{u.failed_jobs}</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right text-slate-600">{u.documents}</td>
                        <td className="py-3 px-5 text-right text-slate-600">{u.artifacts}</td>
                        <td className="py-3 px-5 text-slate-500 text-xs whitespace-nowrap">
                          {formatActivity(u.recent_activity)}
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
