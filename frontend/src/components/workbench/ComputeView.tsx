"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Cpu,
  MemoryStick,
  Server,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getAdminResources, getHealth } from "@/lib/api";
import type { AdminResources, Health } from "@/lib/types";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function usageColor(used: number, total: number): string {
  const ratio = total > 0 ? used / total : 0;
  if (ratio >= 0.9) return "bg-rose-500";
  if (ratio >= 0.7) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function ComputeView() {
  const [resources, setResources] = useState<AdminResources | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [res, h] = await Promise.all([getAdminResources(), getHealth()]);
      setResources(res);
      setHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load compute resources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usedCpu = resources?.allocated.reduce((s, a) => s + a.cpu_cores, 0) ?? 0;
  const usedMem = resources?.allocated.reduce((s, a) => s + a.memory_mb, 0) ?? 0;
  const usedVram =
    resources?.allocated.reduce((s, a) => s + (a.gpu_vram_mb || 0), 0) ?? 0;
  const capCpu = resources?.capacity.cpu_cores ?? 0;
  const capMem = resources?.capacity.memory_mb ?? 0;
  const gpuCount = resources?.capacity.gpus.length ?? 0;
  const capVram =
    resources?.capacity.gpus.reduce((s, g) => s + g.vram_mb, 0) ?? 0;

  const scheduler = health?.scheduler;

  const metricCards = [
    {
      icon: <Cpu className="w-5 h-5" />,
      title: "CPU cores",
      used: usedCpu,
      total: capCpu,
      suffix: " cores",
    },
    {
      icon: <MemoryStick className="w-5 h-5" />,
      title: "Memory",
      used: usedMem,
      total: capMem,
      suffix: "",
      fmt: formatMb,
    },
    {
      icon: <Server className="w-5 h-5" />,
      title: "GPU VRAM",
      used: usedVram,
      total: capVram,
      suffix: "",
      fmt: formatMb,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              System Resources
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Local compute infrastructure status
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
            Loading compute resources...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metricCards.map((m) => {
                const ratio = m.total > 0 ? m.used / m.total : 0;
                const text = m.fmt
                  ? `${m.fmt(m.used)} / ${m.fmt(m.total)}`
                  : `${m.used} / ${m.total}${m.suffix}`;
                return (
                  <div
                    key={m.title}
                    className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-400">{m.icon}</span>
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                        {m.title}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{text}</span>
                    <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${usageColor(m.used, m.total)} transition-all`}
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-400">
                    <Loader2 className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    Jobs
                  </span>
                </div>
                <span className="text-2xl font-bold text-slate-800">
                  {resources?.running_jobs ?? 0} running
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  {resources?.waiting_jobs ?? 0} waiting · {scheduler?.queued_jobs ?? 0} queued
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 md:col-span-2 flex flex-col">
                <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100 mb-3">
                  Active allocations
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                        <th className="py-2.5 px-3">Job</th>
                        <th className="py-2.5 px-3 text-right">CPU</th>
                        <th className="py-2.5 px-3 text-right">Memory</th>
                        <th className="py-2.5 px-3 text-right">GPU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(resources?.allocated.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                            No jobs currently allocated.
                          </td>
                        </tr>
                      ) : (
                        resources?.allocated.map((a) => (
                          <tr key={a.job_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                              {a.job_id}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{a.cpu_cores}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {formatMb(a.memory_mb)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {a.gpu_id || (a.gpu_vram_mb ? `${formatMb(a.gpu_vram_mb)} shared` : "—")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3">
                <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">
                  GPU pool
                </h2>
                {gpuCount === 0 ? (
                  <p className="text-sm text-slate-500">No GPUs detected.</p>
                ) : (
                  resources?.capacity.gpus.map((g) => (
                    <div key={g.gpu_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-xs text-slate-700">{g.gpu_id}</span>
                      </div>
                      <span className="text-xs text-slate-500">{formatMb(g.vram_mb)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
