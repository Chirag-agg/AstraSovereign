"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { FigurePanel, StatSlab, NumberedList, Gantt, type GanttRow } from "@/components/ui/instrument";
import { getAdminModels, listJobs } from "@/lib/api";
import type { AdminModelRow, JobSummary, JobStatus } from "@/lib/types";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

/**
 * The five kinds of thinking a task can be routed to, in the order a document
 * task usually walks through them. Naming them in office language rather than
 * by model capability is deliberate: the person reading this page wants to
 * know what the machine will do, not which weights it will load.
 */
const PIPELINE_STAGES: { id: string; label: string; plain: string }[] = [
  { id: "reasoning", label: "Reasoning", plain: "works out what the task is actually asking" },
  { id: "document", label: "Reading", plain: "reads the documents you attached" },
  { id: "vision", label: "Looking", plain: "reads scans and photographs of pages" },
  { id: "math", label: "Checking", plain: "re-does the arithmetic rather than trusting it" },
  { id: "coding", label: "Computing", plain: "writes and runs code in the sealed sandbox" },
];

const STATUS_TONE: Record<string, string> = {
  running: "var(--signal)",
  queued: "var(--ochre)",
  completed: "var(--metric)",
  failed: "var(--alert)",
  cancelled: "var(--graphite)",
};

function tone(status: JobStatus | string): string {
  return STATUS_TONE[status] ?? "var(--graphite)";
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

  const stageModel = (stageId: string): AdminModelRow | undefined => {
    const variants = [
      stageId,
      stageId.replace("document", "document_generation"),
      stageId === "coding" ? "code" : stageId,
      stageId === "document" ? "documentation" : stageId,
    ];
    return models.find((m) => variants.includes(m.task_type));
  };

  const stages = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    model: stageModel(stage.id),
  }));
  const wired = stages.filter((s) => s.model?.enabled && s.model?.available).length;

  // Each stage occupies its own lane on a shared track, in pipeline order, so
  // the shape of the route is visible rather than described.
  const lanes: GanttRow[] = stages.map((stage, i) => ({
    label: stage.label.toLowerCase(),
    start: i / stages.length,
    width: 1 / stages.length,
    tone: stage.model?.enabled && stage.model?.available ? "signal" : "ochre",
    value: stage.model?.enabled && stage.model?.available ? "ready" : "—",
  }));

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Routing</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>How a task gets done</h1>
            <p style={{ margin: "8px 0 0" }}>
              One task can need several kinds of thinking. The router picks a local model
              for each part and records every choice it made, including the ones it had to
              substitute.
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
          <div
            role="alert"
            style={{ borderLeft: "2px solid var(--alert)", padding: "10px 14px", background: "var(--alert-surface)", borderRadius: 2, fontSize: 13, color: "var(--alert-ink)" }}
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab
              value={`${wired}/${stages.length}`}
              label="Stages ready"
              tone={wired === stages.length ? "metric" : wired === 0 ? "neutral" : "signal"}
            />
            <FigurePanel figure="1" title="What happens when you ask" caption="the same order every time">
              <NumberedList
                index={1}
                items={[
                  { title: "The task is read", detail: "the router decides which kinds of thinking it needs." },
                  { title: "A local model per kind", detail: "each stage resolves to one enabled model on this machine." },
                  { title: "The work is recorded", detail: "every call, substitution and file written lands in the audit trail." },
                ]}
              />
            </FigurePanel>
          </div>

          <div className="flex flex-col gap-4">
            <FigurePanel figure="2" title="The route" caption="stages in the order they run">
              <Gantt rows={lanes} />
            </FigurePanel>

            <FigurePanel figure="3" title="Stages" flush>
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>What it does</th>
                    <th>Local model</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && models.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="font-mono" style={{ color: "var(--graphite)" }}>Loading routing table…</td>
                    </tr>
                  ) : (
                    stages.map((stage) => {
                      const ready = Boolean(stage.model?.enabled && stage.model?.available);
                      const state = !stage.model ? "not configured" : ready ? "ready" : stage.model.enabled ? "not pulled" : "disabled";
                      const colour = ready ? "var(--metric)" : state === "not pulled" ? "var(--ochre)" : "var(--graphite)";
                      return (
                        <tr key={stage.id}>
                          <td>{stage.label}</td>
                          <td style={{ color: "var(--granite)" }}>{stage.plain}</td>
                          <td className="font-mono" style={{ color: stage.model ? "var(--signal)" : "var(--graphite)" }}>
                            {stage.model?.model ?? "—"}
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: colour }}>
                              <span style={{ width: 5, height: 5, borderRadius: 99, background: colour }} />
                              {state}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </FigurePanel>
          </div>
        </div>

        <FigurePanel figure="4" title="Recent runs" caption="the last eight tasks through this route" flush>
          <table>
            <thead>
              <tr>
                <th>What was asked</th>
                <th>State</th>
                <th style={{ textAlign: "right" }}>Task</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="font-mono" style={{ color: "var(--graphite)" }}>
                    Nothing has run through the pipeline yet.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.job_id}>
                    <td style={{ maxWidth: 680 }}>
                      <span className="block truncate">{job.message}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: tone(job.status) }}>
                        <span
                          className={job.status === "running" ? "astra-pulse" : undefined}
                          style={{ width: 5, height: 5, borderRadius: 99, background: tone(job.status) }}
                        />
                        {job.status}
                      </span>
                    </td>
                    <td className="font-mono" style={{ textAlign: "right", color: "var(--graphite)" }}>
                      {job.job_id.substring(0, 8)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </FigurePanel>
      </div>
    </div>
  );
}
