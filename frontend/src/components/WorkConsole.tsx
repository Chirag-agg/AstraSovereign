"use client";

import { useEffect, useMemo, useState } from "react";
import { buildConsoleLines, elapsedSeconds } from "@/lib/console";
import type { Job } from "@/lib/types";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function renderLine(line: ReturnType<typeof buildConsoleLines>[number], key: string) {
  switch (line.kind) {
    case "header":
      return (
        <div key={key} className="cline header text-indigo-400 font-semibold flex items-center gap-1.5">
          <span className="text-slate-500 text-[10px]">❯</span>
          <span>{line.text}</span>
        </div>
      );
    case "plan":
      return (
        <div key={key} className="cline plan text-slate-300 pl-4 flex items-start gap-1.5">
          <span className="text-purple-400 select-none">·</span>
          <span>{line.text}</span>
        </div>
      );
    case "planning":
      return (
        <div key={key} className="space-y-0.5">
          <div className="cline flex items-center gap-1.5 text-slate-200">
            <span className="dollar text-emerald-400 font-bold select-none">$</span>{" "}
            <span className="cmd text-sky-400 font-semibold">planning</span>
          </div>
          {line.items.map((item, j) => (
            <div key={j} className="cline plan text-slate-300 pl-4 flex items-start gap-2">
              <span className="plan-num text-slate-500 font-mono text-[11px] select-none">
                {String(j + 1).padStart(2, "0")}.
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      );
    case "command":
      return (
        <div key={key} className="cline flex items-center gap-1.5 text-slate-200">
          <span className="dollar text-emerald-400 font-bold select-none">$</span>{" "}
          <span className="cmd text-sky-400 font-semibold">{line.tool}</span>
          {line.state === "running" ? (
            <span className="meta text-amber-300 font-medium text-[11px] flex items-center gap-1">
              <span> running…</span>
              <span className="spinner" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true" />
            </span>
          ) : null}
        </div>
      );
    case "result":
      return (
        <div key={key} className="cline pl-4 flex items-start gap-2 text-slate-300">
          <span className={`select-none font-bold ${line.ok ? "ok text-emerald-400" : "err text-rose-400"}`}>
            {line.ok ? "✓" : "✕"}
          </span>{" "}
          <span className="leading-relaxed">{line.text}</span>
        </div>
      );
    case "final":
      return (
        <div key={key} className="cline console-final pt-2 mt-2 border-t border-slate-800 flex items-center justify-between text-xs font-semibold">
          {line.state === "done" ? (
            <span className="ok text-emerald-400 flex items-center gap-1.5">
              <span>✓</span>
              <span>TASK COMPLETED</span>
            </span>
          ) : line.state === "cancelled" ? (
            <span className="warn text-amber-400 flex items-center gap-1.5">
              <span>—</span>
              <span>TASK CANCELLED</span>
            </span>
          ) : (
            <span className="err text-rose-400 flex items-center gap-1.5">
              <span>✕</span>
              <span>TASK FAILED</span>
            </span>
          )}
          {line.seconds !== undefined ? (
            <span className="meta text-slate-500 font-mono text-[10.5px]"> · {line.seconds}s</span>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

export default function WorkConsole({
  job,
  expanded,
  onToggle,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [liveDuration, setLiveDuration] = useState<number>(0);

  const isRunning = job.status === "running" || job.status === "queued";

  // Animated spinner when running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Live timer when running
  useEffect(() => {
    if (!isRunning) return;
    const startTime = job.started_at ? new Date(job.started_at).getTime() : Date.now();
    const interval = setInterval(() => {
      setLiveDuration(Math.max(0, (Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, job.started_at]);

  const lines = useMemo(
    () => buildConsoleLines(job.execution_trace || [], job.status),
    [job.execution_trace, job.status],
  );

  const seconds = elapsedSeconds(job);
  const displaySeconds = isRunning
    ? liveDuration.toFixed(1)
    : seconds !== undefined
    ? seconds.toFixed(1)
    : null;

  const statusText =
    job.status === "completed"
      ? `✓ completed${displaySeconds ? ` · ${displaySeconds}s` : ""}`
      : job.status === "failed"
      ? "✕ failed"
      : job.status === "cancelled"
      ? "— cancelled"
      : `running…${displaySeconds ? ` · ${displaySeconds}s` : ""}`;

  return (
    <div
      className={`${job.status === "completed" ? "console done" : "console"} border border-slate-800 rounded-xl bg-[#0b0e14] overflow-hidden shadow-lg`}
      role="group"
      aria-label="Work console"
    >
      {/* Terminal Title Bar (Claude / AGY Terminal Aesthetic) */}
      <button
        type="button"
        className={`console-header w-full flex items-center justify-between px-3.5 py-2.5 bg-[#0f141f] border-b border-slate-800/80 hover:bg-[#151c2c] transition-colors cursor-pointer text-left ${
          expanded ? "open" : ""
        }`}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="work-console-body"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* macOS / Linux Terminal Window Dots */}
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 inline-block" />
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs truncate">
            <span className="text-slate-500 font-bold select-none">&gt;_</span>
            <span className="console-title text-slate-200 font-bold">Work console</span>
            {job.model && (
              <span className="text-[10px] text-purple-300/80 bg-purple-950/60 border border-purple-800/60 px-1.5 py-0.2 rounded font-mono hidden sm:inline truncate max-w-[140px]">
                {job.model}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`console-sub font-mono text-xs font-semibold flex items-center gap-1.5 ${
              isRunning ? "text-emerald-400" : job.status === "completed" ? "text-slate-300" : "text-rose-400"
            }`}
          >
            {isRunning && (
              <span className="text-emerald-400 font-mono text-xs animate-pulse select-none">
                {SPINNER_FRAMES[spinnerFrame]}
              </span>
            )}
            <span>{statusText}</span>
          </span>

          <span className="chev text-[9px] text-slate-400 select-none ml-1 transition-transform" aria-hidden="true">
            {expanded ? "▼" : "▶"}
          </span>
        </div>
      </button>

      {/* Terminal Body */}
      {expanded ? (
        <div
          id="work-console-body"
          className="console-body p-3.5 sm:p-4 font-mono text-xs bg-[#080b11] text-slate-300 space-y-1.5 max-h-[360px] overflow-y-auto leading-relaxed border-t border-slate-900"
        >
          {lines.length > 0 ? (
            lines.map((line, i) => renderLine(line, `${i}`))
          ) : isRunning ? (
            <div className="space-y-1">
              <div className="cline header text-indigo-400 font-semibold flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px]">❯</span>
                <span>agent session · local model connection</span>
              </div>
              <div className="cline flex items-center gap-1.5 text-slate-300">
                <span className="dollar text-emerald-400 font-bold select-none">$</span>{" "}
                <span className="cmd text-sky-400 font-semibold">initializing task pipeline</span>
                <span className="meta text-amber-300 font-medium text-[11px] flex items-center gap-1">
                  <span> running…</span>
                  <span className="spinner" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true" />
                </span>
              </div>
            </div>
          ) : null}

          {/* Active Terminal Pulse Line while Running */}
          {isRunning && lines.length > 0 && (
            <div className="cline pt-1 flex items-center gap-2 text-emerald-400 text-[11.5px] border-t border-slate-900/60 font-mono">
              <span className="text-purple-400 select-none">{SPINNER_FRAMES[spinnerFrame]}</span>
              <span className="text-slate-400">Agent executing local tools &amp; synthesizing answer...</span>
              <span className="w-1.5 h-3 bg-emerald-400 animate-pulse inline-block select-none" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
