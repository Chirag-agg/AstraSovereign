"use client";

import { useEffect, useState } from "react";

import { elapsedSeconds } from "@/lib/console";
import { ApiError, getJobAudit } from "@/lib/api";
import type { ArtifactSummary, Job } from "@/lib/types";
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

function AuditTrail({ userId, jobId }: { userId: string; jobId: string }) {
  const [events, setEvents] = useState<{ event_type: string; component: string; status: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open && !loaded) {
          setLoaded(true);
          getJobAudit(userId, jobId)
            .then((evts) => setEvents(evts))
            .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load audit"));
        }
      }}
    >
      <summary>Audit trail</summary>
      {error ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : events === null ? (
        <div className="loading-row">loading…</div>
      ) : events.length === 0 ? (
        <div className="loading-row">No audit events.</div>
      ) : (
        <ul className="notice-list">
          {events.map((e) => (
            <li key={`${e.event_type}-${e.component}`}>
              <span className="status t-mut">
                <span className="dot" aria-hidden="true" />
              </span>{" "}
              {e.event_type} · {e.component} · {e.status}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export default function Conversation({
  userId,
  job,
  onDownload,
  onSubmit,
  consoleOpen,
  setConsoleOpen,
}: {
  userId: string;
  job: Job | null;
  onDownload: (artifact: ArtifactSummary) => void;
  onSubmit: (text: string) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
}) {
  // auto-open the console while the agent is actively working
  useEffect(() => {
    if (job && (job.status === "running" || job.status === "queued")) {
      setConsoleOpen(true);
    }
  }, [job?.status, setConsoleOpen]);

  if (!job) {
    return (
      <div className="welcome">
        <h2>Sovereign AI Workbench</h2>
        <p>Talk to the agent normally. When it does real work, you can watch it.</p>
        <p className="loading-row">
          Models, OCR, knowledge, tools and the sandbox all run locally on this machine.
        </p>
        <button type="button" className="example-pill" onClick={() => onSubmit(DEMO_TASK)}>
          Try the demo — “{DEMO_TASK}”
        </button>
      </div>
    );
  }

  return (
    <div className="conversation">
      {/* user message */}
      <div className="msg-user">
        <div className="avatar" aria-hidden="true">
          {userId.replace("user-", "U")}
        </div>
        <div className="msg-body">
          <div className="role-row">
            <span className="role">You</span>
          </div>
          <div className="msg-text">{job.message}</div>
        </div>
      </div>

      {/* assistant */}
      <div className="msg-assistant">
        <div className="role-row">
          <span className="role">Assistant</span>
          <span className="sub">· {statusLine(job)}</span>
        </div>

        {job.status === "queued" ? (
          <div className="ack">
            <span className="spinner" aria-hidden="true" />
            Queued — the agent is about to start.
          </div>
        ) : null}
        {job.status === "running" ? (
          <div className="ack">
            <span className="spinner" aria-hidden="true" />
            Working on it — the agent is executing locally.
          </div>
        ) : null}

        {(job.execution_trace && job.execution_trace.length > 0) || job.status === "running" ? (
          <div style={{ margin: "8px 0 14px" }}>
            <WorkConsole job={job} expanded={consoleOpen} onToggle={() => setConsoleOpen(!consoleOpen)} />
          </div>
        ) : null}

        {job.status === "completed" ? (
          <>
            {job.response ? <Markdown text={job.response} /> : <div className="loading-row">Completed.</div>}
            {job.artifacts.length > 0 ? (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
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

        {job.status !== "queued" && job.status !== "running" ? (
          <div style={{ marginTop: 8 }}>
            <AuditTrail userId={userId} jobId={job.job_id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
