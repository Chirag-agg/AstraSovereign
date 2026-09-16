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

import ThemeTerminal from "./ThemeTerminal";

export default function Conversation({
  userId,
  job,
  documents,
  onDownload,
  onSubmit,
  onCancel,
  consoleOpen,
  setConsoleOpen,
  themeKey = "violet",
}: {
  userId: string;
  job: Job | null;
  documents?: DocumentMeta[];
  onDownload: (artifact: ArtifactSummary) => void;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  themeKey?: "violet" | "emerald" | "cobalt" | "amber" | "rose" | "dark";
}) {
  // auto-open the console while the agent is actively working
  useEffect(() => {
    if (job && (job.status === "running" || job.status === "queued")) {
      setConsoleOpen(true);
    }
  }, [job?.status, setConsoleOpen]);

  if (!job) {
    return (
      <div className="welcome font-mono text-left p-6 rounded-2xl border border-purple-100 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 mb-2 text-xs text-purple-600 font-semibold uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
          <span>ON-PREMISE AI ENGINEERING WORKBENCH</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight mb-1">
          Agent Execution & Inference Workspace
        </h2>
        <p className="text-slate-500 text-xs leading-relaxed max-w-xl mb-3">
          Submit tasks, review documents, or verify code in a fully air-gapped environment. Models, OCR pipelines, vector stores, and execution sandboxes execute strictly on this machine.
        </p>
        <button
          type="button"
          aria-label={`Try the demo: ${DEMO_TASK}`}
          onClick={() => onSubmit(DEMO_TASK)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-mono transition-colors cursor-pointer"
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
      <div className="msg-user rounded-2xl border border-purple-100 bg-purple-50/50 p-4 mb-3 shadow-xs">
        <div className="flex items-center gap-2 mb-1.5 text-xs text-purple-700">
          <span className="px-2 py-0.5 rounded-md border border-purple-200 bg-purple-100 text-[10.5px] font-bold text-purple-800">
            {userId.toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-purple-900">User Prompt</span>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed font-sans">{job.message}</div>
        {attachedDocuments.length > 0 ? (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            aria-label="Documents attached to this job"
          >
            {attachedDocuments.map((document) => (
              <span
                key={document.document_id}
                className="inline-flex items-center rounded-md border border-purple-200 bg-white/80 px-2 py-0.5 text-[10.5px] font-medium text-purple-900 shadow-2xs"
              >
                {document.filename}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* assistant */}
      <div className="msg-assistant rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-[10.5px] font-bold text-emerald-700">
              AGENT
            </span>
            <span className="font-bold text-slate-900">Execution Engine</span>
            <span className="text-slate-400 text-xs">· {statusLine(job)}</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">SOCKET: /run/ollama.sock</span>
        </div>

        {job.status === "queued" ? (
          <div className="ack flex items-center gap-2 py-2 text-xs text-amber-600 font-mono">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Agent is queued for local air-gapped execution…</span>
          </div>
        ) : null}

        {job.status === "running" ? (
          onCancel ? (
            <div className="my-2 p-3 rounded-xl border border-purple-100 bg-purple-50/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-purple-700 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-600 animate-pulse" />
                <span>Working on it — the agent is executing locally on GPU</span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors cursor-pointer"
              >
                Stop Task
              </button>
            </div>
          ) : (
            <div className="ack flex items-center gap-2 py-2 text-xs text-emerald-600 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Working on it — the agent is executing locally.</span>
            </div>
          )
        ) : null}

        {(job.execution_trace && job.execution_trace.length > 0) || job.status === "running" ? (
          <div style={{ margin: "12px 0 16px" }}>
            <WorkConsole job={job} expanded={consoleOpen} onToggle={() => setConsoleOpen(!consoleOpen)} />
          </div>
        ) : null}

        {job.status === "completed" ? (
          <div className="assistant-content text-slate-800 font-sans">
            {job.response ? (
              <Markdown text={job.response} />
            ) : (
              <div className="loading-row text-slate-500">Completed.</div>
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
