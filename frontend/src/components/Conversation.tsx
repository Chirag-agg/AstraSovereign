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
      className="text-xs text-slate-500 pt-2 border-t border-slate-100 cursor-pointer"
      onToggle={(e) => {
        if (e.currentTarget.open && !loaded) {
          setLoaded(true);
          getJobAudit(userId, jobId)
            .then((evts) => setEvents(evts))
            .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load audit"));
        }
      }}
    >
      <summary className="font-semibold text-slate-700 hover:text-purple-600">Audit trail</summary>
      {error ? (
        <div className="p-3 my-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium" role="alert">
          {error}
        </div>
      ) : events === null ? (
        <div className="text-slate-400 py-2">Loading audit events…</div>
      ) : events.length === 0 ? (
        <div className="text-slate-400 py-2">No audit events recorded for this task.</div>
      ) : (
        <ul className="mt-2 space-y-1 pl-2 text-[11.5px] font-mono text-slate-600 border-l-2 border-purple-200">
          {events.map((e) => (
            <li key={`${e.event_type}-${e.component}`} className="py-0.5">
              <span className="font-semibold text-purple-700">{e.event_type}</span> · {e.component} ·{" "}
              <span className={e.status === "SUCCESS" || e.status === "OK" ? "text-emerald-600 font-bold" : "text-slate-500"}>
                {e.status}
              </span>
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
  onCancel,
  consoleOpen,
  setConsoleOpen,
}: {
  userId: string;
  job: Job | null;
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
      <div className="p-6 rounded-2xl border border-slate-200/90 bg-white shadow-xs text-left select-none">
        <div className="flex items-center gap-2 mb-2 text-xs text-purple-600 font-bold uppercase tracking-wider">
          <span className="h-2 w-2 rounded-full bg-purple-600" />
          <span>ON-PREMISE AI ENGINEERING WORKBENCH</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-1.5">
          Agent Execution &amp; Inference Workspace
        </h2>
        <p className="text-slate-600 text-xs leading-relaxed max-w-2xl mb-4">
          Submit tasks, review documents, or verify code in a fully air-gapped environment. Models, OCR pipelines, vector stores, and execution sandboxes execute strictly on this machine with zero cloud egress.
        </p>
        <button
          type="button"
          aria-label={`Try the demo: ${DEMO_TASK}`}
          onClick={() => onSubmit(DEMO_TASK)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <span>Try the demo — “{DEMO_TASK}”</span>
        </button>
      </div>
    );
  }

  return (
    <div className="conversation space-y-4">
      {/* user message - clean white card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-lg border border-purple-200 bg-purple-50 text-[10.5px] font-bold text-purple-700 font-mono">
            {userId.toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-slate-700">User Prompt</span>
        </div>
        <div className="text-sm font-sans text-slate-900 leading-relaxed font-medium">{job.message}</div>
      </div>

      {/* assistant - clean white container */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg border border-purple-200 bg-purple-50 text-[10.5px] font-bold text-purple-700 font-mono">
              AGENT
            </span>
            <span className="font-bold text-slate-900">Execution Engine</span>
            <span className="text-slate-500 text-xs font-medium">· {statusLine(job)}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">SOCKET: /run/ollama.sock</span>
        </div>

        {job.status === "queued" ? (
          <div className="flex items-center gap-2 py-2 text-xs text-amber-600 font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Agent is about to start local execution…</span>
          </div>
        ) : null}

        {job.status === "running" ? (
          onCancel ? (
            <div className="my-2 p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Working on it — the agent is executing locally</span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold cursor-pointer transition-colors"
              >
                Stop
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2 text-xs text-emerald-700 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Working on it — the agent is executing locally.</span>
            </div>
          )
        ) : null}

        {(job.execution_trace && job.execution_trace.length > 0) || job.status === "running" ? (
          <div className="my-2">
            <WorkConsole job={job} expanded={consoleOpen} onToggle={() => setConsoleOpen(!consoleOpen)} />
          </div>
        ) : null}

        {job.status === "completed" ? (
          <div className="assistant-content bg-white pt-1">
            {job.response ? (
              <div className="text-sm md:text-[14.5px] leading-relaxed text-slate-800 font-sans">
                <Markdown text={job.response} />
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">Completed.</div>
            )}
            {job.artifacts.length > 0 ? (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {job.artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.artifact_id} artifact={artifact} onDownload={onDownload} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {job.status === "failed" ? (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs space-y-1.5" role="alert">
            <div className="font-bold flex items-center gap-1.5 text-rose-900">
              <span>✕</span>
              <span>{friendlyJobError(job)}</span>
            </div>
            {job.error ? (
              <details className="pt-1 text-[11px] font-mono text-rose-700 cursor-pointer">
                <summary className="underline font-semibold">Technical detail</summary>
                <div className="mt-1.5 p-2.5 rounded bg-white/70 border border-rose-200 text-rose-900 whitespace-pre-wrap">
                  {job.error}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}

        {job.status === "cancelled" ? (
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs" role="alert">
            The task was cancelled.
          </div>
        ) : null}

        {job.status !== "queued" && job.status !== "running" ? (
          <div style={{ marginTop: 10 }}>
            <AuditTrail userId={userId} jobId={job.job_id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
