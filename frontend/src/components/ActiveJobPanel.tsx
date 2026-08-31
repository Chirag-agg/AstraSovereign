"use client";

import { useJob } from "@/lib/hooks";
import type { ArtifactSummary } from "@/lib/types";
import ArtifactList from "./ArtifactList";
import ExecutionTrace from "./ExecutionTrace";
import TaskStatus from "./TaskStatus";

export default function ActiveJobPanel({
  userId,
  jobId,
  onDownload,
}: {
  userId: string;
  jobId: string;
  onDownload: (artifact: ArtifactSummary) => void;
}) {
  const { job, error } = useJob(userId, jobId);

  if (error) {
    return (
      <section className="panel" aria-label="Active job">
        <div className="panel-title">Job {jobId.slice(0, 12)}</div>
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      </section>
    );
  }

  if (!job) {
    return (
      <section className="panel" aria-label="Active job">
        <div className="panel-title">Job {jobId.slice(0, 12)}</div>
        <p className="muted">Loading…</p>
      </section>
    );
  }

  return (
    <div className="active-job">
      <TaskStatus job={job} />
      <ExecutionTrace trace={job.execution_trace} />
      <section className="panel" aria-label="Answer">
        <div className="panel-title">Answer</div>
        {job.response ? (
          <p className="answer">{job.response}</p>
        ) : (
          <p className="muted">
            {job.status === "running"
              ? "The agent is working — the answer will appear here."
              : "No response."}
          </p>
        )}
      </section>
      <ArtifactList artifacts={job.artifacts} onDownload={onDownload} />
    </div>
  );
}
