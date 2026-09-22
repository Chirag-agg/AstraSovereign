"use client";

import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { FigurePanel, StatSlab, SegmentedToggle, Gantt, type GanttRow } from "@/components/ui/instrument";
import type { JobSummary } from "@/lib/types";

interface JobsViewProps {
  jobs: JobSummary[] | null;
  onSelectJob: (jobId: string) => void;
  onNewJob: () => void;
}

type StatusKey = "all" | "running" | "completed" | "failed";

const STATUS_TONE: Record<string, string> = {
  running: "var(--signal)",
  queued: "var(--ochre)",
  completed: "var(--metric)",
  failed: "var(--alert)",
  cancelled: "var(--graphite)",
};

function tone(status: string): string {
  return STATUS_TONE[status] ?? "var(--graphite)";
}

export default function JobsView({ jobs, onSelectJob, onNewJob }: JobsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);

  const displayJobs = jobs || [];

  const filtered = displayJobs.filter((job) => {
    const needle = search.toLowerCase();
    const matchesSearch =
      job.job_id.toLowerCase().includes(needle) || job.message.toLowerCase().includes(needle);
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = displayJobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});
  const finished = counts.completed ?? 0;
  const inFlight = (counts.running ?? 0) + (counts.queued ?? 0);

  // A composition bar rather than four separate counters: the point of a task
  // history is the proportion that finished, which a row of numbers hides.
  const mix: GanttRow[] = (() => {
    const order = ["completed", "running", "queued", "failed", "cancelled"];
    const total = displayJobs.length;
    if (total === 0) return [];
    let cursor = 0;
    return order
      .filter((status) => (counts[status] ?? 0) > 0)
      .map((status) => {
        const share = (counts[status] ?? 0) / total;
        const row: GanttRow = {
          label: status,
          start: cursor,
          width: Math.max(0.012, share),
          tone:
            status === "completed"
              ? "metric"
              : status === "failed" || status === "cancelled"
                ? "alert"
                : status === "queued"
                  ? "ochre"
                  : "signal",
          value: String(counts[status] ?? 0),
        };
        cursor += share;
        return row;
      });
  })();

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>History</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>Everything you have asked for</h1>
            <p style={{ margin: "8px 0 0" }}>
              Every task this workbench has run, in the order it ran them. Open one to see
              what the agent did, step by step, and what it produced.
            </p>
          </div>
          <button
            type="button"
            onClick={onNewJob}
            className="inline-flex items-center gap-1.5 font-mono uppercase shrink-0"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.08em",
              padding: "8px 13px",
              borderRadius: 2,
              border: "1px solid var(--signal)",
              background: "transparent",
              color: "var(--signal)",
              cursor: "pointer",
            }}
          >
            New task
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab
              value={String(finished)}
              label="Tasks finished"
              tone={finished > 0 ? "metric" : "neutral"}
            />
            {inFlight > 0 && (
              <StatSlab value={String(inFlight)} label="Still working" tone="signal" />
            )}
          </div>

          <FigurePanel figure="1" title="Outcome mix" caption="share of every task recorded">
            {mix.length > 0 ? (
              <Gantt rows={mix} />
            ) : (
              <p className="font-mono" style={{ margin: 0, fontSize: 12, color: "var(--graphite)" }}>
                Nothing has run yet. The first task you send will appear here.
              </p>
            )}
          </FigurePanel>
        </div>

        <FigurePanel
          figure="2"
          title="Task log"
          caption={`${filtered.length} of ${displayJobs.length} shown`}
          actions={
            <SegmentedToggle<StatusKey>
              options={[
                { value: "all", label: "All" },
                { value: "running", label: "Running" },
                { value: "completed", label: "Done" },
                { value: "failed", label: "Failed" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
          flush
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--carbon)" }}>
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--graphite)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by what you asked for, or by task id"
                className="w-full bg-transparent font-mono"
                style={{ fontSize: 12, color: "var(--bone)", border: "none", outline: "none", padding: 0 }}
              />
            </div>
          </div>

          <div className="relative">
            <table>
              <thead>
                <tr>
                  <th>What you asked for</th>
                  <th>State</th>
                  <th style={{ textAlign: "right" }}>Task</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="font-mono" style={{ color: "var(--graphite)" }}>
                      {displayJobs.length === 0
                        ? "No tasks recorded yet."
                        : "Nothing matches that filter."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((job) => (
                    <tr
                      key={job.job_id}
                      onClick={() => setSelectedJob(job)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ maxWidth: 620 }}>
                        <span className="block truncate">{job.message}</span>
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-2 font-mono uppercase"
                          style={{ fontSize: 10.5, letterSpacing: "0.08em", color: tone(job.status) }}
                        >
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

            {selectedJob && (
              <div
                className="absolute inset-y-0 right-0 z-50 flex flex-col"
                style={{
                  width: 340,
                  background: "var(--surface-panel)",
                  borderLeft: "1px solid var(--ash)",
                  padding: 20,
                }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{ paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid var(--carbon)" }}
                >
                  <span className="mono-label">Task detail</span>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    aria-label="Close task detail"
                    style={{ background: "transparent", border: "none", color: "var(--granite)", cursor: "pointer", padding: 2 }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <span className="mono-label">What you asked for</span>
                    <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--stone)" }}>
                      {selectedJob.message}
                    </p>
                  </div>
                  <div>
                    <span className="mono-label">State</span>
                    <p
                      className="font-mono uppercase"
                      style={{ margin: "8px 0 0", fontSize: 11, letterSpacing: "0.08em", color: tone(selectedJob.status) }}
                    >
                      {selectedJob.status}
                    </p>
                  </div>
                  <div>
                    <span className="mono-label">Task id</span>
                    <p
                      className="font-mono"
                      style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--granite)", wordBreak: "break-all" }}
                    >
                      {selectedJob.job_id}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectJob(selectedJob.job_id)}
                  className="font-mono uppercase"
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "10px 0",
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    borderRadius: 2,
                    border: "none",
                    background: "var(--chalk)",
                    color: "var(--chalk-ink)",
                    cursor: "pointer",
                  }}
                >
                  Open this task
                </button>
              </div>
            )}
          </div>
        </FigurePanel>
      </div>
    </div>
  );
}
