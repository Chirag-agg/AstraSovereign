"use client";

import React, { useEffect, useState, useCallback, useRef, type FormEvent } from "react";
import { RefreshCw, Play } from "lucide-react";
import { FigurePanel, StatSlab } from "@/components/ui/instrument";
import Markdown from "@/components/Markdown";
import { getHealth, submitChat, getJob } from "@/lib/api";
import type { Health, Job, TraceEntry, JobStatus } from "@/lib/types";
import { isTerminalStatus } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  running: "var(--signal)",
  queued: "var(--ochre)",
  completed: "var(--metric)",
  failed: "var(--alert)",
  cancelled: "var(--graphite)",
};

function tone(status: JobStatus | string): string {
  return STATUS_TONE[status] ?? "var(--graphite)";
}

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

interface ToolCard {
  id: string;
  /** Plain language first: what this lets the agent do for you. */
  title: string;
  /** The tool's real name, for anyone who needs to match it to the audit. */
  name: string;
  description: string;
  state: "available" | "unavailable";
  meta: string;
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
      (health.knowledge_base?.documents ?? 0) > 0 ||
      (health.knowledge_base?.embedding && Object.keys(health.knowledge_base.embedding).length > 0);
    const visionOk =
      health.multimodal?.ocr?.enabled && health.multimodal?.vision?.available;

    tools.push({
      id: "file-mgr",
      name: "list_files / read_file / write_file",
      description:
        "Full workspace file management. The agent lists, reads and writes project files on your behalf.",
      title: "Work with your files",
      state: "available",
      meta: "Always available",
    });

    tools.push({
      id: "doc-search",
      name: "document_search",
      description:
        "Semantic search over your uploaded documents using the local knowledge base.",
      title: "Find things in your documents",
      state: docSearchAvailable ? "available" : "unavailable",
      meta: docSearchAvailable
        ? `${health.knowledge_base?.documents ?? 0} documents · ${health.knowledge_base?.chunks ?? 0} chunks`
        : "Needs documents + embedding configured",
    });

    tools.push({
      id: "doc-vision",
      name: "document_vision",
      description:
        "OCR and image understanding for scanned documents and images.",
      title: "Read scans and photographs",
      state: visionOk ? "available" : "unavailable",
      meta: visionOk
        ? `OCR ${health.multimodal.ocr.enabled ? "on" : "off"} · ${health.multimodal.vision.model ?? "vision model"}`
        : "Requires OCR enabled + vision available",
    });

    // Every read below is optional-chained on purpose: this view renders
    // straight off the /health payload, and a field the backend has not
    // sent yet should degrade one tile, not throw the workbench into its
    // error boundary.
    tools.push({
      id: "doc-gen",
      name: "document_generation",
      description:
        "Generates formatted deliverables (Word documents) from agent output.",
      title: "Produce a Word document",
      state: health.document_generation?.available ? "available" : "unavailable",
      meta: health.document_generation?.available
        ? `Word renderer: ${health.document_generation.word}`
        : "Not available",
    });

