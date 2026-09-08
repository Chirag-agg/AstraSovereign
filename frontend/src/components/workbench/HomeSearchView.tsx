"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import type { DocumentMeta, JobSummary } from "@/lib/types";

interface HomeSearchViewProps {
  onSearchSubmit: (query: string) => void;
  onNavigate: (section: any) => void;
  jobs: JobSummary[] | null;
  documents?: DocumentMeta[] | null;
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

export default function HomeSearchView({
  onSearchSubmit,
  onNavigate,
  jobs,
  documents,
}: HomeSearchViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    onSearchSubmit(query);
  };

  const handleSelectSample = (query: string) => {
    setSearchQuery(query);
    onSearchSubmit(query);
  };

  const docCount = documents ? documents.length : 0;
  const recentTasks = jobs ? jobs.slice(0, 5) : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* ROW 1: Symmetrical Top Grid (2 Columns Left : 1 Column Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          {/* Left 2 Cols: Search & Action Hero */}
          <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  What would you like to work on?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                  Search across your files, query AI models, or instruct an automated assistant task.
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
                    placeholder="Ask a question, search files, or describe a task..."
                    className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pt-2.5 border-t border-slate-200/60">
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!searchQuery.trim()}
                    className="flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-[#7047eb] hover:bg-[#5e38d6] active:bg-[#522ec4] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                    <span>Run Query</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Suggestions */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
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

          {/* Right 1 Col: Key Metrics Stack */}
          <div className="flex flex-col gap-4">
            <div
              onClick={() => onNavigate("knowledge")}
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
                <p className="text-xs text-slate-500 mt-1">Language & vision models</p>
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
          {/* Left 2 Cols: 4 Feature Workbenches */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Workspaces & Tools
                </h2>
                <p className="text-xs text-slate-500">
                  Quick access to collaboration, document intelligence, and deliverables.
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
                    AI Assistant Studio
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Start a task or chat with your agent.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Open Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("coworking")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                  <Users2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Coworking Space
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Collaborate with your team.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#7047eb] pt-1">
                  <span>Enter Coworking</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => onNavigate("documents")}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Document Intelligence & OCR
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Manage your files and knowledge base.
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
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047eb] transition-colors">
                    Deliverables & Reports
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    View generated files and reports.
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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800">
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
                  No tasks launched yet. Query above to start.
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
                        <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-violet-700">
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
                <span>Launch Assistant Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
