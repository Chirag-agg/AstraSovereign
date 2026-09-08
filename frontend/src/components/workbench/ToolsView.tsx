"use client";

import React, { useEffect, useState, useCallback, useRef, type FormEvent } from "react";
import {
  Search,
  Image as ImageIcon,
  Code,
  FileText,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Play,
  Loader2,
  Terminal,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getHealth, submitChat, getJob } from "@/lib/api";
import type { Health, Job, TraceEntry, JobStatus } from "@/lib/types";
import { isTerminalStatus } from "@/lib/types";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

interface ToolCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  state: "available" | "unavailable";
  meta: string;
}

function statusPill(status: JobStatus): React.ReactNode {
  const base = "px-2.5 py-0.5 rounded-full text-xs font-semibold border";
  switch (status) {
    case "running":
      return (
        <span className={`${base} bg-amber-50 text-amber-700 border-amber-200/60 inline-flex items-center gap-1`}>
          <Loader2 className="w-3 h-3 animate-spin" /> running
        </span>
      );
    case "completed":
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200/60 inline-flex items-center gap-1`}>
          <CheckCircle2 className="w-3 h-3" /> completed
        </span>
      );
    case "failed":
      return (
        <span className={`${base} bg-rose-50 text-rose-700 border-rose-200/60 inline-flex items-center gap-1`}>
          <XCircle className="w-3 h-3" /> failed
        </span>
      );
    default:
      return (
        <span className={`${base} bg-slate-100 text-slate-600 border-slate-200/60 capitalize`}>
          {status}
        </span>
      );
  }
}

export default function ToolsView() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tool availability");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pollJob = useCallback(
    async (jobId: string) => {
      clearTimer();
      try {
        const data = await getJob(activeUserId(), jobId);
        setJob(data);
        setTrace(data.execution_trace || []);
        if (data.status === "running" || data.status === "queued") {
          timerRef.current = setTimeout(() => {
            void pollJob(jobId);
          }, 1200);
        } else if (isTerminalStatus(data.status)) {
          setSubmitting(false);
        }
      } catch (e) {
        setRunError(e instanceof Error ? e.message : "Failed to poll job");
        setSubmitting(false);
      }
    },
    [clearTimer],
  );

  const handleRun = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = code.trim();
      if (!text || submitting) return;
      setSubmitting(true);
      setRunError(null);
      setJob(null);
      setTrace([]);
      try {
        const res = await submitChat(activeUserId(), text);
        await pollJob(res.job_id);
      } catch (err) {
        setRunError(err instanceof Error ? err.message : "Failed to submit sandbox run");
        setSubmitting(false);
      }
    },
    [code, submitting, pollJob],
  );

  const tools: ToolCard[] = [];
  if (health) {
    const docSearchAvailable =
      (health.knowledge_base.documents ?? 0) > 0 ||
      (health.knowledge_base.embedding && Object.keys(health.knowledge_base.embedding).length > 0);
    const visionOk =
      health.multimodal?.ocr?.enabled && health.multimodal?.vision?.available;

    tools.push({
      id: "file-mgr",
      name: "list_files / read_file / write_file",
      description:
        "Full workspace file management. The agent lists, reads and writes project files on your behalf.",
      icon: <FolderOpen className="w-6 h-6" />,
      state: "available",
      meta: "Always available",
    });

    tools.push({
      id: "doc-search",
      name: "document_search",
      description:
        "Semantic search over your uploaded documents using the local knowledge base.",
      icon: <Search className="w-6 h-6" />,
      state: docSearchAvailable ? "available" : "unavailable",
      meta: docSearchAvailable
        ? `${health.knowledge_base.documents} documents · ${health.knowledge_base.chunks} chunks`
        : "Needs documents + embedding configured",
    });

    tools.push({
      id: "doc-vision",
      name: "document_vision",
      description:
        "OCR and image understanding for scanned documents and images.",
      icon: <ImageIcon className="w-6 h-6" />,
      state: visionOk ? "available" : "unavailable",
      meta: visionOk
        ? `OCR ${health.multimodal.ocr.enabled ? "on" : "off"} · ${health.multimodal.vision.model ?? "vision model"}`
        : "Requires OCR enabled + vision available",
    });

    tools.push({
      id: "doc-gen",
      name: "document_generation",
      description:
        "Generates formatted deliverables (Word documents) from agent output.",
      icon: <FileText className="w-6 h-6" />,
      state: health.document_generation.available ? "available" : "unavailable",
      meta: health.document_generation.available
        ? `Word renderer: ${health.document_generation.word}`
        : "Not available",
    });

    tools.push({
      id: "code-exec",
      name: "code_execution",
      description:
        "Runs generated code in an isolated Docker sandbox. Egress follows the sovereignty sandbox network policy.",
      icon: <Code className="w-6 h-6" />,
      state: "available",
      meta: `Sandbox network: ${health.sovereignty.sandbox_network}`,
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Available Tools
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Local tools for AI-assisted tasks
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16 bg-white border border-slate-200/80 rounded-2xl">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Checking tool availability...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool) => {
                const available = tool.state === "available";
                return (
                  <div
                    key={tool.id}
                    className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[#7047eb]/30 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl shrink-0 ${
                          available
                            ? "bg-[#7047eb]/10 text-[#7047eb]"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {tool.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-800 font-mono break-words">
                          {tool.name}
                        </h3>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          available
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : "bg-amber-50 text-amber-700 border-amber-200/60"
                        }`}
                      >
                        {available ? "available" : "unavailable"}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate ml-2" title={tool.meta}>
                        {tool.meta}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                <Terminal className="w-4 h-4 text-slate-400" />
                <h2 className="text-base font-bold text-slate-800">
                  Run code in the sandbox
                </h2>
              </div>

              <form onSubmit={handleRun} className="space-y-3">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={4}
                  placeholder={"e.g. write and run a python script that prints the first 10 Fibonacci numbers and saves the result to fibonacci.py"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono outline-none focus:border-[#7047eb]/40 resize-y"
                />
                <div className="flex items-center justify-end gap-3">
                  {runError && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200/60 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {runError}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || !code.trim()}
                    className="inline-flex items-center gap-2 bg-[#7047eb] hover:bg-[#5a35d4] text-white rounded-xl px-4 py-2 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>{submitting ? "Running..." : "Run in sandbox"}</span>
                  </button>
                </div>
              </form>

              {job && (
                <div className="mt-4 rounded-xl border border-slate-100 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/60 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Execution trace
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">{job.job_id}</span>
                      {statusPill(job.status)}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-3 space-y-1 font-mono text-xs">
                    {trace.length === 0 ? (
                      <p className="text-slate-400 px-2 py-1">No trace entries yet…</p>
                    ) : (
                      trace.map((t, i) => (
                        <div
                          key={`${job.job_id}-${t.step ?? i}`}
                          className="flex items-start gap-2 px-2 py-1 rounded-lg hover:bg-slate-50"
                        >
                          <span className="text-slate-300 shrink-0 w-6 text-right">
                            {(t.step ?? i + 1)}.
                          </span>
                          <span
                            className={`shrink-0 font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                              t.type === "error" || t.error
                                ? "bg-rose-50 text-rose-600"
                                : t.type === "tool"
                                ? "bg-[#7047eb]/10 text-[#7047eb]"
                                : t.type === "agent"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {t.type}
                          </span>
                          {t.tool && <span className="text-slate-700 font-semibold">{t.tool}</span>}
                          <span className="text-slate-500 break-words min-w-0 flex-1">
                            {t.error || t.result_summary}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  {job.response && (
                    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Result
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                        {job.response}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