    tools.push({
      id: "code-exec",
      name: "code_execution",
      description:
        "Runs generated code in an isolated Docker sandbox. Egress follows the sovereignty sandbox network policy.",
      title: "Do the arithmetic in a sealed box",
      state: "available",
      meta: `Sandbox network: ${health.sovereignty?.sandbox_network ?? "unknown"}`,
    });
  }

  const availableCount = tools.filter((t) => t.state === "available").length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Capability</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>What the agent can actually do</h1>
            <p style={{ margin: "8px 0 0" }}>
              The agent has no general powers. It has this list, and nothing else. Each one
              runs on this machine, and every use of one is written to the audit trail under
              the name shown here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 font-mono uppercase shrink-0"
            style={{ fontSize: 10.5, letterSpacing: "0.08em", padding: "7px 11px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{ borderLeft: "2px solid var(--alert)", padding: "10px 14px", background: "var(--alert-surface)", borderRadius: 2, fontSize: 13, color: "var(--alert-ink)" }}
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <StatSlab
            value={tools.length > 0 ? `${availableCount}/${tools.length}` : "—"}
            label="Tools ready"
            tone={tools.length > 0 && availableCount === tools.length ? "metric" : availableCount === 0 ? "neutral" : "signal"}
          />

          <FigurePanel figure="1" title="The whole list" caption="plain language, then the name in the audit" flush>
            <table>
              <thead>
                <tr>
                  <th>What it does for you</th>
                  <th>Name in the audit</th>
                  <th>Condition</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {loading && tools.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="font-mono" style={{ color: "var(--graphite)" }}>Checking what is available…</td>
                  </tr>
                ) : tools.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="font-mono" style={{ color: "var(--graphite)" }}>No tool readings available.</td>
                  </tr>
                ) : (
                  tools.map((tool) => {
                    const available = tool.state === "available";
                    const colour = available ? "var(--metric)" : "var(--ochre)";
                    return (
                      <tr key={tool.id}>
                        <td style={{ maxWidth: 360 }}>
                          <span style={{ color: "var(--bone)" }}>{tool.title}</span>
                          <span className="block" style={{ marginTop: 3, fontSize: 12.5, color: "var(--granite)" }}>
                            {tool.description}
                          </span>
                        </td>
                        <td className="font-mono" style={{ color: "var(--signal)", verticalAlign: "top" }}>{tool.name}</td>
                        <td style={{ color: "var(--granite)", verticalAlign: "top" }}>{tool.meta}</td>
                        <td style={{ verticalAlign: "top" }}>
                          <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: colour }}>
                            <span style={{ width: 5, height: 5, borderRadius: 99, background: colour }} />
                            {available ? "ready" : "not ready"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </FigurePanel>
        </div>

        <FigurePanel
          figure="2"
          title="Try the sealed sandbox"
          caption="describe a calculation; the code runs in a container with no network"
          actions={
            job ? (
              <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: tone(job.status) }}>
                <span
                  className={job.status === "running" ? "astra-pulse" : undefined}
                  style={{ width: 5, height: 5, borderRadius: 99, background: tone(job.status) }}
                />
                {job.status}
              </span>
            ) : undefined
          }
        >
          <form onSubmit={handleRun} className="flex flex-col gap-3">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={3}
              placeholder="e.g. compute the remaining wall thickness for a tank shell course and show the working"
              className="w-full font-mono"
              style={{ fontSize: 12.5, padding: "11px 13px", resize: "vertical" }}
            />
            <div className="flex items-center justify-end gap-3">
              {runError && (
                <span className="font-mono" style={{ fontSize: 11.5, color: "var(--alert-ink)" }}>{runError}</span>
              )}
              <button
                type="submit"
                disabled={submitting || !code.trim()}
                className="inline-flex items-center gap-2 font-mono uppercase"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.1em",
                  padding: "9px 15px",
                  borderRadius: 2,
                  border: "none",
                  background: "var(--chalk)",
                  color: "var(--chalk-ink)",
                  cursor: submitting || !code.trim() ? "default" : "pointer",
                  opacity: submitting || !code.trim() ? 0.45 : 1,
                }}
              >
                <Play className="w-3 h-3" />
                {submitting ? "Running" : "Run it"}
              </button>
            </div>
          </form>

          {job && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--carbon)", paddingTop: 14 }}>
              <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
                <span className="mono-label">What it did</span>
                <span className="font-mono" style={{ fontSize: 11, color: "var(--graphite)" }}>{job.job_id}</span>
              </div>
              <div className="font-mono" style={{ maxHeight: 280, overflowY: "auto", fontSize: 11.5 }}>
                {trace.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--graphite)" }}>No steps recorded yet…</p>
                ) : (
                  trace.map((entry, i) => {
                    const failed = entry.type === "error" || Boolean(entry.error);
                    return (
                      <div
                        key={`${job.job_id}-${entry.step ?? i}`}
                        className="flex items-start gap-3"
                        style={{ padding: "5px 0", borderBottom: "1px solid var(--carbon)" }}
                      >
                        <span className="tnum" style={{ width: 22, textAlign: "right", color: "var(--graphite)", flexShrink: 0 }}>
                          {entry.step ?? i + 1}
                        </span>
                        <span
                          className="uppercase"
                          style={{ width: 54, flexShrink: 0, fontSize: 10, letterSpacing: "0.08em", color: failed ? "var(--alert)" : entry.type === "tool" ? "var(--signal)" : "var(--granite)" }}
                        >
                          {entry.type}
                        </span>
                        {entry.tool && <span style={{ color: "var(--bone)", flexShrink: 0 }}>{entry.tool}</span>}
                        <span style={{ color: "var(--granite)", minWidth: 0, wordBreak: "break-word" }}>
                          {entry.error || entry.result_summary}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              {job.response && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--carbon)" }}>
                  <span className="mono-label">Result</span>
                  <div style={{ marginTop: 8 }}>
                    <Markdown text={job.response} />
                  </div>
                </div>
              )}
            </div>
          )}
        </FigurePanel>
      </div>
    </div>
  );
}
