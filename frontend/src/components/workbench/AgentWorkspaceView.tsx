"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  FolderOpen,
  FileCode,
  FileText,
  Terminal,
  CheckCircle2,
  Clock,
  RefreshCw,
  Download,
  AlertCircle,
  Sparkles,
  Wrench,
  FileSpreadsheet,
  FileDown,
  ShieldCheck,
  ChevronRight,
  X,
  Bot,
  Play,
  ArrowRight,
  Layers,
  Cpu,
  Eye,
  ChevronDown,
} from "lucide-react";
import Composer, { type AttachmentChip } from "@/components/Composer";
import type { ArtifactSummary, DocumentMeta, Job, JobStatus } from "@/lib/types";
import { listJobFiles, listUserWorkspaceFiles } from "@/lib/api";
import type { JobWorkspaceFile } from "@/lib/api";
import Conversation, { DEMO_TASK } from "@/components/Conversation";

interface AgentWorkspaceViewProps {
  user: string;
  activeJob: Job | null;
  activeJobId: string | null;
  activeStatus: JobStatus | null;
  running: boolean;
  onSubmitTask: (message: string) => void;
  onCancelTask: () => void;
  onDownloadArtifact: (artifact: ArtifactSummary) => void;
  chips: AttachmentChip[];
  onAttachFile: (file: File) => void;
  onRemoveChip: (id: string) => void;
  libraryDocuments?: DocumentMeta[];
  useAllDocuments?: boolean;
  onToggleUseAllDocuments?: (value: boolean) => void;
  onAttachDocument?: (document: DocumentMeta) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  healthError: string | null;
  onResetSession?: () => void;
  themeKey?: "violet" | "emerald" | "cobalt" | "amber" | "rose" | "dark";
}

const QUICK_ACTIONS = [
  {
    title: "API 653 Tank Assessment",
    badge: "ENGINEERING",
    description: "Review inspection report against maintenance procedure and create formal approval note.",
    prompt: DEMO_TASK,
    icon: FileCheckIcon,
    color: "violet",
  },
  {
    title: "Extract Tabular Ledger",
    badge: "DATA & TABLES",
    description: "Extract measured thickness readings and inspection tables into clean CSV / Excel ledger format.",
    prompt: "Extract all tabular and numerical data from the uploaded files into a clean CSV format with columns: Item, Date, Reference ID, Quantity, and Amount.",
    icon: FileSpreadsheet,
    color: "emerald",
  },
  {
    title: "Executive Approval Note",
    badge: "DELIVERABLE",
    description: "Compile findings into a formal executive Word document with signature blocks and clearance tables.",
    prompt: "Generate a complete, structured executive deliverable PDF/Word report based on current workspace findings, formatted with clear section headers, metadata, tables, and official clearance sign-off blocks.",
    icon: FileDown,
    color: "blue",
  },
  {
    title: "Docker Sandbox Verification",
    badge: "CODE AUDIT",
    description: "Execute Python validation inside isolated container to verify calculations without network egress.",
    prompt: "Execute an isolated Python calculation in the Docker sandbox to verify minimum required thickness and remaining corrosion life.",
    icon: Terminal,
    color: "amber",
  },
];

function FileCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function AgentWorkspaceView({
  user,
  activeJob,
  activeJobId,
  activeStatus,
  running,
  onSubmitTask,
  onCancelTask,
  onDownloadArtifact,
  chips,
  onAttachFile,
  onRemoveChip,
  libraryDocuments = [],
  useAllDocuments = false,
  onToggleUseAllDocuments = () => {},
  onAttachDocument = () => {},
  consoleOpen,
  setConsoleOpen,
  healthError,
  onResetSession,
  themeKey = "violet",
}: AgentWorkspaceViewProps) {
  const [workspaceFiles, setWorkspaceFiles] = useState<JobWorkspaceFile[]>([]);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load workspace files
  useEffect(() => {
    let alive = true;
    if (!activeJobId) {
      listUserWorkspaceFiles(user)
        .then((res) => {
          if (alive) setWorkspaceFiles(res.files);
        })
        .catch(() => {
          if (alive) setWorkspaceFiles([]);
        });
      return;
    }
    listJobFiles(user, activeJobId)
      .then((res) => {
        if (alive) setWorkspaceFiles(res.files);
      })
      .catch(() => {
        if (alive) setWorkspaceFiles([]);
      });
    return () => {
      alive = false;
    };
  }, [activeJobId, user]);

  // Auto-scroll to bottom when active job updates
  useEffect(() => {
    if (activeJob) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeJob?.status, activeJob?.response, activeJob?.execution_trace?.length]);

  const artifacts = activeJob?.artifacts ?? [];

  return (
    <div className="flex flex-col flex-1 h-full w-full min-w-0 min-h-0 bg-[#09090b] text-zinc-100 overflow-hidden relative font-sans">
      {/* 1. TOP CHAT HEADER BAR */}
      <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-zinc-800/80 bg-[#0d0d12]/95 backdrop-blur-md flex items-center justify-between z-10 select-none">
        {/* Left: Chatbot Identity & Session Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-red-600/40 text-red-500 flex items-center justify-center font-bold text-sm shadow-[0_0_12px_rgba(239,68,68,0.2)] shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white truncate">
                Astra Sovereign Assistant
              </h1>
              {activeJobId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-red-400 font-semibold">
                  {activeJob?.job_id || activeJobId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="text-zinc-400 font-medium">Local LLM: Qwen 2.5 Coder</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Air-Gapped Local
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status Badge */}
          {running ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950/50 text-red-300 border border-red-800/60 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Executing...</span>
            </div>
          ) : activeJob?.status === "completed" ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Done</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
              <span>Ready</span>
            </div>
          )}

          {/* Execution Trace Button */}
          <button
            type="button"
            onClick={() => setConsoleOpen(!consoleOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              consoleOpen
                ? "bg-red-600 text-white border-red-600 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                : "bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Toggle Agent Execution Trace"
          >
            <Terminal className="w-4 h-4" />
            <span className="hidden md:inline">Trace</span>
          </button>

          {/* Deliverables Drawer Toggle (if any artifacts exist) */}
          {artifacts.length > 0 && (
            <button
              type="button"
              onClick={() => setFilesDrawerOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-950/50 text-red-200 border border-red-800/80 hover:bg-red-900/60 transition-colors cursor-pointer shadow-sm"
              title="View Generated Deliverables"
            >
              <FileDown className="w-4 h-4 text-red-400" />
              <span>
                {artifacts.length} {artifacts.length === 1 ? "File" : "Files"}
              </span>
            </button>
          )}

          {/* Workspace Files Button */}
          <button
            type="button"
            onClick={() => setFilesDrawerOpen(!filesDrawerOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              filesDrawerOpen
                ? "bg-red-950/60 text-red-200 border-red-800/80"
                : "bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Inspect Workspace Files"
          >
            <FolderOpen className="w-4 h-4 text-zinc-300" />
            <span className="hidden md:inline">Files</span>
            {workspaceFiles.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-200 font-mono font-bold">
                {workspaceFiles.length}
              </span>
            )}
          </button>

          {/* Quick Tools Menu Button */}
          <button
            type="button"
            onClick={() => setToolsDrawerOpen(!toolsDrawerOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              toolsDrawerOpen
                ? "bg-red-950/60 text-red-200 border-red-800/80"
                : "bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Quick Agent Tasks"
          >
            <Sparkles className="w-4 h-4 text-red-400" />
            <span className="hidden md:inline">Prompts</span>
          </button>

          {/* Reset Session / New Chat */}
          {activeJobId && onResetSession && (
            <button
              type="button"
              onClick={onResetSession}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-200 hover:text-white bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Start a new chat session"
            >
              <RefreshCw className="w-4 h-4 text-zinc-400" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. CHAT STREAM / MAIN CONVERSATION CANVAS */}
      <main className="flex-1 overflow-y-auto min-h-0 w-full relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {!activeJob ? (
            /* EMPTY STATE / WELCOME HERO */
            <div className="py-6 sm:py-10 flex flex-col items-center text-center space-y-6 animate-in fade-in duration-300">
              {/* Hero Icon */}
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-800 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                <Sparkles className="w-8 h-8" />
              </div>

              {/* Welcome Titles */}
              <div className="space-y-2 max-w-xl">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  How can Astra Sovereign assist you?
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Your fully air-gapped sovereign AI assistant. Ingest reports, run verified Docker calculations, and generate authoritative Word, Excel, and PowerPoint deliverables on-premise.
                </p>
              </div>

              {/* Quick Suggestion Prompt Cards */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 text-left">
                {QUICK_ACTIONS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSubmitTask(item.prompt)}
                      className="group p-4 rounded-2xl bg-[#111115] border border-zinc-800 hover:border-red-600/60 hover:shadow-[0_4px_20px_rgba(239,68,68,0.15)] transition-all cursor-pointer flex flex-col justify-between space-y-3 text-left"
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-red-950/60 text-red-500 border border-red-900/40 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-zinc-100 block group-hover:text-red-400 transition-colors">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                              {item.badge}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Air-gap Guarantee Pill */}
              <div className="pt-4 flex items-center gap-2 text-xs text-zinc-400 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>100% On-Premise Air-Gapped Inference · Zero External Telemetry · Local Vector Store</span>
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT CONVERSATION */
            <div className="space-y-6">
              <Conversation
                userId={user}
                job={activeJob}
                documents={libraryDocuments}
                onDownload={onDownloadArtifact}
                onSubmit={onSubmitTask}
                onCancel={onCancelTask}
                consoleOpen={consoleOpen}
                setConsoleOpen={setConsoleOpen}
                themeKey={themeKey}
              />
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* 3. DOCKED BOTTOM PROMPT COMPOSER (Chatbot Style) */}
      <footer className="shrink-0 w-full border-t border-zinc-800/80 bg-[#0d0d12]/95 backdrop-blur-md pt-3 pb-4 px-4 sm:px-6 z-10">
        <div className="max-w-4xl mx-auto space-y-2">
          <Composer
            user={user}
            attachments={chips}
            onAttachFile={onAttachFile}
            onRemoveAttachment={onRemoveChip}
            onAttachDocument={onAttachDocument}
            libraryDocuments={libraryDocuments}
            useAllDocuments={useAllDocuments}
            onToggleUseAllDocuments={onToggleUseAllDocuments}
            running={running}
            onSubmit={onSubmitTask}
            onCancel={onCancelTask}
            disabled={Boolean(healthError) && !activeJob}
          />
          <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 select-none">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              Air-Gapped Sovereign AI · Local NVLink Engine
            </span>
            <span>Shift + Enter for new line</span>
          </div>
        </div>
      </footer>

      {/* 4. SLIDE-OVER DRAWER: WORKSPACE FILES */}
      {filesDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-2xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#111115] text-zinc-200 h-full shadow-2xl border-l border-zinc-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between px-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="text-sm font-bold text-white">Workspace Files</h3>
                  <span className="text-[10.5px] text-zinc-400 font-mono">
                    {activeJobId ? `Task: ${activeJobId.slice(0, 8)}` : `User: ${user}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilesDrawerOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Artifacts if completed */}
              {artifacts.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Generated Deliverables
                  </div>
                  <div className="space-y-1.5">
                    {artifacts.map((a) => (
                      <div
                        key={a.artifact_id}
                        className="p-3 rounded-xl border border-red-900/50 bg-red-950/20 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-red-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-white truncate block">{a.filename}</span>
                            <span className="text-[10px] text-red-400 font-mono uppercase">{a.type}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDownloadArtifact(a)}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workspace disk files */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Disk Files &amp; Attachments
                </div>
                {workspaceFiles.length === 0 ? (
                  <div className="p-6 text-center text-zinc-400 bg-zinc-900/50 rounded-xl border border-zinc-800">
                    No files currently staged in this workspace.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {workspaceFiles.map((file) => {
                      const Icon = file.kind === "dir" ? FolderOpen : FileCode;
                      return (
                        <div
                          key={file.path}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="w-4 h-4 text-red-400 shrink-0" />
                            <span className="truncate font-medium text-zinc-300">{file.path}</span>
                          </div>
                          {file.size !== null && (
                            <span className="text-[10.5px] font-mono text-zinc-500 shrink-0 ml-2">
                              {file.size} B
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SLIDE-OVER / MODAL: QUICK PROMPTS */}
      {toolsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-2xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#111115] text-zinc-200 h-full shadow-2xl border-l border-zinc-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between px-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="text-sm font-bold text-white">Automated Prompts</h3>
                  <span className="text-[10.5px] text-zinc-400">One-click engineering templates</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToolsDrawerOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {QUICK_ACTIONS.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-red-600/50 hover:shadow-xs transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-red-950/60 text-red-500 border border-red-900/40">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-white">{action.title}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-red-400 px-2 py-0.5 rounded-full bg-red-950/50 border border-red-900/50 font-mono">
                        {action.badge}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{action.description}</p>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => {
                        setToolsDrawerOpen(false);
                        onSubmitTask(action.prompt);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Run this prompt</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
