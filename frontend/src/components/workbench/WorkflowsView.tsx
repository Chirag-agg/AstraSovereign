"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  GitBranch,
  RefreshCw,
  AlertCircle,
  BrainCircuit,
  FileCode2,
  Calculator,
  BookOpenText,
  ScanEye,
} from "lucide-react";
import { getAdminModels, listJobs } from "@/lib/api";
import type { AdminModelRow, JobSummary, JobStatus } from "@/lib/types";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

const PIPELINE_STAGES: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "reasoning", label: "Reasoning", icon: <BrainCircuit className="w-4 h-4" /> },
  { id: "math", label: "Math", icon: <Calculator className="w-4 h-4" /> },
  { id: "coding", label: "Coding", icon: <FileCode2 className="w-4 h-4" /> },
  { id: "document", label: "Document", icon: <BookOpenText className="w-4 h-4" /> },
  { id: "vision", label: "Vision", icon: <ScanEye className="w-4 h-4" /> },
];

function statusPill(status: JobStatus): React.ReactNode {
  const base = "px-2.5 py-0.5 rounded-full text-xs font-semibold border";
  switch (status) {
    case "running":
      return <span className={`${base} bg-amber-950/40 text-amber-400 border-amber-900/50/60`}>running</span>;
    case "completed":
      return <span className={`${base} bg-emerald-950/40 text-emerald-400 border-emerald-900/50/60`}>completed</span>;
    case "failed":
      return <span className={`${base} bg-rose-950/40 text-rose-400 border-rose-900/50/60`}>failed</span>;
    case "cancelled":
      return <span className={`${base} bg-slate-100 text-zinc-400 border-zinc-800/60`}>cancelled</span>;
    default:
      return <span className={`${base} bg-slate-100 text-zinc-400 border-zinc-800/60`}>queued</span>;
  }
}

export default function WorkflowsView() {
  const [models, setModels] = useState<AdminModelRow[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [modelData, jobData] = await Promise.all([
        getAdminModels(),
        listJobs(activeUserId(), undefined, 8),
      ]);
      setModels(modelData || []);
      setJobs(jobData || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stageCaps = (stageId: string): string[] => {
    const variants = [
      stageId,
      stageId.replace("document", "document_generation"),
      stageId === "coding" ? "code" : stageId,
      stageId === "document" ? "documentation" : stageId,
    ];
    const caps = new Set<string>();
    models
      .filter((m) => variants.includes(m.task_type))
      .forEach((m) => m.capabilities.forEach((c) => caps.add(c)));
    return Array.from(caps).slice(0, 4);
  };

  return (    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#09090b]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              Workflows
            </h1>
            <p className="text-sm text-zinc-400 font-medium mt-1 leading-relaxed">
              Multi-model pipeline engine
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#111115] hover:bg-[#18181b] px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-900/50/80 text-rose-400 rounded-xl px-4 py-3 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm py-16 bg-[#111115] border border-zinc-800 rounded-2xl">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading pipeline configuration...
          </div>
        ) : (
          <>
            <div className="bg-red-950/300/5 border border-red-500/15 rounded-2xl px-5 py-4 flex items-start gap-3">
              <GitBranch className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-200 leading-relaxed">
                Complex multi-capability requests are automatically decomposed into
                stage pipelines. The engine routes each stage through the configured
                model for that task type — inspect the agent trace on any job to see
                the stages that were executed.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {PIPELINE_STAGES.map((stage) => {
                const serving = models.filter((m) => m.task_type === stage.id);
                const primary = serving.find((m) => m.enabled);
                const cap = stageCaps(stage.id);
                return (
                  <div
                    key={stage.id}
                    className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2 text-red-500">
                      <span className="p-1.5 bg-red-950/300/10 rounded-lg">{stage.icon}</span>
                      <span className="text-sm font-bold text-zinc-100 capitalize">{stage.label}</span>
                    </div>
                    {primary ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200 truncate" title={primary.model}>
                          {primary.provider} / {primary.model}
                        </span>
                        <span
                          className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            primary.available
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/50/60"
                              : "bg-amber-950/40 text-amber-400 border-amber-900/50/60"
                          }`}
                        >
                          {primary.available ? "ready" : "unavailable"}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">No model configured</p>
                    )}
                    {cap.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {cap.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded-md bg-[#18181b] border border-zinc-800 text-[10px] font-mono text-zinc-400"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
              <div className="p-5 border-b border-zinc-800">
                <h2 className="text-base font-bold text-zinc-100">Recent pipeline executions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-[#18181b]/30">
                      <th className="py-3 px-5">Task</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5">Model</th>
                      <th className="py-3 px-5">Job ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-zinc-400 text-sm">
                          No recent jobs yet.
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.job_id} className="hover:bg-[#18181b]/50 transition-colors">
                          <td className="py-3 px-5 font-medium text-zinc-200 max-w-md truncate">
                            {job.message}
                          </td>
                          <td className="py-3 px-5">{statusPill(job.status)}</td>
                          <td className="py-3 px-5 text-xs font-mono text-zinc-400">
                            {job.model || "—"}
                          </td>
                          <td className="py-3 px-5 font-mono text-xs text-zinc-500">
                            {job.job_id.slice(0, 8)}...
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
