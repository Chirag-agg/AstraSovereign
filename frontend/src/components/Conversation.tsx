"use client";

import AssistantIdle from "@/components/workbench/AssistantIdle";

import { useEffect, useState } from "react";

import { elapsedSeconds } from "@/lib/console";
import { ApiError, getJobAudit } from "@/lib/api";
import type { ArtifactSummary, DocumentMeta, Job } from "@/lib/types";
import ArtifactCard from "./ArtifactCard";
import Markdown from "./Markdown";
import WorkConsole from "./WorkConsole";

export const DEMO_TASK =
  "Review the inspection report against the maintenance procedure, identify issues requiring attention, and create an approval note.";

export function friendlyJobError(job: Job): string {
  const err = job.error || "";
  if (err.includes("model_routing_error") || err.includes("is disabled")) {
    return "The model for this task is not configured or is disabled.";
  }
  if (err.includes("OllamaModelNotFoundError")) {
    return "The local model is unavailable. Pull it with `ollama pull` or edit the model registry.";
  }
  if (err.includes("OllamaUnavailableError") || err.includes("unreachable")) {
    return "The local model server (Ollama) is unreachable.";
  }
  if (err.includes("resource_rejected")) {
    return "The task was rejected: the local resource scheduler could not fit it.";
  }
  if (err.includes("maximum iterations") || err.includes("maximum tool calls")) {
    return "The agent reached its execution limit and stopped.";
  }
  if (err.includes("vision model is not configured") || err.includes("vision analysis failed")) {
    return "Local vision analysis is unavailable (no vision model is configured or it failed).";
  }
  if (err.includes("agent_failed") || err.includes("Agent stopped")) {
    return "The agent could not complete the task.";
  }
  if (err.trim()) {
    return err;
  }
  return "The task failed.";
}

function statusLine(job: Job): string {
  if (job.status === "queued") {
    return "Queued — waiting for the agent…";
  }
  if (job.status === "running") {
    return "Working on it…";
  }
  if (job.status === "completed") {
    const s = elapsedSeconds(job);
    return `Completed${s !== undefined ? ` in ${s.toFixed(1)}s` : ""}`;
  }
  if (job.status === "cancelled") {
    return "Cancelled";
  }
  return "Failed";
}

type AuditEvent = { event_type: string; component: string; status: string };

/** Audit events for a finished job, fetched the first time they are shown. */
function AuditList({ userId, jobId }: { userId: string; jobId: string }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getJobAudit(userId, jobId)
      .then((evts) => alive && setEvents(evts))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "Could not load audit"));
    return () => {
      alive = false;
    };
  }, [userId, jobId]);

  if (error) return <p className="trace-note">{error}</p>;
  if (events === null) return <p className="trace-note">loading…</p>;
  if (events.length === 0) return <p className="trace-note">No audit events.</p>;
  return (
    <ol className="audit-list">
      {events.map((e, i) => (
        <li key={`${e.event_type}-${e.component}-${i}`}>
          <span className="audit-type">{e.event_type}</span>
          <span className="audit-meta">
            {e.component} · {e.status}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function Conversation({
  userId,
  job,
  documents,
  onDownload,
  onSubmit,
  onCancel,
  consoleOpen,
  setConsoleOpen,
}: {
  userId: string;
  job: Job | null;
  documents?: DocumentMeta[];
  onDownload: (artifact: ArtifactSummary) => void;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
}) {
  const active = job?.status === "running" || job?.status === "queued";

  // Like a model's visible thinking: open while the work is happening, folded
  // away once there is an answer, and always one click from being reopened.
  useEffect(() => {
    if (!job) return;
    setConsoleOpen(active);
  }, [job?.status, active, setConsoleOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const [auditRequested, setAuditRequested] = useState(false);
  useEffect(() => {
    if (consoleOpen && job && !active) setAuditRequested(true);
  }, [consoleOpen, job, active]);

  if (!job) {
    return (
      <div style={{ maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <AssistantIdle onSubmit={onSubmit} demoTask={DEMO_TASK} />
      </div>
    );
  }

  // The documents this job actually read (job-scoped manifest), shown on the
  // user message so the context that entered the model is visible after submit.
  const attachedDocuments: { document_id: string; filename: string }[] = (job.document_ids ?? []).map(
    (id) => documents?.find((document) => document.document_id === id) ?? { document_id: id, filename: id },
  );

  const steps = job.execution_trace?.length ?? 0;
  const hasTrace = steps > 0 || active;

  return (
    <div className="conversation">
      {/* The question, quietly. */}
      <div className="turn-ask">
        <span className="turn-label">You asked</span>
        <p className="turn-ask-text">{job.message}</p>
        {attachedDocuments.length > 0 ? (
          <div className="turn-docs" aria-label="Documents attached to this job">
            {attachedDocuments.map((document) => (
              <span key={document.document_id} className="turn-doc">
                {document.filename}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* How it got there — the trace and the audit trail, folded by default. */}
      {hasTrace ? (
        <details
          className="reasoning"
          open={consoleOpen}
          onToggle={(e) => setConsoleOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary>
            <span className={`reasoning-dot ${active ? "is-live" : ""}`} aria-hidden="true" />
            <span className="reasoning-title">{active ? "Working" : "How it got there"}</span>
            <span className="reasoning-meta">
              {statusLine(job)}
              {steps > 0 ? ` · ${steps} step${steps === 1 ? "" : "s"}` : ""}
            </span>
            <span className="reasoning-hint">{consoleOpen ? "Hide" : "Show reasoning & audit trail"}</span>
          </summary>

          <div className="reasoning-body">
            <WorkConsole job={job} expanded onToggle={() => undefined} />
            {!active ? (
              <div className="reasoning-audit">
                <span className="turn-label">Audit trail</span>
                {auditRequested ? <AuditList userId={userId} jobId={job.job_id} /> : null}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* The answer — the thing the page is for. */}
      <div className="turn-answer" aria-live="polite">
        {active ? (
          // Status lives in the reasoning header above; this slot only says
          // where the answer will land, so the two never repeat each other.
          <div className="answer-waiting">
            <span style={{ color: "var(--graphite)" }}>The answer will appear here.</span>
            {onCancel && job.status === "running" ? (
              <button type="button" onClick={onCancel} className="answer-stop">
                Stop
              </button>
            ) : null}
          </div>
        ) : null}

        {job.status === "completed" ? (
          <>
            <div className="answer-head">
              <span className="answer-label">Answer</span>
              {job.model ? <span className="answer-model">{job.model}</span> : null}
            </div>
            <div className="answer-body">
              {job.response ? <Markdown text={job.response} /> : <p>Completed.</p>}
            </div>
            {job.artifacts.length > 0 ? (
              <div className="answer-files">
                {job.artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.artifact_id} artifact={artifact} onDownload={onDownload} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {job.status === "failed" ? (
          <div className="banner banner-error" role="alert">
            <span aria-hidden="true">✕</span>
            <div>
              <div>{friendlyJobError(job)}</div>
              {job.error ? (
                <details>
                  <summary>Technical detail</summary>
                  <span className="loading-row">{job.error}</span>
                </details>
              ) : null}
            </div>
          </div>
        ) : null}

        {job.status === "cancelled" ? (
          <div className="banner banner-ok" role="alert">
            <span aria-hidden="true">—</span> The task was cancelled.
          </div>
        ) : null}
      </div>
    </div>
  );
}
