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

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* ROW 1: Full-Width Intelligent Chatbot Hero (Enlarged to fill full row) */}
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_4px_25px_-2px_rgba(15,23,42,0.04)] flex flex-col space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  What would you like to work on?
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
                  Ask any question, query local files, or request tasks. Answers appear directly below.
                </p>
              </div>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear Chat</span>
                </button>
              )}
            </div>

            {/* Chat & Prompt Box (Enlarged with enhanced typography) */}
            <form
              onSubmit={handleFormSubmit}
              className="rounded-2xl p-4 sm:p-6 bg-slate-50/90 border border-slate-200 focus-within:border-purple-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-purple-500/15 transition-all space-y-4 shadow-2xs"
            >
              <div className="flex items-start gap-3.5">
                <Search className="w-6 h-6 text-[#7047eb] shrink-0 mt-1" />
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
                  placeholder="Ask anything (e.g. 'Summarize our vendor guidelines', 'Calculate pipeline pressure drop', or 'Draft a legal risk assessment')..."
                  className="w-full bg-transparent text-base sm:text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed font-normal"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/70">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs" />
                  <span>Local Air-Gap Engine • Sovereign Enterprise Assistant</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!searchQuery.trim() || Boolean(activeJobId)}
                    className="flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-[#7047eb] hover:bg-[#5e38d6] active:bg-[#522ec4] text-white text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    <Sparkles className="w-4 h-4 text-purple-200" />
                    <span>{activeJobId ? "Assistant Thinking…" : "Ask Assistant"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* Suggestions */}
            {messages.length === 0 && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                <span className="text-xs sm:text-sm font-bold text-slate-500 mr-1">Quick Suggestions:</span>
                {SAMPLE_QUERIES.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => handleSelectSample(sample.query)}
                    className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-xs sm:text-sm text-slate-700 hover:text-purple-900 transition-all shadow-2xs cursor-pointer"
                  >
                    <span className="font-semibold">{sample.label}</span>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${sample.badgeColor}`}>
                      {sample.badge}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* INLINE CHATBOT CONVERSATION THREAD (Enlarged with enhanced readability) */}
          {messages.length > 0 && (
            <div className="pt-5 border-t border-slate-200/80 space-y-5 max-h-[600px] overflow-y-auto pr-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider pb-1">
                <MessageSquare className="w-4 h-4 text-[#7047eb]" />
                <span>Assistant Dialogue</span>
              </div>

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  {msg.sender === "user" ? (
                    <div className="max-w-[85%] rounded-2xl px-5 py-3.5 bg-[#7047eb] text-white text-sm sm:text-base shadow-xs font-medium leading-relaxed">
                      <div className="font-semibold text-xs text-purple-200 mb-1.5 flex items-center justify-between gap-6">
                        <span>You</span>
                        <span>{msg.time}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  ) : (
                    <div className="max-w-[95%] w-full rounded-2xl p-5 sm:p-6 bg-slate-50 border border-slate-200/80 shadow-xs space-y-3">
                      {/* Assistant Header */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#7047eb] to-[#9d7cfc] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                            <Bot className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-slate-900">AstraSovereign Assistant</span>
                          {msg.model && (
                            <span className="text-xs font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                              {msg.model}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {msg.status === "completed" && (
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.text)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}

                          <span className="text-xs text-slate-400">{msg.time}</span>
                        </div>
                      </div>

                      {/* Assistant Body */}
                      {msg.status === "running" ? (
                        <div className="py-5 px-2 space-y-3">
                          <div className="flex items-center gap-3 text-sm text-[#7047eb] font-semibold">
                            <Radio className="w-4 h-4 animate-pulse text-[#7047eb]" />
                            <span>{msg.step || "Analyzing request and compiling response..."}</span>
                          </div>
                          <div className="h-2 w-56 rounded-full bg-purple-100 overflow-hidden">
                            <div className="h-full bg-[#7047eb] rounded-full animate-pulse" style={{ width: "65%" }} />
                          </div>
                        </div>
                      ) : msg.status === "failed" ? (
                        <div className="flex items-start gap-2.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm sm:text-base">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ) : (
                        <div className="text-sm sm:text-base text-slate-800 leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
                          {msg.text}
                        </div>
                      )}

                      {/* Generated deliverables (Download) */}
                      {msg.status === "completed" && msg.artifacts && msg.artifacts.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-3">
                          {msg.artifacts.map((a) => (
                            <div
                              key={a.artifact_id}
                              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="truncate max-w-[220px] font-medium">{a.filename}</span>
                              <span className="text-emerald-600/70">· {a.type}</span>
                              <button
                                type="button"
                                onClick={() => onDownloadArtifact(a)}
                                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Technical IDE Jump Button */}
                      {msg.status === "completed" && (
                        <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-xs text-slate-400 italic">
                            Need low-level traces or code sandbox execution?
                          </span>
                          <button
                            type="button"
                            onClick={() => onSearchSubmit(msg.text)}
                            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7047eb] hover:text-[#5e38d6] hover:underline cursor-pointer"
                          >
                            <span>Open in Technical AI Assistant</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* ROW 2: Feature Workbenches & Recent Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Left 2 Cols: 4 Feature Workbenches */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Workspaces &amp; Tools
                </h2>
                <p className="text-xs text-slate-500">
                  Quick access to collaboration, document intelligence, deliverables, and isolated execution.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => onNavigate("agent")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#7047eb] group-hover:scale-105 transition-transform">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    AI Assistant Studio
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Technical workspace with model configuration and live execution traces.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Open Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("coworking")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                  <Users2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Coworking Space
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Department workflows, authorization levels L1–L4, and deliverable sign-offs.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Enter Coworking</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("sandbox")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Code Sandbox (Docker)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Air-gapped code runner with read-only root and disabled network.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Open Sandbox</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("outputs")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Deliverables &amp; Reports
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    View generated Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) files.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>View Deliverables</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Recent Tasks */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Recent Tasks</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                  {jobs ? jobs.length : 0}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("jobs")}
                className="text-[11px] font-bold text-[#7047eb] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="divide-y divide-slate-50">
              {recentTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  No tasks launched yet. Ask above to start.
                </div>
              ) : (
                recentTasks.map((job) => (
                  <div
                    key={job.job_id}
                    onClick={() => onNavigate("agent")}
                    className="py-2.5 flex items-start gap-2.5 hover:bg-slate-50/80 rounded-xl px-2 transition-colors cursor-pointer group"
                  >
                    <div className="mt-0.5 shrink-0">{statusIcon(job.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-purple-700">
                          {job.message || "Untitled task"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2 uppercase">
                          {job.status}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5">
                        {job.job_id}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onNavigate("agent")}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                <span>Launch Technical Assistant Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
