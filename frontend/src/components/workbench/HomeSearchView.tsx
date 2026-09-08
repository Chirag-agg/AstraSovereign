"use client";

import React, { useEffect, useState } from "react";
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
  RefreshCw,
  ExternalLink,
  Bot,
  Zap,
} from "lucide-react";
import { getJob, submitChat } from "@/lib/api";
import Markdown from "@/components/Markdown";
import type { ArtifactSummary, DocumentMeta, Job, JobSummary } from "@/lib/types";

interface HomeSearchViewProps {
  user?: string;
  onNavigate: (section: any) => void;
  jobs: JobSummary[] | null;
  documents?: DocumentMeta[] | null;
  onDownloadArtifact?: (artifact: ArtifactSummary) => void;
  onOpenInStudio?: (jobId: string) => void;
}

const SAMPLE_QUERIES = [
  {
    label: "Summarize Contract",
    query: "Review the uploaded vendor agreement and summarize the key terms, payment milestones, and obligations.",
    badge: "Contracts",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    label: "Review Inspection",
    query: "Analyze the latest inspection report and extract all safety findings and recommended actions.",
    badge: "Inspection",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  {
    label: "Draft Approval Memo",
    query: "Draft a formal approval memo with background context, findings, and recommended decisions.",
    badge: "Memo",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    label: "Compare Invoices",
    query: "Extract billing totals from the attached files and organize them into a clean comparison table.",
    badge: "Finance",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    label: "Explain Policy",
    query: "Search our internal guidelines to explain the compliance requirements for third-party vendors.",
    badge: "Policy",
    badgeColor: "bg-indigo-100 text-indigo-700",
  },
];

export default function HomeSearchView({
  user = "user-001",
  onNavigate,
  jobs,
  documents,
  onDownloadArtifact,
  onOpenInStudio,
}: HomeSearchViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [searching, setSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExecuteSearch = async (text: string) => {
    const q = text.trim();
    if (!q || searching) return;
    setLastQuery(q);
    setSearching(true);
    setActiveJob(null);
    setErrorMsg(null);
    try {
      const submitted = await submitChat(user, q);
      setActiveJobId(submitted.job_id);
    } catch (err) {
      setSearching(false);
      setErrorMsg(err instanceof Error ? err.message : "Failed to start query.");
    }
  };

  // Poll for job completion right on the Home page
  useEffect(() => {
    if (!activeJobId) return;
    let alive = true;
    const poll = async () => {
      try {
        const j = await getJob(user, activeJobId);
        if (!alive) return;
        setActiveJob(j);
        if (j.status === "completed" || j.status === "failed" || j.status === "cancelled") {
          setSearching(false);
          if (j.status === "failed") {
            setErrorMsg(j.error || "The task failed to produce a response.");
          }
        }
      } catch {
        // keep polling
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 1000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [activeJobId, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleExecuteSearch(searchQuery);
  };

  const handleSelectSample = (q: string) => {
    setSearchQuery(q);
    void handleExecuteSearch(q);
  };

  const handleCopy = () => {
    if (activeJob?.response) {
      navigator.clipboard?.writeText(activeJob.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearOutput = () => {
    setActiveJob(null);
    setActiveJobId(null);
    setSearching(false);
    setSearchQuery("");
  };

  const docCount = documents ? documents.length : 0;
  const recentTasks = jobs ? jobs.slice(0, 5) : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* ROW 1: Symmetrical Top Grid (2 Columns Left : 1 Column Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          {/* Left 2 Cols: Search & Action Hero */}
          <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100/80">
                    AstraSovereign
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Air-Gapped Workspace</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  What would you like assistance with today?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                  Search documents, summarize contracts, draft formal deliverables, or ask any operational question.
                </p>
              </div>

              {/* Search & Prompt Box */}
              <form
                onSubmit={handleSubmit}
                className="rounded-xl p-3 sm:p-4 bg-slate-50/80 border border-slate-200 focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10 transition-all space-y-3"
              >
                <div className="flex items-start gap-3">
                  <Search className="w-5 h-5 text-violet-600 shrink-0 mt-1" />
                  <textarea
                    rows={3}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Ask a question, request a document review, or describe a report you need drafted..."
                    className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/60">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>Air-gapped on-premise intelligence • Zero external data egress</span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!searchQuery.trim() || searching}
                    className="flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-[#7047eb] hover:bg-[#5e38d6] active:bg-[#522ec4] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    {searching ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                        <span>Ask Assistant</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Suggestions */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 mr-1">Quick Suggestions:</span>
                {SAMPLE_QUERIES.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => handleSelectSample(sample.query)}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 text-xs text-slate-700 hover:text-violet-900 transition-all shadow-xs cursor-pointer"
                  >
                    <span className="font-semibold">{sample.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sample.badgeColor}`}>
                      {sample.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* DIRECT SEARCH RESULT CARD (Rendered Right on the Home Page) */}
            {(searching || activeJob || errorMsg) && (
              <div className="mt-4 pt-4 border-t border-slate-200/70 space-y-3">
                {/* Result Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-purple-50 text-[#7047eb] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="truncate text-xs font-bold text-slate-800">
                      <span>Result for: </span>
                      <span className="text-slate-600 font-medium italic">&quot;{lastQuery}&quot;</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {searching ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#7047eb] border border-purple-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7047eb] animate-pulse" />
                        Analyzing &amp; Synthesizing
                      </span>
                    ) : activeJob?.status === "completed" ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Completed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Failed
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleClearOutput}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Dismiss output"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Response Body */}
                <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-800 leading-relaxed min-h-[80px]">
                  {searching && !activeJob?.response ? (
                    <div className="flex items-center gap-3 py-6 justify-center text-slate-500">
                      <RefreshCw className="w-5 h-5 text-[#7047eb] animate-spin" />
                      <span>Reviewing local knowledge base and synthesizing answer...</span>
                    </div>
                  ) : errorMsg ? (
                    <div className="text-rose-600 font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  ) : activeJob?.response ? (
                    <div className="space-y-3">
                      <Markdown text={activeJob.response} />

                      {/* Downloadable Artifacts */}
                      {activeJob.artifacts && activeJob.artifacts.length > 0 && (
                        <div className="pt-3 border-t border-slate-200/80 space-y-2">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Generated Deliverables:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {activeJob.artifacts.map((artifact) => (
                              <div
                                key={artifact.artifact_id}
                                className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl border border-purple-200 shadow-xs text-xs"
                              >
                                <FileText className="w-4 h-4 text-[#7047eb]" />
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-800 truncate block max-w-xs">
                                    {artifact.filename}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {(artifact.size_bytes / 1024).toFixed(1)} KB • Word Document
                                  </span>
                                </div>
                                {onDownloadArtifact && (
                                  <button
                                    type="button"
                                    onClick={() => onDownloadArtifact(artifact)}
                                    className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors ml-1"
                                    title="Download Word deliverable"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 py-4 text-center">Processing completed.</div>
                  )}
                </div>

                {/* Output Action Bar */}
                {activeJob?.status === "completed" && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors cursor-pointer shadow-xs"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Answer</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleClearOutput}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors cursor-pointer shadow-xs"
                      >
                        New Search
                      </button>
                    </div>

                    {onOpenInStudio && activeJob?.job_id && (
                      <button
                        type="button"
                        onClick={() => onOpenInStudio(activeJob.job_id)}
                        className="flex items-center gap-1 font-semibold text-[#7047eb] hover:text-[#5e38d6] transition-colors cursor-pointer"
                        title="View execution console and prompt parameters in AI Studio"
                      >
                        <span>Open in AI Studio</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 1 Col: Key Metrics Stack */}
          <div className="flex flex-col gap-4">
            <div
              onClick={() => onNavigate("documents")}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:border-violet-300 transition-colors cursor-pointer flex items-center justify-between flex-1"
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Knowledge Vault
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900">{docCount}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Indexed files and documents</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center text-[#7047eb] shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => onNavigate("models")}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:border-violet-300 transition-colors cursor-pointer flex items-center justify-between flex-1"
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Available Models
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900">4</span>
                  <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                    Ready
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Language &amp; vision models</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-violet-50 flex items-center justify-center text-[#7047eb] shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => onNavigate("settings")}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:border-violet-300 transition-colors cursor-pointer flex items-center justify-between flex-1"
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Security Status
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900">100%</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Protected
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Encrypted on-premise storage</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Feature Workbenches & Recent Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Left 2 Cols: Feature Workbenches */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Workspaces &amp; Tools
                </h2>
                <p className="text-xs text-slate-500">
                  Quick access to technical AI workspaces, document intelligence, and deliverables.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => onNavigate("agent")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center text-[#7047eb] group-hover:scale-105 transition-transform">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    AI Assistant Studio (Technical IDE)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Full engineering workspace with prompt configuration, terminal console, and files.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Open Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("sandbox")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Code Sandbox Runner
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Execute Python in isolated Docker containers with live terminal stream.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Open Sandbox</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("coworking")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                  <Users2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Coworking Space
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Collaborate with team members and route deliverables through L1–L4 authorization sign-offs.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Open Coworking</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("documents")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Documents &amp; Files
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Upload inspection logs, PDFs, and manage organizational knowledge.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>View Documents</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("outputs")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#7047eb] group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Deliverables &amp; Artifacts
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Download completed Word documents, generated memos, and reports.
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
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Recent Tasks
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate("jobs")}
                  className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 cursor-pointer"
                >
                  View All
                </button>
              </div>

              {recentTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No tasks recorded yet. Use the search bar above to ask your first question!
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTasks.map((t) => (
                    <div
                      key={t.job_id}
                      onClick={() => {
                        if (onOpenInStudio) onOpenInStudio(t.job_id);
                        else onNavigate("agent");
                      }}
                      className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-purple-50/40 hover:border-purple-200 transition-colors cursor-pointer text-xs"
                    >
                      <div className="font-semibold text-slate-800 truncate">
                        {t.message || "Untitled task"}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                        <span>{t.status}</span>
                        <span>{t.job_id.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
