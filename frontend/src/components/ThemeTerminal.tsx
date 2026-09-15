"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Terminal as TerminalIcon,
  Play,
  Copy,
  Trash2,
  Maximize2,
  Check,
  Shield,
  Cpu,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import type { Job } from "@/lib/types";

interface ThemeTerminalProps {
  themeKey?: "violet" | "emerald" | "cobalt" | "amber" | "rose" | "dark";
  activeJob?: Job | null;
  running?: boolean;
  onRunCommand?: (cmd: string) => void;
  user?: string;
  onReset?: () => void;
}

interface LogLine {
  id: string;
  time: string;
  type: "info" | "command" | "success" | "warn" | "error" | "output" | "system";
  text: string;
}

interface TaskStep {
  id: number;
  title: string;
  tool?: string;
  duration?: string;
  status: "completed" | "running" | "pending";
  details?: string[];
}

const BRAILLE_SPINNERS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export default function ThemeTerminal({
  themeKey = "violet",
  activeJob,
  running = false,
  onRunCommand,
  user = "user-001",
  onReset,
}: ThemeTerminalProps) {
  const [inputVal, setInputVal] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"daemon" | "progress" | "sandbox">("daemon");
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const [progressOpen, setProgressOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animated spinner for Claude Code / Antigravity terminal progress
  useEffect(() => {
    const timer = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % BRAILLE_SPINNERS.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // Task Progress Steps (Antigravity & Claude Code style)
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([
    {
      id: 1,
      title: "Ingest technical schematics & ITAR regulations",
      tool: "local_fs_ingest",
      duration: "0.4s",
      status: "completed",
      details: ["Loaded Defense_Contract_Compliance_Audit_2026.pdf", "SHA-256 integrity verified"],
    },
    {
      id: 2,
      title: "Parse compliance constraints via Qwen 2.5 Coder 14B",
      tool: "qwen2.5_coder_nvlink",
      duration: "1.2s",
      status: running ? "running" : "completed",
      details: [
        "Inference running on NVLink PCIe bus (14.2 / 24 GB VRAM)",
        "Token throughput: 48 tokens/sec · 842 tokens generated",
        "14 vendor contractual agreements analyzed",
      ],
    },
    {
      id: 3,
      title: "Run Docker isolated sandbox pytest verification",
      tool: "docker_sandbox_runner",
      duration: "0.8s",
      status: running ? "pending" : "completed",
      details: ["Container: python:3.11.8-airgap", "8 unit tests passed (0 failures)"],
    },
    {
      id: 4,
      title: "Sign cryptographic SHA-256 deliverable ledger",
      tool: "ledger_notary_sign",
      status: running ? "pending" : "completed",
      details: ["Air-gap hash: sha256-8f4b7a9c3e2d1f0e4b8a...", "Audit status: Tamper-evident verified"],
    },
  ]);

  const [logs, setLogs] = useState<LogLine[]>([
    {
      id: "1",
      time: "00:00:01",
      type: "system",
      text: "AstraSovereign On-Premise Kernel v4.19-airgap [Strict Local Isolation]",
    },
    {
      id: "2",
      time: "00:00:02",
      type: "info",
      text: "Bound to loopback: 127.0.0.1:11434 (Ollama Engine) | 127.0.0.1:8000 (FastAPI Core)",
    },
    {
      id: "3",
      time: "00:00:02",
      type: "success",
      text: "Hardware acceleration online: NVIDIA RTX 4090 PCIe NVLink (VRAM 24GB Ready)",
    },
    {
      id: "4",
      time: "00:00:03",
      type: "info",
      text: "Zero Egress Enforcement [RULE-0]: External TCP/UDP egress sockets blocked.",
    },
    {
      id: "5",
      time: "00:00:04",
      type: "command",
      text: "sovereign-agent dispatch --model qwen2.5-coder:14b --priority P0",
    },
    {
      id: "6",
      time: "00:00:04",
      type: "output",
      text: "→ Models Mounted: [qwen2.5-coder:14b] [llama3.3:70b-airgap] [rapidocr:v2]",
    },
    {
      id: "7",
      time: "00:00:05",
      type: "success",
      text: "Air-gap session active. Type 'help' or enter a command below.",
    },
  ]);

  // Synchronize execution trace if an active job is running
  useEffect(() => {
    if (activeJob && activeJob.execution_trace && activeJob.execution_trace.length > 0) {
      const now = new Date().toTimeString().split(" ")[0];
      const traceLines: LogLine[] = activeJob.execution_trace.map((tr, idx) => ({
        id: `tr-${idx}-${Date.now()}`,
        time: now,
        type: tr.ok ? "success" : "info",
        text: `[TRACE:${tr.tool || "EXEC"}] ${tr.text || JSON.stringify(tr)}`,
      }));

      setLogs((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const filtered = traceLines.filter((l) => !existingIds.has(l.id));
        return [...prev, ...filtered];
      });
    }
  }, [activeJob?.execution_trace]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, running]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    const time = new Date().toTimeString().split(" ")[0];
    const newLogs: LogLine[] = [
      ...logs,
      {
        id: `${Date.now()}`,
        time,
        type: "command",
        text: cmd,
      },
    ];

    const lower = cmd.toLowerCase();

    if (lower === "help") {
      newLogs.push({
        id: `${Date.now() + 1}`,
        time,
        type: "output",
        text: `Available Sovereign Terminal Commands:
  • progress            - Toggle Antigravity / Claude Code task progress view
  • status              - Inspect air-gap defense & NVLink GPU compute load
  • models              - Query local Ollama model cluster
  • tasks               - List current task queue & priority
  • demo                - Simulate live multi-step task execution
  • clear               - Clear terminal screen buffer`,
      });
    } else if (lower === "progress") {
      setProgressOpen((prev) => !prev);
      newLogs.push({
        id: `${Date.now() + 1}`,
        time,
        type: "info",
        text: `Antigravity / Claude Code task progress panel toggled.`,
      });
    } else if (lower === "status") {
      newLogs.push({
        id: `${Date.now() + 1}`,
        time,
        type: "info",
        text: `[KERNEL HEALTH: OK] Loopback 127.0.0.1 active. Zero external packets detected.
VRAM Allocation: 14.2 GB / 24.0 GB (59% allocated).
Temperature: 52°C · Fan: 45% · PCIe Bus: Gen 5 x16.`,
      });
    } else if (lower === "models") {
      newLogs.push({
        id: `${Date.now() + 1}`,
        time,
        type: "output",
        text: `Active Quantized Models:
  1. qwen2.5-coder:14b-instruct-q4_K_M (Code & Tool Execution)
  2. llama3.3:70b-instruct-q4_K_M       (ITAR Defense Reasoner)
  3. mistral-nemo:12b-instruct-q4_0     (Document Drafter)
  4. rapidocr-onprem:v2.1                (OCR Extraction Engine)`,
      });
    } else if (lower === "demo") {
      newLogs.push({
        id: `${Date.now() + 1}`,
        time,
        type: "success",
        text: `Starting simulated Claude Code / Antigravity task execution sequence...`,
      });
      setProgressOpen(true);
      // Simulate live step execution
      setTaskSteps((prev) =>
        prev.map((step, idx) => ({
          ...step,
          status: idx === 0 ? "completed" : idx === 1 ? "running" : "pending",
        }))
      );
      setTimeout(() => {
        setTaskSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx <= 1 ? "completed" : idx === 2 ? "running" : "pending",
          }))
        );
      }, 1500);
      setTimeout(() => {
        setTaskSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx <= 2 ? "completed" : idx === 3 ? "running" : "pending",
          }))
        );
      }, 3000);
      setTimeout(() => {
        setTaskSteps((prev) => prev.map((step) => ({ ...step, status: "completed" })));
      }, 4500);
    } else if (lower === "clear") {
      setLogs([]);
      setInputVal("");
      return;
    } else {
      newLogs.push({
        id: `${Date.now() + 1}`,
        time,
        type: "info",
        text: `[SANDBOX DISPATCH] Command '${cmd}' executed in local isolated container.`,
      });
      if (onRunCommand) onRunCommand(cmd);
    }

    setLogs(newLogs);
    setInputVal("");
  };

  const copyLogs = () => {
    const raw = logs.map((l) => `[${l.time}] ${l.text}`).join("\n");
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full flex flex-col rounded-2xl overflow-hidden border border-slate-700/80 bg-[#0a0d14] text-[#f0f6fc] font-mono shadow-2xl transition-all">
      {/* ─────────────────────────────────────────────────────────────────
          1. TERMINAL HEADER (Antigravity & VS Code Theme)
      ───────────────────────────────────────────────────────────────── */}
      <div className="h-10 px-4 bg-[#111622] border-b border-slate-700/80 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          {/* macOS window control dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>

          <div className="h-4 w-[1px] bg-slate-700 mx-1" />

          {/* Tab Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("daemon")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "daemon"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Console Stream</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("progress");
                setProgressOpen(true);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "progress"
                  ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Task Stepper</span>
              <span className="px-1 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-black">
                Claude Code
              </span>
            </button>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {running && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-600/50">
              <span className="font-mono text-sm">{BRAILLE_SPINNERS[spinnerIndex]}</span>
              <span>Inference Active</span>
            </div>
          )}

          <button
            onClick={() => setProgressOpen(!progressOpen)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            title="Toggle Task Progress Stepper"
          >
            <span>Progress</span>
            {progressOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          <button
            onClick={copyLogs}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Copy Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setLogs([])}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. ANTIGRAVITY & CLAUDE CODE TASK PROGRESS STEPPER (User Request)
      ───────────────────────────────────────────────────────────────── */}
      {progressOpen && (
        <div className="p-3.5 bg-[#0f1420] border-b border-slate-700/80 space-y-2.5 animate-in fade-in select-text">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-300 font-mono uppercase tracking-wider text-[11px]">
                Autonomous Execution Pipeline
              </span>
              <span className="text-slate-500 font-normal">|</span>
              <span className="text-slate-400 font-normal">Qwen 2.5 Coder 14B on NVLink</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-bold">
                {taskSteps.filter((s) => s.status === "completed").length} / {taskSteps.length} Steps Done
              </span>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${
                      (taskSteps.filter((s) => s.status === "completed").length / taskSteps.length) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stepper Tree (Antigravity style) */}
          <div className="space-y-1.5 pt-1">
            {taskSteps.map((step) => {
              const isCompleted = step.status === "completed";
              const isRunning = step.status === "running";

              return (
                <div
                  key={step.id}
                  className={`p-2.5 rounded-xl border text-xs transition-all ${
                    isRunning
                      ? "bg-cyan-950/40 border-cyan-500/50 text-white shadow-sm"
                      : isCompleted
                      ? "bg-slate-900/60 border-slate-800/80 text-slate-300"
                      : "bg-slate-950/30 border-slate-800/40 text-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isRunning ? (
                        <span className="text-cyan-400 font-mono text-sm font-black shrink-0">
                          {BRAILLE_SPINNERS[spinnerIndex]}
                        </span>
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                      )}

                      <span className="font-semibold text-white">
                        [{step.id}/{taskSteps.length}] {step.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      {step.tool && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-bold">
                          {step.tool}
                        </span>
                      )}
                      {step.duration && <span className="text-slate-400">{step.duration}</span>}
                    </div>
                  </div>

                  {/* Step Detailed Logs */}
                  {step.details && (isRunning || isCompleted) && (
                    <div className="pl-6 pt-1.5 space-y-0.5 text-[11px] font-mono text-slate-400">
                      {step.details.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-slate-600">├──</span>
                          <span className={isRunning ? "text-cyan-200" : "text-slate-400"}>{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          3. MAIN TERMINAL LOG STREAM (High-Contrast White & Vibrant Colors)
      ───────────────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-1.5 h-64 overflow-y-auto select-text text-xs leading-relaxed">
        {logs.map((log) => {
          let lineClass = "text-[#f0f6fc]";
          let prefix = "";

          if (log.type === "system") {
            lineClass = "text-[#93c5fd] font-semibold";
            prefix = "⚡ ";
          } else if (log.type === "success") {
            lineClass = "text-[#4ade80] font-semibold";
            prefix = "✔ ";
          } else if (log.type === "command") {
            lineClass = "text-[#ffffff] font-bold";
            prefix = "$ ";
          } else if (log.type === "output") {
            lineClass = "text-[#e2e8f0]";
          } else if (log.type === "warn") {
            lineClass = "text-[#fbbf24]";
            prefix = "▲ ";
          } else if (log.type === "error") {
            lineClass = "text-[#f87171] font-bold";
            prefix = "✖ ";
          }

          return (
            <div key={log.id} className="flex items-start gap-2 group">
              <span className="text-slate-600 text-[10.5px] select-none shrink-0 pt-0.5 font-mono">
                {log.time}
              </span>
              <span className={`${lineClass} font-mono break-all whitespace-pre-wrap`}>
                {prefix}
                {log.text}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          4. INTERACTIVE SHELL PROMPT (High-Contrast Input)
      ───────────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleCommandSubmit}
        className="h-11 px-4 bg-[#111622] border-t border-slate-700/80 flex items-center gap-2 text-xs"
      >
        <span className="text-[#22c55e] font-bold select-none">sovereign@airgap</span>
        <span className="text-slate-500 select-none">:</span>
        <span className="text-[#38bdf8] font-bold select-none">~</span>
        <span className="text-slate-400 font-bold select-none">$</span>

        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Enter command or task prompt (type 'help' or 'demo')..."
          className="flex-1 bg-transparent text-[#ffffff] font-semibold outline-none border-none placeholder:text-slate-500 font-mono text-xs"
        />

        <button
          type="submit"
          className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
}
