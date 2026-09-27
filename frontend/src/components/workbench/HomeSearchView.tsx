"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
  Cpu,
  Terminal,
  Users2,
  Download,
  CheckCircle2,
  Clock,
  Radio,
  XCircle,
  AlertCircle,
  FolderOpen,
  Copy,
  Check,
  RotateCcw,
  Bot,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { submitChat, getJob } from "@/lib/api";
import type { ArtifactSummary, DocumentMeta, JobSummary, Job } from "@/lib/types";
import { FigurePanel, NumberedList } from "@/components/ui/instrument";
import { ModeSwitch } from "@/components/workbench/ModeSwitch";

interface HomeSearchViewProps {
  onSearchSubmit: (query: string) => void;
  onNavigate: (section: any) => void;
  jobs: JobSummary[] | null;
  documents?: DocumentMeta[] | null;
  onDownloadArtifact: (artifact: ArtifactSummary) => void;
}

interface HomeChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  status: "running" | "completed" | "failed";
  step?: string;
  model?: string;
  jobId?: string;
  artifacts?: ArtifactSummary[];
}

const SAMPLE_QUERIES = [
  {
    label: "Review Document",
    query: "Review the document and summarize the key points.",
    badge: "Analysis",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    label: "Extract Data",
    query: "Extract the data from the provided files into a table.",
    badge: "Extraction",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  {
    label: "Draft Report",
    query: "Draft a brief report based on the provided context.",
    badge: "Writing",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    label: "Analyze Metrics",
    query: "Analyze the attached metrics and identify trends.",
    badge: "Analytics",
    badgeColor: "bg-blue-100 text-blue-700",
  },
];

function statusIcon(status: string) {
  switch (status) {
    case "completed":
    case "ready":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    case "running":
    case "processing":
      return <Radio className="w-3.5 h-3.5 text-purple-500 animate-pulse shrink-0" />;
    case "queued":
      return <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case "failed":
    case "error":
      return <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    default:
      return <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
}

const HOME_TONE: Record<string, string> = {
  running: "var(--signal)",
  queued: "var(--ochre)",
  completed: "var(--metric)",
  failed: "var(--alert)",
  cancelled: "var(--graphite)",
};

function activeUserId(): string {
  if (typeof window === "undefined") return "user-001";
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

export default function HomeSearchView({
  onSearchSubmit,
  onNavigate,
  jobs,
  documents,
  onDownloadArtifact,
}: HomeSearchViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<HomeChatMessage[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const docCount = documents ? documents.length : 0;
  const recentTasks = jobs ? jobs.slice(0, 5) : [];

  // Poll active assistant job
  useEffect(() => {
    if (!activeJobId) return;
    let alive = true;

    const poll = async () => {
      try {
        const job = await getJob(activeUserId(), activeJobId);
        if (!alive) return;

        // Derive current stage / step
        let currentStep = "Processing query...";
        if (job.execution_trace && job.execution_trace.length > 0) {
          const last = job.execution_trace[job.execution_trace.length - 1];
          if (last.type === "tool_call") {
            currentStep = `Executing tool: ${last.tool || "local tool"}...`;
          } else if (last.type === "plan") {
            currentStep = (last.description as string) || "Formulating plan...";
          } else if (last.type === "agent_started") {
            currentStep = `Model ${job.model || "local"} initialized.`;
          }
        }

        if (job.status === "completed") {
          setMessages((prev) =>
            prev.map((m) =>
              m.jobId === activeJobId
                ? {
                    ...m,
                    text: job.response || "Task completed successfully.",
                    status: "completed",
                    model: job.model || "AstraSovereign Local",
                    artifacts: job.artifacts || [],
                  }
                : m,
            ),
          );
          setActiveJobId(null);
        } else if (job.status === "failed" || job.status === "cancelled") {
          setMessages((prev) =>
            prev.map((m) =>
              m.jobId === activeJobId
                ? {
                    ...m,
                    text: job.error || "Execution failed. Check local model connection.",
                    status: "failed",
                    model: job.model || "AstraSovereign Local",
                  }
                : m,
            ),
          );
          setActiveJobId(null);
        } else {
          // Still running
          setMessages((prev) =>
            prev.map((m) =>
              m.jobId === activeJobId
                ? {
                    ...m,
                    step: currentStep,
                    model: job.model || "AstraSovereign Local",
                  }
                : m,
            ),
          );
        }
      } catch {
        // network polling retry
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 900);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [activeJobId]);

  // Scroll to bottom of chat when new messages appear
  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleAskAssistant = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || activeJobId) return;

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        text: trimmed,
        time: timeString,
        status: "completed",
      },
      {
        id: assistantMsgId,
        sender: "assistant",
        text: "",
        time: timeString,
        status: "running",
        step: "Decomposing task and routing to local model...",
      },
    ]);
    setSearchQuery("");

    try {
      const res = await submitChat(activeUserId(), trimmed);
      const jobId = res.job_id;
      setActiveJobId(jobId);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, jobId } : m)),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                status: "failed",
                text:
                  err instanceof Error
                    ? err.message
                    : "Unable to connect to local backend engine.",
              }
            : m,
        ),
      );
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleAskAssistant(searchQuery);
  };

  const handleSelectSample = (query: string) => {
    setSearchQuery(query);
    void handleAskAssistant(query);
  };

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // The conversation panel only exists once something has been asked, so the
  // figures after it renumber rather than leaving a gap where FIG.2 would be.
  const figNext = messages.length > 0 ? 3 : 2;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="pb-4 border-b border-[var(--carbon)] flex flex-col gap-4">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Quick ask</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>What would you like done?</h1>
            <p style={{ margin: "8px 0 0" }}>
              Ask in your own words and get a plain answer here. When you need to see every
              step it took, keep the files it made, or check the audit trail, use the
              Assistant workspace.
            </p>
          </div>
          <ModeSwitch current="home" onSwitch={(mode) => onNavigate(mode)} />
        </div>

        <FigurePanel
          figure="1"
          title="Ask"
          caption="plain English is fine"
          actions={
            messages.length > 0 ? (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="font-mono uppercase"
                style={{ fontSize: 10, letterSpacing: "0.08em", padding: "5px 9px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
              >
                Clear
              </button>
            ) : undefined
          }
        >
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
            <textarea
              rows={3}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleAskAssistant(searchQuery);
                }
              }}
              placeholder="e.g. Check this inspection report against the maintenance procedure and draft the approval note"
              className="w-full"
              style={{ fontSize: 14.5, lineHeight: 1.6, padding: "12px 14px", resize: "vertical" }}
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--granite)" }}>
                <span className="astra-pulse" style={{ width: 5, height: 5, borderRadius: 99, background: "var(--metric)" }} />
                Local engine · nothing leaves this machine
              </span>
              <button
                type="submit"
                disabled={!searchQuery.trim() || Boolean(activeJobId)}
                className="inline-flex items-center justify-center gap-2 font-mono uppercase"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.1em",
                  padding: "10px 18px",
                  borderRadius: 2,
                  border: "none",
                  background: "var(--chalk)",
                  color: "var(--chalk-ink)",
                  cursor: !searchQuery.trim() || activeJobId ? "default" : "pointer",
                  opacity: !searchQuery.trim() || activeJobId ? 0.45 : 1,
                }}
              >
                {activeJobId ? "Working" : "Ask"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {messages.length === 0 && (
            <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--carbon)" }}>
              <span className="mono-label" style={{ marginRight: 4 }}>Or start from</span>
              {SAMPLE_QUERIES.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => void handleAskAssistant(sample.query)}
                  className="font-mono"
                  style={{ fontSize: 11.5, padding: "6px 11px", borderRadius: 2, border: "1px solid var(--carbon)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          )}
        </FigurePanel>

        {messages.length > 0 && (
          <FigurePanel figure="2" title="The conversation" caption={`${messages.length} message(s)`}>
            <div style={{ maxHeight: 620, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
              {messages.map((msg) =>
                msg.sender === "user" ? (
                  <div key={msg.id} style={{ borderLeft: "2px solid var(--signal)", paddingLeft: 14 }}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="mono-label" style={{ color: "var(--signal)" }}>You</span>
                      <span className="font-mono" style={{ fontSize: 10.5, color: "var(--graphite)" }}>{msg.time}</span>
                    </div>
                    <p style={{ margin: "7px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--bone)", whiteSpace: "pre-wrap" }}>
                      {msg.text}
                    </p>
                  </div>
                ) : (
                  <div key={msg.id} style={{ border: "1px solid var(--carbon)", borderRadius: 4, padding: "16px 18px" }}>
                    <div className="flex items-center justify-between gap-4" style={{ paddingBottom: 11, marginBottom: 12, borderBottom: "1px solid var(--carbon)" }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="mono-label">Assistant</span>
                        {msg.model && (
                          <span className="font-mono truncate" style={{ fontSize: 10.5, color: "var(--signal)" }}>{msg.model}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {msg.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="font-mono uppercase"
                            style={{ fontSize: 10, letterSpacing: "0.08em", background: "transparent", border: "none", color: copiedId === msg.id ? "var(--metric)" : "var(--granite)", cursor: "pointer", padding: 0 }}
                          >
                            {copiedId === msg.id ? "Copied" : "Copy"}
                          </button>
                        )}
                        <span className="font-mono" style={{ fontSize: 10.5, color: "var(--graphite)" }}>{msg.time}</span>
                      </div>
                    </div>

                    {msg.status === "running" ? (
                      <div className="flex flex-col gap-3" style={{ padding: "6px 0" }}>
                        <span className="inline-flex items-center gap-2 font-mono" style={{ fontSize: 12, color: "var(--signal)" }}>
                          <span className="astra-pulse" style={{ width: 5, height: 5, borderRadius: 99, background: "var(--signal)" }} />
                          {msg.step || "Working on it…"}
                        </span>
                        <span style={{ display: "block", height: 2, background: "var(--carbon)" }}>
                          <span className="astra-pulse" style={{ display: "block", height: 2, width: "62%", background: "var(--signal)" }} />
                        </span>
                      </div>
                    ) : msg.status === "failed" ? (
                      <div
                        role="alert"
                        style={{ borderLeft: "2px solid var(--alert)", padding: "10px 14px", background: "var(--alert-surface)", borderRadius: 2, fontSize: 13, color: "var(--alert-ink)", whiteSpace: "pre-wrap" }}
                      >
                        {msg.text}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--stone)", whiteSpace: "pre-wrap" }}>
                        {msg.text}
                      </p>
                    )}

                    {msg.status === "completed" && msg.artifacts && msg.artifacts.length > 0 && (
                      <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
                        {msg.artifacts.map((a) => (
                          <button
                            key={a.artifact_id}
                            type="button"
                            onClick={() => onDownloadArtifact(a)}
                            className="inline-flex items-center gap-2 font-mono"
                            style={{ fontSize: 11.5, padding: "7px 11px", borderRadius: 2, border: "1px solid var(--metric)", background: "transparent", color: "var(--metric)", cursor: "pointer" }}
                          >
                            <Download className="w-3 h-3" />
                            <span className="truncate" style={{ maxWidth: 260 }}>{a.filename}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.status === "completed" && (
                      <div className="flex items-center justify-between gap-3" style={{ marginTop: 14, paddingTop: 11, borderTop: "1px solid var(--carbon)" }}>
                        <span style={{ fontSize: 12, color: "var(--graphite)" }}>
                          Want to see every step it took?
                        </span>
                        <button
                          type="button"
                          onClick={() => onSearchSubmit(msg.text)}
                          className="font-mono uppercase"
                          style={{ fontSize: 10, letterSpacing: "0.08em", background: "transparent", border: "none", color: "var(--signal)", cursor: "pointer", padding: 0 }}
                        >
                          Open the full trace →
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
              <div ref={chatBottomRef} />
            </div>
          </FigurePanel>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <FigurePanel figure={String(figNext)} title="Where to go next" caption="four places, in office language">
            <NumberedList
              index={figNext}
              items={[
                { title: "Ask with the full trace", detail: "the technical assistant shows every tool call and file written." },
                { title: "Add documents", detail: `${docCount} indexed so far — anything you add becomes searchable.` },
                { title: "Collect finished files", detail: "every Word document and report a task produced." },
                { title: "Try the sealed sandbox", detail: "run a calculation in a container with no network at all." },
              ]}
            />
            <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
              {([
                ["agent", "Technical assistant"],
                ["knowledge", "Documents"],
                ["outputs", "Finished files"],
                ["sandbox", "Sandbox"],
              ] as const).map(([section, label]) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => onNavigate(section)}
                  className="font-mono uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.08em", padding: "7px 11px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </FigurePanel>

          <FigurePanel figure={String(figNext + 1)} title="Lately" caption="the last few tasks" flush>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th style={{ textAlign: "right" }}>State</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="font-mono" style={{ color: "var(--graphite)" }}>
                      Nothing yet.
                    </td>
                  </tr>
                ) : (
                  recentTasks.map((job) => (
                    <tr key={job.job_id} onClick={() => onNavigate("jobs")} style={{ cursor: "pointer" }}>
                      <td style={{ maxWidth: 230 }}>
                        <span className="block truncate">{job.message}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.08em", color: HOME_TONE[job.status] ?? "var(--graphite)" }}>
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </FigurePanel>
        </div>
      </div>
    </div>
  );
}
