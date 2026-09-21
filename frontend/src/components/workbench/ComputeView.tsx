"use client";

import React, { useEffect, useState, useCallback } from "react";
import { FigurePanel, TierRow, Gantt, StatSlab, type GanttRow } from "@/components/ui/instrument";
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

  // Each allocation becomes a bar on a shared VRAM track, so overlap and
  // headroom are visible at a glance — a stacked total hides both.
  const ganttRows: GanttRow[] = (resources?.allocated ?? []).map((a, i) => {
    const share = capVram > 0 ? (a.gpu_vram_mb || 0) / capVram : 0;
    const offset = (resources?.allocated ?? [])
      .slice(0, i)
      .reduce((s, prev) => s + (capVram > 0 ? (prev.gpu_vram_mb || 0) / capVram : 0), 0);
    return {
      label: a.job_id.slice(0, 14),
      start: offset,
      width: Math.max(0.01, share),
      tone: "signal" as const,
      value: formatMb(a.gpu_vram_mb || 0),
    };
  });

  const freeVram = Math.max(0, capVram - usedVram);
  if (capVram > 0) {
    ganttRows.push({
      label: "free",
      start: capVram > 0 ? usedVram / capVram : 0,
      width: Math.max(0.01, freeVram / Math.max(1, capVram)),
      tone: "metric",
      value: formatMb(freeVram),
    });
  }

  const pressure = capVram > 0 ? Math.round((usedVram / capVram) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Scheduler</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>Compute &amp; VRAM</h1>
            <p style={{ margin: "8px 0 0" }}>
              What the scheduler has reserved, against what this machine actually has. A job
              waits rather than oversubscribing; an impossible request fails cleanly.
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
              value={`${pressure}%`}
              label="VRAM reserved"
              tone={pressure > 85 ? "signal" : pressure > 0 ? "metric" : "neutral"}
            />
            <FigurePanel figure="1" title="Capacity" caption="declared, not guessed">
              <dl style={{ margin: 0 }}>
                {metricCards.map((card) => {
                  // The unit rides on the total only. Repeating it on both
                  // sides pushed "18 cores / 32 cores" past the column and
                  // wrapped the denominator onto its own line.
                  const fmtUsed = card.fmt ?? ((n: number) => `${n}`);
                  const fmtTotal = card.fmt ?? ((n: number) => `${n}${card.suffix}`);
                  const pct = card.total > 0 ? Math.round((card.used / card.total) * 100) : 0;
                  return (
                    <div key={card.title} style={{ padding: "11px 0", borderBottom: "1px solid var(--carbon)" }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--graphite)" }}>
                          {card.title}
                        </dt>
                        <dd className="font-mono tnum" style={{ margin: 0, fontSize: 12, color: "var(--bone)", whiteSpace: "nowrap" }}>
                          {fmtUsed(card.used)} / {fmtTotal(card.total)}
                        </dd>
                      </div>
                      <div style={{ marginTop: 7, height: 2, background: "var(--carbon)" }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: 2, background: pct > 85 ? "var(--ochre)" : "var(--signal)" }} />
                      </div>
                    </div>
                  );
                })}
              </dl>
            </FigurePanel>
          </div>

          <div className="flex flex-col gap-4">
            <FigurePanel
              figure="2"
              title="VRAM allocation"
              caption={`${gpuCount} GPU(s) · ${(resources?.allocated ?? []).length} active reservation(s)`}
            >
              {ganttRows.length > 0 ? (
                <Gantt rows={ganttRows} />
              ) : (
                <p className="font-mono" style={{ margin: 0, fontSize: 12, color: "var(--graphite)" }}>
                  No reservations held. The scheduler is idle.
                </p>
              )}
            </FigurePanel>

            <FigurePanel figure="3" title="Residency" caption="where a model actually lives while it works">
              <TierRow
                tiers={[
                  { name: "Resident in VRAM", detail: "serving now · keep_alive 5m", heat: 0 },
                  { name: "Loaded, idle", detail: "evicted when another model needs the card", heat: 1 },
                  { name: "On disk", detail: "pulled locally, never auto-downloaded", heat: 2 },
                ]}
              />
              <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--granite)" }}>
                The scheduler&rsquo;s belief and the card&rsquo;s reality are reported separately —
                eviction is asynchronous, so a successful unload call does not mean the VRAM is
                free yet. The gap between the two numbers is the honest signal.
              </p>
            </FigurePanel>

            {scheduler && (
              <FigurePanel figure="4" title="Queue" flush>
                <table>
                  <thead>
                    <tr><th>State</th><th>Jobs</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Queued</td><td className="font-mono tnum">{scheduler.queued_jobs}</td></tr>
                    <tr><td>Running</td><td className="font-mono tnum">{scheduler.running_jobs}</td></tr>
                  </tbody>
                </table>
              </FigurePanel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
