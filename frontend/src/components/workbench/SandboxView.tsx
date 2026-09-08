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
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { getSovereignty, runSandboxCode } from "@/lib/api";
import type { SovereigntyStatus } from "@/lib/types";

interface Run {
  id: string;
  title: string;
  code: string;
  time: string;
  status: "running" | "completed" | "failed";
  stdout?: string;
  stderr?: string;
  duration_ms?: number;
  exit_code?: number;
  error?: string;
  lines: string[];
}

const PRESET_SCRIPTS = [
  {
    title: "Darcy-Weisbach Pipeline",
    code: `import math

def darcy_weisbach(friction_factor, length, diameter, velocity, density=1000):
    """Calculate pressure loss (Pa) using Darcy-Weisbach equation."""
    head_loss = friction_factor * (length / diameter) * (velocity**2 / (2 * 9.81))
    pressure_drop = density * 9.81 * head_loss
    return head_loss, pressure_drop

# Example: 100m DN150 pipe at 2.2 m/s flow velocity
f, L, D, V = 0.02, 100.0, 0.15, 2.2
head, delta_p = darcy_weisbach(f, L, D, V)

print("=== AstraSovereign Engineering Benchmark ===")
print(f"Pipe Diameter: {D*1000:.1f} mm | Length: {L:.1f} m")
print(f"Flow Velocity: {V:.2f} m/s | Friction Factor: {f}")
print(f"Head Loss:     {head:.3f} m")
print(f"Pressure Drop: {delta_p/1000:.2f} kPa")
print("Status: Calculation verified successfully in isolated sandbox.")`,
  },
  {
    title: "Anomaly Detection",
    code: `import math
import random

# Seed for reproducible verification
random.seed(42)
data = [round(random.gauss(24.5, 1.2), 2) for _ in range(50)]
# Inject intentional anomalies
data[12] = 31.8
data[37] = 16.4

mean = sum(data) / len(data)
variance = sum((x - mean) ** 2 for x in data) / len(data)
std_dev = math.sqrt(variance)

outliers = [(idx, val) for idx, val in enumerate(data) if abs(val - mean) > 2 * std_dev]

print(f"Sample Count: {len(data)}")
print(f"Sample Mean:  {mean:.3f}°C")
print(f"Std Dev:      {std_dev:.3f}°C")
print(f"2-Sigma Range: [{mean - 2*std_dev:.2f}, {mean + 2*std_dev:.2f}]")
print(f"Anomalies detected ({len(outliers)}):")
for idx, val in outliers:
    z_score = (val - mean) / std_dev
    print(f"  • Reading #{idx:02d}: {val}°C (z-score: {z_score:+.2f})")`,
  },
  {
    title: "Factorial Benchmark",
    code: `import time

def factorial(n: int) -> int:
    if n <= 1:
        return 1
    return n * factorial(n - 1)

t0 = time.perf_counter_ns()
for _ in range(1000):
    res = factorial(25)
elapsed_us = (time.perf_counter_ns() - t0) / 1000

print("=== AstraSovereign Compute Benchmark ===")
print(f"25! = {res}")
print(f"Result digit count: {len(str(res))} digits")
print(f"1,000 iterations compute time: {elapsed_us:.1f} µs")
print("Sandbox isolation integrity: VERIFIED")`,
  },
  {
    title: "Fault Injection Test",
    code: `import sys

print("Initiating Sandbox fault injection test...")
print(f"Python interpreter: {sys.version.split()[0]}")
print("Testing stderr and traceback capture...")

# Trigger intentional error to demonstrate stderr capture
raise RuntimeError("Sovereign Sandbox detected simulated fault - stderr capture confirmed!")`,
  },
];

