"use client";

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
  // auto-open the console while the agent is actively working
  useEffect(() => {
    if (job && (job.status === "running" || job.status === "queued")) {
      setConsoleOpen(true);
    }
  }, [job?.status, setConsoleOpen]);

  if (!job) {
    return (
      <div className="welcome font-mono text-left p-6 rounded border border-zinc-200 bg-zinc-100/30">
        <div className="flex items-center gap-2 mb-2 text-xs text-sky-400 font-semibold uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          <span>ON-PREMISE AI ENGINEERING WORKBENCH</span>
        </div>
        <h2 className="text-lg font-semibold text-white tracking-tight mb-1">
          Agent Execution & Inference Workspace
        </h2>
        <p className="text-zinc-400 text-xs leading-relaxed max-w-xl mb-3">
          Submit tasks, review documents, or verify code in a fully air-gapped environment. Models, OCR pipelines, vector stores, and execution sandboxes execute strictly on this machine.
        </p>
        <button
          type="button"
          aria-label={`Try the demo: ${DEMO_TASK}`}
          onClick={() => onSubmit(DEMO_TASK)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-200 bg-zinc-100/80 hover:bg-zinc-100 text-zinc-600 text-xs font-mono transition-colors cursor-pointer"
        >
          <span>Try the demo — “{DEMO_TASK}”</span>
        </button>
      </div>
    );
  }

  // The documents this job actually read (job-scoped manifest), shown on the
  // user message so the context that entered the model is visible after submit.
  const attachedDocuments: { document_id: string; filename: string }[] = (
    job.document_ids ?? []
  ).map(
    (id) =>
      documents?.find((document) => document.document_id === id) ?? {
        document_id: id,
        filename: id,
      },
  );

  return (
    <div className="conversation font-mono">
      {/* user message */}
      <div className="msg-user rounded border border-zinc-200/80 bg-zinc-100/40 p-3 mb-3">
        <div className="flex items-center gap-2 mb-1.5 text-xs text-zinc-400">
          <span className="px-1.5 py-0.2 rounded border border-zinc-200 bg-zinc-100 text-[10px] font-bold text-zinc-500">
            {userId.toUpperCase()}
          </span>
          <span className="text-[11px] font-medium text-zinc-500">User Prompt</span>
        </div>
        <div className="text-xs text-zinc-600 leading-relaxed">{job.message}</div>
        {attachedDocuments.length > 0 ? (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            aria-label="Documents attached to this job"
          >
            {attachedDocuments.map((document) => (
              <span
                key={document.document_id}
                className="inline-flex items-center rounded border border-zinc-200 bg-zinc-100/70 px-1.5 py-0.5 text-[10px] text-zinc-500"
              >
                {document.filename}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* assistant */}
      <div className="msg-assistant rounded border border-zinc-200 bg-zinc-100/20 p-3.5">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.2 rounded border border-sky-900 bg-sky-950/60 text-[10px] font-bold text-sky-400">
              AGENT
            </span>
            <span className="font-medium text-white">Execution Engine</span>
            <span className="text-zinc-500 text-[11px]">· {statusLine(job)}</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">SOCKET: /run/ollama.sock</span>
        </div>

        {job.status === "queued" ? (
          <div className="ack flex items-center gap-2 py-2 text-xs text-amber-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Agent is about to start local execution…</span>
          </div>
        ) : null}

        {job.status === "running" ? (
          onCancel ? (
            <div className="my-2 p-2.5 rounded border border-zinc-200 bg-zinc-100/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Working on it — the agent is executing locally</span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="px-2 py-1 rounded border border-red-200 text-red-400 hover:bg-red-100/40 text-[11px] cursor-pointer"
              >
                Stop
              </button>
            </div>
          ) : (
            <div className="ack flex items-center gap-2 py-2 text-xs text-emerald-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Working on it — the agent is executing locally.</span>
            </div>
          )
        ) : null}

        {(job.execution_trace && job.execution_trace.length > 0) || job.status === "running" ? (
          <div style={{ margin: "8px 0 14px" }}>
            <WorkConsole job={job} expanded={consoleOpen} onToggle={() => setConsoleOpen(!consoleOpen)} />
          </div>
        ) : null}

        {job.status === "completed" ? (
          <div className="assistant-content">
            {job.response ? (
              <Markdown text={job.response} />
            ) : (
              <div className="loading-row">Completed.</div>
            )}
            {job.artifacts.length > 0 ? (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {job.artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.artifact_id} artifact={artifact} onDownload={onDownload} />
                ))}
              </div>
            ) : null}
          </div>
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
