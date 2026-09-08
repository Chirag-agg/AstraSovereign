"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Loader2,
  ShieldCheck,
  WifiOff,
  Terminal,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Code,
  Layers,
  Sparkles,
} from "lucide-react";
import { getJob, getSovereignty, submitChat } from "@/lib/api";
import type { Job, SovereigntyStatus } from "@/lib/types";

interface Run {
  id: string;
  prompt: string;
  time: string;
  status: string;
  error?: string;
  lines: string[];
}

function short(text: string, limit = 300): string {
  const t = (text ?? "").trim();
  return t.length > limit ? `${t.slice(0, limit)}…` : t;
}

function terminalLines(job: Job): string[] {
  const out: string[] = [];
  for (const e of job.execution_trace ?? []) {
    if (e.type === "agent_started") {
      out.push(`$ agent session · task ${e.task_type ?? job.task_type ?? "coding"} · model ${(e.model as string) || job.model || "local"}`);
      continue;
    }
    if (e.type === "plan") {
      const d = (e.description as string) || "";
      if (d && !d.toLowerCase().startsWith("call tool") && !d.toLowerCase().startsWith("produce the final")) {
        out.push(`$ plan: ${short(d, 200)}`);
      }
      continue;
    }
    if (e.type === "tool_call") {
      const tool = (e.tool as string) || "tool";
      out.push(`$ run ${tool}${tool === "code_execution" ? "  # isolated container, egress off" : ""}`);
      continue;
    }
    if (e.type === "tool_result") {
      const ok = e.ok !== false;
      const summary = short(e.result_summary as string, 240) || (ok ? "ok" : "failed");
      out.push(`  ${ok ? "✓" : "✕"} ${summary}`);
    }
  }
  return out;
}

const PRESET_SCRIPTS = [
  {
    title: "Engineering Calculation",
    prompt: "Write and execute a Python function that calculates the pressure drop in an industrial pipeline using the Darcy-Weisbach equation. Run it with an example and print the result.",
  },
  {
    title: "Data Table Analysis",
    prompt: "Write a Python script that analyzes an array of 50 temperature readings, calculates standard deviation, identifies outliers beyond 2 sigma, and prints the summary.",
  },
  {
    title: "Factorial Benchmark",
    prompt: "Write a recursive Python function to calculate factorial of 15, verify output, and output duration in milliseconds.",
  },
];

export default function SandboxView({ user = "user-001" }: { user?: string }) {
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null);
  const [prompt, setPrompt] = useState(PRESET_SCRIPTS[0].prompt);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSovereignty().then(setSovereignty).catch(() => undefined);
  }, []);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight });
  }, [runs]);

  const patchRun = (id: string, patch: Partial<Run>) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleRun = async () => {
    const text = prompt.trim();
    if (!text || runningId) return;
    try {
      const submitted = await submitChat(user, text);
      const id = submitted.job_id;
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setRunningId(id);
      setRuns((prev) => [{ id, prompt: text, time: now, status: "queued", lines: [] }, ...prev]);
    } catch (err) {
      const id = `failed-${Date.now()}`;
      setRuns((prev) => [
        {
          id,
          prompt: text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: "failed",
          error: err instanceof Error ? err.message : "Could not reach backend.",
          lines: [],
        },
        ...prev,
      ]);
    }
  };

  // Poll running job
  useEffect(() => {
    if (!runningId) return;
    let alive = true;
    const tick = async () => {
      try {
        const job = await getJob(user, runningId);
        if (!alive) return;
        patchRun(runningId, { status: job.status, lines: terminalLines(job) });
        if (["completed", "failed", "cancelled"].includes(job.status)) {
          setRunningId((cur) => (cur === runningId ? null : cur));
          if (job.status === "failed") {
            patchRun(runningId, { error: job.error || "Execution failed." });
          }
        }
      } catch {
        // keep polling
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1100);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [runningId, user]);

  const active = runs.find((r) => r.id === runningId);
  const activeLines = active ? active.lines : runs[0]?.lines || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Secure Code Sandbox
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-emerald-600" />
                Network Disabled (--network none)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Phase 5 ephemeral Docker execution runtime with read-only root, no socket mounting, and zero cloud access
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Runtime: <strong>Docker (Isolated)</strong></span>
            </span>
          </div>
        </div>

        {/* Input & Execution Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Script Editor & Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Python Instruction &amp; Execution Prompt
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">Presets:</span>
                  {PRESET_SCRIPTS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => setPrompt(preset.prompt)}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 cursor-pointer underline"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a computation or Python script to generate and run in the sandbox..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white transition-all resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Strict memory/CPU quotas • Auto container cleanup</span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRun()}
                  disabled={Boolean(runningId) || !prompt.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#7047eb] hover:bg-[#5e38d6] active:bg-[#522ec4] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  {runningId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Running in Sandbox…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Execute in Sandbox</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Past Execution Runs */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recent Sandbox Runs
              </h3>

              {runs.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No sandbox executions recorded in this session. Click &quot;Execute in Sandbox&quot; to test a run!
                </p>
              ) : (
                <div className="space-y-2">
                  {runs.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-slate-800 truncate max-w-md">{r.prompt}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {r.time} • id: {r.id}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0 ${
                          r.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : r.status === "failed"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200 animate-pulse"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Terminal Stream (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col h-full min-h-[420px]">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0f141f] border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 inline-block" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-200 ml-1">
                    docker sandbox stream
                  </span>
                </div>

                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                  --network none
                </span>
              </div>

              {/* Terminal Logs Body */}
              <div
                ref={termRef}
                className="flex-1 p-4 font-mono text-xs text-slate-300 space-y-1.5 overflow-y-auto leading-relaxed bg-[#080b11]"
              >
                {activeLines.length === 0 ? (
                  <div className="text-slate-500 text-xs py-10 text-center space-y-2">
                    <Terminal className="w-6 h-6 mx-auto text-slate-600" />
                    <p>Terminal output will stream live here during sandbox code execution.</p>
                  </div>
                ) : (
                  activeLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`break-words ${
                        line.startsWith("$ run")
                          ? "text-sky-400 font-semibold"
                          : line.includes("✓")
                          ? "text-emerald-400 font-semibold"
                          : line.includes("✕")
                          ? "text-rose-400 font-semibold"
                          : "text-slate-300"
                      }`}
                    >
                      {line}
                    </div>
                  ))
                )}

                {runningId && (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs pt-2 border-t border-slate-900">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Executing in isolated Docker container...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