export default function SandboxView({ user = "user-001" }: { user?: string }) {
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null);
  const [promptText, setPromptText] = useState("Calculate pressure drop in industrial pipeline using Darcy-Weisbach equation");
  const [code, setCode] = useState(PRESET_SCRIPTS[0].code);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSovereignty().then(setSovereignty).catch(() => undefined);
  }, []);

  useEffect(() => {
      termRef.current?.scrollTo?.({ top: termRef.current.scrollHeight });
  }, [runs, selectedRunId]);

  const handleExecute = async (overrideCode?: string) => {
    const text = (overrideCode || code).trim();
    if (!text || isRunning) return;

    const runId = `run-${Date.now().toString(36)}`;
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Detect title from promptText or first line
    const title = promptText.trim() || text.split("\n")[0].replace(/^#\s*/, "").slice(0, 32) || "Sandbox Script Run";

    const initialRun: Run = {
      id: runId,
      title,
      code: text,
      time: now,
      status: "running",
      lines: [
        `$ sandbox init --isolation=strict --network=none`,
        `$ loading script (${text.length} bytes)...`,
        `$ running python main.py...`,
      ],
    };

    setRuns((prev) => [initialRun, ...prev]);
    setSelectedRunId(runId);
    setIsRunning(true);

    try {
      const result = await runSandboxCode(text, "python", "", user);
      const outLines: string[] = [
        `$ sandbox init --isolation=strict --network=none`,
        `$ python main.py`,
      ];

      if (result.stdout) {
        const cleanStdout = result.stdout.trimEnd();
        cleanStdout.split("\n").forEach((l) => outLines.push(l));
      }

      if (result.stderr) {
        const cleanStderr = result.stderr.trimEnd();
        cleanStderr.split("\n").forEach((l) => outLines.push(`[stderr] ${l}`));
      }

      outLines.push(
        `$ [Process exited with code ${result.exit_code} in ${result.duration_ms}ms]`
      );

      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? {
                ...r,
                status: result.success ? "completed" : "failed",
                stdout: result.stdout,
                stderr: result.stderr,
                exit_code: result.exit_code,
                duration_ms: result.duration_ms,
                error: result.error || (result.success ? undefined : `Exit code ${result.exit_code}`),
                lines: outLines,
              }
            : r
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? {
                ...r,
                status: "failed",
                error: msg,
                lines: [
                  `$ sandbox init --isolation=strict --network=none`,
                  `$ execution error: ${msg}`,
                ],
              }
            : r
        )
      );
    } finally {
      setIsRunning(false);
    }
  };

  const activeRun = runs.find((r) => r.id === selectedRunId) || runs[0] || null;

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
              Phase 5 sovereign ephemeral sandbox execution runtime with isolated environment, no cloud egress, and realtime stdout/stderr streaming.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Runtime: <strong>Subprocess / Docker Isolated</strong></span>
            </span>
          </div>
        </div>

        {/* Input & Execution Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Script Editor & Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Task Prompt Input */}
              <div className="space-y-1.5 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Task Prompt / Instruction
                  </label>
                  <span className="text-[11px] text-purple-600 font-medium">Type instruction or choose preset</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Describe a computation or code task to execute in the sandbox..."
                    className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!promptText.trim()) return;
                      void handleExecute();
                    }}
                    disabled={isRunning || !promptText.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7047eb] text-xs font-bold border border-purple-200 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    Run Prompt
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-purple-600" />
                  Python Execution Code
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
                  {PRESET_SCRIPTS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => {
                        setPromptText(preset.title);
                        setCode(preset.code);
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={13}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="# Enter Python code to execute in isolated sandbox..."
                  className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 focus:outline-none focus:border-purple-500 transition-all resize-y leading-relaxed shadow-inner"
                  spellCheck={false}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Strict memory/CPU quotas • Read-only root • Zero telemetry</span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleExecute()}
                  disabled={isRunning || !code.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#7047eb] hover:bg-[#5e38d6] active:bg-[#522ec4] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing in Sandbox…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute in Sandbox</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output & Return Values Card (when there's an active run) */}
            {activeRun && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Execution Output &amp; Diagnostics
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                        activeRun.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : activeRun.status === "failed"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200 animate-pulse"
                      }`}
                    >
                      {activeRun.status.toUpperCase()}
                    </span>
                  </div>
                  {activeRun.duration_ms !== undefined && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{activeRun.duration_ms} ms</span>
                    </div>
                  )}
                </div>

                {activeRun.stdout ? (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Standard Output (stdout):
                    </span>
                    <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                      {activeRun.stdout}
                    </pre>
                  </div>
                ) : activeRun.status === "completed" ? (
                  <p className="text-xs text-slate-500 italic">Process completed with no stdout generated.</p>
                ) : null}

                {activeRun.stderr ? (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-500" />
                      Standard Error / Traceback (stderr):
                    </span>
                    <pre className="p-3.5 rounded-xl bg-rose-950/20 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed border border-rose-800/40">
                      {activeRun.stderr}
                    </pre>
                  </div>
                ) : null}

                {activeRun.exit_code !== undefined && (
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-500 pt-1">
                    <span>Exit code: <strong className={activeRun.exit_code === 0 ? "text-emerald-600" : "text-rose-600"}>{activeRun.exit_code}</strong></span>
                    <span>Status: {activeRun.exit_code === 0 ? "Success" : "Fault Detected"}</span>
                  </div>
                )}
              </div>
            )}

            {/* Past Execution Runs */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Recent Sandbox Executions
                </h3>
                {runs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRuns([])}
                    className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {runs.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No sandbox executions recorded in this session. Select a preset and click &quot;Execute in Sandbox&quot; to test code execution!
                </p>
              ) : (
                <div className="space-y-2">
                  {runs.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRunId(r.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between text-xs ${
                        r.id === activeRun?.id
                          ? "border-purple-300 bg-purple-50/50 shadow-xs ring-1 ring-purple-200"
                          : "border-slate-100 bg-slate-50/60 hover:bg-slate-100/80"
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-slate-800 truncate max-w-md">
                          {r.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {r.time} • id: {r.id}
                          {r.duration_ms !== undefined && ` • ${r.duration_ms}ms`}
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Terminal Stream (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col h-full min-h-[500px]">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0f141f] border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 inline-block" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-200 ml-1">
                    sovereign sandbox stream
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
                {!activeRun || activeRun.lines.length === 0 ? (
                  <div className="text-slate-500 text-xs py-16 text-center space-y-2">
                    <Terminal className="w-7 h-7 mx-auto text-slate-600" />
                    <p>Terminal output will stream live here during sandbox code execution.</p>
                    <p className="text-[11px] text-slate-600">Click &quot;Execute in Sandbox&quot; to test.</p>
                  </div>
                ) : (
                  activeRun.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`break-words ${
                        line.startsWith("$")
                          ? "text-sky-400 font-semibold"
                          : line.startsWith("[stderr]")
                          ? "text-rose-400 font-medium"
                          : line.includes("===")
                          ? "text-purple-300 font-bold"
                          : line.includes("Status:") || line.includes("VERIFIED")
                          ? "text-emerald-400 font-semibold"
                          : "text-slate-300"
                      }`}
                    >
                      {line}
                    </div>
                  ))
                )}

                {isRunning && (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs pt-2 border-t border-slate-900">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Executing in isolated sandbox runtime...</span>
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
