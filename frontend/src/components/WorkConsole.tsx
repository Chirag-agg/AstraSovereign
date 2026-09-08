"use client";

import React, { useMemo } from "react";
import {
  Terminal,
  ShieldCheck,
  WifiOff,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Layers,
  ChevronDown,
  ChevronRight,
  Cpu,
} from "lucide-react";
import { buildConsoleLines, elapsedSeconds } from "@/lib/console";
import type { Job } from "@/lib/types";

export default function WorkConsole({
  job,
  expanded,
  onToggle,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lines = useMemo(
    () => buildConsoleLines(job.execution_trace || [], job.status),
    [job.execution_trace, job.status],
  );
  const seconds = elapsedSeconds(job);
  const isRunning = job.status === "running" || job.status === "queued";

  return (
    <div className="w-full my-3 rounded-2xl overflow-hidden border border-slate-800 bg-[#0a0d14] shadow-xl text-xs font-mono select-none">
      {/* Terminal Title Bar (Inspired by Claude Code & Antigravity Live Terminal) */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-2.5 bg-[#0f1420] border-b border-slate-800/80 cursor-pointer hover:bg-[#131929] transition-colors"
      >
        {/* Left: Window Dots & Terminal Label */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/90 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/90 inline-block" />
          </div>
          <div className="flex items-center gap-2 text-slate-300 font-bold ml-1">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-200">AstraSovereign Terminal</span>
            <span className="text-[10.5px] font-normal text-slate-500">•</span>
            <span className="text-[10.5px] font-normal text-purple-300">
              {job.model || "local-inference"}
            </span>
          </div>
        </div>

        {/* Right: Technical Badges & Toggle */}
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
            <WifiOff className="w-3 h-3 text-emerald-400" />
            <span>0B Egress (Air-Gap)</span>
          </span>

          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
              job.status === "completed"
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                : job.status === "failed"
                ? "bg-rose-950/60 text-rose-300 border-rose-800/60"
                : "bg-purple-950/60 text-purple-300 border-purple-800/60 animate-pulse"
            }`}
          >
            {isRunning ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                <span>RUNNING</span>
                {seconds !== undefined && <span>({seconds.toFixed(1)}s)</span>}
              </>
            ) : job.status === "completed" ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>DONE {seconds !== undefined ? `· ${seconds.toFixed(1)}s` : ""}</span>
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-rose-400" />
                <span>FAILED</span>
              </>
            )}
          </span>

          <span className="text-slate-500 hover:text-slate-300">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </div>
      </div>

      {/* Terminal Live Stream Body */}
      {expanded && (
        <div className="p-4 space-y-2 text-slate-300 bg-[#070a10] overflow-x-auto leading-relaxed border-t border-slate-900">
          {/* Header Banner */}
          <div className="text-[11px] text-slate-500 pb-2 border-b border-slate-900/80 select-text">
            <div>┌── AstraSovereign Air-Gap Engine v0.10.0 [Isolated Subsystem]</div>
            <div>│ Job: {job.job_id} · Task Type: {job.task_type || "general"}</div>
            <div>│ Model: {job.model || "local"} · Workspace: data/workspaces/{job.user_id}/{job.job_id.slice(0, 8)}</div>
            <div>└── Network Guard: STRICT_LOCAL_ONLY (Zero External Telemetry)</div>
          </div>

          {/* Lines */}
          <div className="space-y-1.5 pt-1 select-text">
            {lines.length === 0 ? (
              <div className="text-slate-500 italic py-2">
                Initializing execution trace and model parameters...
              </div>
            ) : (
              lines.map((line, idx) => {
                if (line.kind === "header") {
                  return (
                    <div key={idx} className="text-purple-400 font-bold flex items-center gap-1.5">
                      <span className="text-slate-600">▶</span>
                      <span>{line.text.toUpperCase()}</span>
                    </div>
                  );
                }
                if (line.kind === "planning") {
                  return (
                    <div key={idx} className="space-y-0.5 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60 my-1">
                      <div className="text-cyan-400 font-semibold flex items-center gap-1.5">
                        <span className="text-cyan-600">$</span>
                        <span>agent stage decomposition &amp; planning</span>
                      </div>
                      {line.items.map((item, j) => (
                        <div key={j} className="text-slate-400 pl-4 flex items-start gap-1.5">
                          <span className="text-purple-400 font-bold">{j + 1}.</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                if (line.kind === "plan") {
                  return (
                    <div key={idx} className="text-slate-400 pl-3 flex items-start gap-1.5">
                      <span className="text-slate-600">•</span>
                      <span>{line.text}</span>
                    </div>
                  );
                }
                if (line.kind === "command") {
                  return (
                    <div key={idx} className="flex items-center gap-2 text-sky-300 font-semibold">
                      <span className="text-purple-500 font-bold">$</span>
                      <span>tool:exec({line.tool})</span>
                      {line.state === "running" ? (
                        <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.2 rounded animate-pulse">
                          executing…
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.2 rounded">
                          {line.note || "done"}
                        </span>
                      )}
                    </div>
                  );
                }
                if (line.kind === "result") {
                  return (
                    <div key={idx} className={`pl-4 flex items-start gap-2 ${line.ok ? "text-emerald-400" : "text-rose-400"}`}>
                      <span>{line.ok ? "✓" : "✕"}</span>
                      <span className="text-slate-300">{line.text}</span>
                    </div>
                  );
                }
                if (line.kind === "final") {
                  return (
                    <div
                      key={idx}
                      className={`mt-2 p-2 rounded-lg border font-bold flex items-center justify-between ${
                        line.state === "done"
                          ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                          : line.state === "cancelled"
                          ? "bg-amber-950/40 text-amber-300 border-amber-800/60"
                          : "bg-rose-950/40 text-rose-300 border-rose-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {line.state === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>
                          {line.state === "done"
                            ? "TASK COMPLETE"
                            : line.state === "cancelled"
                            ? "TASK CANCELLED"
                            : "TASK FAILED"}
                        </span>
                      </div>
                      {line.seconds !== undefined && (
                        <span className="text-[10.5px] font-mono text-slate-400 font-normal">
                          Total duration: {line.seconds.toFixed(2)}s
                        </span>
                      )}
                    </div>
                  );
                }
                return null;
              })
            )}
          </div>

          {/* Running Cursor */}
          {isRunning && (
            <div className="flex items-center gap-2 text-purple-400 pt-2 border-t border-slate-900/60">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-xs">Model stream active · zero external connections</span>
              <span className="animate-pulse text-purple-300 font-bold">▌</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
