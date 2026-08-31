"use client";

import type { Job } from "@/lib/types";
import StatusBadge from "./StatusBadge";

/** Shows the selected job's task/model/agent metadata. */
export default function TaskStatus({ job }: { job: Job | null }) {
  if (!job) {
    return (
      <section className="panel" aria-label="Task status">
        <div className="panel-title">Task</div>
        <p className="muted">Select a job from the sidebar to inspect it.</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-label="Task status">
      <div className="panel-title">Task</div>
      <div className="task-row">
        <span className="field-label">Status</span>
        <StatusBadge value={job.status} label={job.status.toUpperCase()} />
      </div>
      <dl className="fact-list">
        <div>
          <dt>Task type</dt>
          <dd>{job.task_type}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{job.model || "—"}</dd>
        </div>
        <div>
          <dt>Agent stage</dt>
          <dd>{job.agent_stage || "—"}</dd>
        </div>
        <div>
          <dt>Iterations</dt>
          <dd>{job.iteration_count ?? 0}</dd>
        </div>
        <div>
          <dt>Tool calls</dt>
          <dd>{job.tool_call_count ?? 0}</dd>
        </div>
        <div>
          <dt>Resource</dt>
          <dd>{job.resource_status || "—"}</dd>
        </div>
      </dl>
      {job.error ? (
        <div className="alert alert-error" role="alert">
          {job.error}
        </div>
      ) : null}
    </section>
  );
}
