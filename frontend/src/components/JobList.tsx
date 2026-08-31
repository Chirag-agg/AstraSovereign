"use client";

import type { JobSummary } from "@/lib/types";
import { isTerminalStatus } from "@/lib/types";
import StatusBadge from "./StatusBadge";

function shortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function JobList({
  jobs,
  activeJobId,
  onSelect,
  onCancel,
}: {
  jobs: JobSummary[] | null;
  activeJobId: string | null;
  onSelect: (jobId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  return (
    <section className="panel" aria-label="Jobs">
      <div className="panel-title">Jobs</div>
      {!jobs || jobs.length === 0 ? (
        <p className="muted">No jobs yet for this user.</p>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => {
            const active = job.job_id === activeJobId;
            return (
              <li key={job.job_id} className="job-item">
                <button
                  type="button"
                  className={`job-card ${active ? "job-card-active" : ""}`}
                  onClick={() => onSelect(job.job_id)}
                  aria-pressed={active}
                >
                  <div className="job-card-top">
                    <span className="job-id" title={job.job_id}>
                      {job.job_id.slice(0, 12)}
                    </span>
                    <StatusBadge value={job.status} label={job.status} />
                  </div>
                  <div className="job-card-meta">
                    {job.task_type} · {job.model || "?"}
                  </div>
                  <div className="job-card-time">{shortTime(job.created_at)}</div>
                </button>
                {!isTerminalStatus(job.status) ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => onCancel(job.job_id)}
                    aria-label={`Cancel ${job.job_id}`}
                  >
                    Cancel
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
