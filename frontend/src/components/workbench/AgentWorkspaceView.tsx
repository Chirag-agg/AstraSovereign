"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Database,
  Cpu,
  Bot,
  Sliders,
  Play,
  Square,
  Paperclip,
  CheckCircle2,
  Clock,
  Terminal,
  Shield,
  Layers,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  AlertCircle,
  Sparkles,
  Wrench,
  FileSpreadsheet,
  FileDown,
  ShieldCheck,
} from "lucide-react";
import Composer, { type AttachmentChip } from "@/components/Composer";
import type { ArtifactSummary, DocumentMeta, Job, JobStatus } from "@/lib/types";
import { listJobFiles, listUserWorkspaceFiles } from "@/lib/api";
import type { JobWorkspaceFile } from "@/lib/api";
import Conversation, { DEMO_TASK } from "@/components/Conversation";
import WorkConsole from "@/components/WorkConsole";

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
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<JobWorkspaceFile[]>([]);
  const [selectedModel, setSelectedModel] = useState("Qwen 2.5 14B");
  const [temperature, setTemperature] = useState(0.7);
  const [contextWindow, setContextWindow] = useState("32,768");
  const [selectedTools, setSelectedTools] = useState({
    document_search: true,
    document_vision: true,
    code_execution: true,
    document_generation: true,
    workspace_fs: true,
  });

  const [promptText, setPromptText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the real files in the active job's workspace (or the user's workspace
  // root when no job is selected).
  useEffect(() => {
    let alive = true;
    if (!activeJobId) {
      setSelectedFile(null);
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

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = promptText.trim();
    if (!text || running) return;
    onSubmitTask(text);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttachFile(file);
      e.target.value = "";
    }
  };

  return (
    <div
      className="flex flex-1 overflow-hidden h-full p-1 sm:p-2 gap-3 bg-transparent min-w-0 min-h-0"
    >
      {/* 1. LEFT PANEL: FILES & RESOURCES (IDE File Explorer) */}
      <div
        className="w-56 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex flex-col overflow-hidden select-none hidden md:flex"
      >
        <div
          className="flex h-12 items-center justify-between px-3.5 border-b border-zinc-100 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase"
        >
          <span>Workspace Files</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-mono">ROOT</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 text-xs space-y-3">
          {!activeJobId ? (
            workspaceFiles.length === 0 ? (
              <p className="px-2 py-2 text-zinc-400">Workspace is empty.</p>
            ) : (
              <>
                <p className="px-2 py-1 text-zinc-500 font-semibold text-[11.5px]">workspaces/{user}</p>
                <div className="space-y-0.5">
                  {workspaceFiles.map((file) => {
                    const isSelected = selectedFile === file.path;
                    const Icon = file.kind === "dir" ? FolderOpen : FileCode;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedFile(file.path)}
                        className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer truncate font-medium text-xs ${
                          isSelected
                            ? "bg-[#ede9fe] text-[#6d28d9] font-bold"
                            : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                        <span className="truncate">{file.path}</span>
                        {file.kind === "file" && file.size !== null ? (
                          <span className="ml-auto text-[10px] text-zinc-400 font-mono">{file.size} B</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </>
            )
          ) : workspaceFiles.length === 0 ? (
            <p className="px-2 py-2 text-zinc-400">This task's workspace has no files yet.</p>
          ) : (
            workspaceFiles.map((file) => {
              const isSelected = selectedFile === file.path;
              const Icon = file.kind === "dir" ? FolderOpen : FileCode;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFile(file.path)}
                  className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer truncate font-medium text-xs ${
                    isSelected
                      ? "bg-[#ede9fe] text-[#6d28d9] font-bold"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  <span className="truncate">{file.path}</span>
                  {file.kind === "file" && file.size !== null ? (
                    <span className="ml-auto text-[10px] text-zinc-400 font-mono">{file.size} B</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. CENTER PANEL: WORKSPACE (Prompt Editor & Execution Output) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)]">
        <div
          className="flex h-12 items-center justify-between px-4 border-b border-slate-200/60 bg-white shrink-0"
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-900">AI Assistant</span>
            {activeJobId && (
              <>
                <span className="text-slate-300">·</span>
                <span className="truncate max-w-[240px] font-mono text-slate-500 font-medium">
                  {activeJob?.job_id || activeJobId}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {onResetSession && activeJobId && (
              <button
                type="button"
                onClick={onResetSession}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer mr-1"
                title="Reset session and start a new task"
              >
                <RefreshCw className="w-3 h-3 text-slate-400" />
                <span>Reset Session</span>
              </button>
            )}

            {running ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#7047eb] border border-purple-200">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7047eb] animate-pulse" />
                Processing
              </span>
            ) : activeJob?.status === "completed" ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Completed
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                Ready
              </span>
            )}
          </div>
        </div>

        {/* Generated deliverables (also shown inline, not just in Deliverables) */}
        {activeJob && activeJob.artifacts && activeJob.artifacts.length > 0 ? (
          <div className="shrink-0 flex flex-wrap gap-2 px-4 py-3 border-b border-zinc-200/80 bg-white">
            {activeJob.artifacts.map((a) => (
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

        {/* Task Editor & Composer */}
        <div
          className="border-b border-zinc-200/80 p-4 bg-white shrink-0 flex flex-col gap-2.5"
        >
          {/* Hidden File Input connected to fileInputRef */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.py,.json,.csv,.xlsx,.pptx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
          />
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Task Prompt &amp; Swarm Instruction</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                Air-Gap Local
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-purple-700 hover:bg-purple-50 border border-slate-200 transition-colors cursor-pointer"
                title="Attach Document or Source Code"
              >
                <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                <span>Attach File</span>
              </button>
              <button
                type="button"
                onClick={() => onSubmitTask(DEMO_TASK)}
                className="text-[#7047eb] hover:text-[#5e38d6] font-semibold cursor-pointer text-xs"
              >
                Try Demo
              </button>
            </div>
          </div>

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
        </div>

        {/* Task Output */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Output
            </span>
            {activeJob?.model && (
              <span className="text-xs font-medium text-slate-400">
                Model: <span className="text-slate-700 font-semibold">{activeJob.model}</span>
              </span>
            )}
          </div>

          {/* Conversation and WorkConsole Integration */}
          <Conversation
            userId={user}
            job={activeJob}
            documents={libraryDocuments}
            onDownload={onDownloadArtifact}
            onSubmit={(text) => {
              setPromptText(text);
              onSubmitTask(text);
            }}
            onCancel={onCancelTask}
            consoleOpen={consoleOpen}
            setConsoleOpen={setConsoleOpen}
            themeKey={themeKey}
          />
        </div>
      </div>

      {/* 3. RIGHT PANEL: QUICK TOOLS (PDF Creation, Output Summary, Table Extraction, Sandbox, Compliance) */}
      <div
        className="w-72 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex flex-col overflow-hidden select-none hidden lg:flex"
      >
        <div
          className="flex h-12 items-center justify-between px-4 border-b border-zinc-100 text-[11px] font-semibold tracking-wider uppercase bg-slate-50/50"
        >
          <div className="flex items-center gap-1.5 font-bold text-zinc-800">
            <Wrench className="w-3.5 h-3.5 text-[#7047eb]" />
            <span>Quick Agent Tools</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-mono font-bold border border-purple-100">
            LOCAL
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 text-xs space-y-3">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            One-click automated tasks executed locally with zero cloud telemetry.
          </p>

          {/* Quick Tool 1: PDF Deliverable Creation */}
          <div className="p-3 rounded-xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50/70 transition-all space-y-2 group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-100 text-[#7047eb]">
                  <FileDown className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">PDF Report Creation</h4>
                  <span className="text-[9.5px] font-mono text-purple-700 font-semibold">AIR-GAP DELIVERABLE</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Compile workspace findings into a structured executive PDF/Word document with formal headers, tables, and sign-offs.
            </p>
            <button
              type="button"
              disabled={running}
              onClick={() =>
                onSubmitTask(
                  "Generate a complete, structured executive deliverable PDF report based on current workspace findings, formatted with clear section headers, metadata, tables, and official clearance sign-off blocks."
                )
              }
              className="w-full py-1.5 px-2.5 rounded-lg bg-[#7047eb] hover:bg-[#5e38d6] disabled:opacity-50 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Generate PDF Report</span>
            </button>
          </div>

          {/* Quick Tool 2: Output Summary */}
          <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/30 hover:bg-amber-50/70 transition-all space-y-2 group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Output Summary</h4>
                  <span className="text-[9.5px] font-mono text-amber-700 font-semibold">EXECUTIVE BRIEF</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Condense outputs, transcripts, and model traces into an actionable bullet-point executive briefing with risk factors.
            </p>
            <button
              type="button"
              disabled={running}
              onClick={() =>
                onSubmitTask(
                  "Analyze the current conversation, document outputs, and execution trace to generate a concise executive summary with bullet points, critical risks, and recommended next steps."
                )
              }
              className="w-full py-1.5 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Summarize Output</span>
            </button>
          </div>

          {/* Quick Tool 3: Table / Ledger Extraction */}
          <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/70 transition-all space-y-2 group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Extract Data Ledger</h4>
                  <span className="text-[9.5px] font-mono text-emerald-700 font-semibold">TABLES & CSV</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Extract numerical tabular data, amounts, and dates from uploaded documents into clean CSV/Excel ledger format.
            </p>
            <button
              type="button"
              disabled={running}
              onClick={() =>
                onSubmitTask(
                  "Extract all tabular and numerical data from the uploaded files into a clean CSV format with columns: Item, Date, Reference ID, Quantity, and Amount."
                )
              }
              className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Extract to CSV</span>
            </button>
          </div>

          {/* Quick Tool 4: Sandbox Code Execution & Audit */}
          <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50/70 transition-all space-y-2 group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Sandbox Code Audit</h4>
                  <span className="text-[9.5px] font-mono text-blue-700 font-semibold">ZERO-EGRESS RUN</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Test untrusted Python snippets inside an isolated rootless container with <code className="font-mono bg-blue-100/60 px-1 py-0.5 rounded text-[10px]">--network none</code>.
            </p>
            <button
              type="button"
              disabled={running}
              onClick={() =>
                onSubmitTask(
                  "Audit and execute the code in the isolated zero-egress Docker sandbox container (--network none) and output stdout, memory consumption, and exit status."
                )
              }
              className="w-full py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span>Run in Sandbox</span>
            </button>
          </div>

          {/* Quick Tool 5: Air-Gap Compliance Check */}
          <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50/70 transition-all space-y-2 group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Compliance Audit</h4>
                  <span className="text-[9.5px] font-mono text-indigo-700 font-semibold">SECURITY HASH</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Verify local model weights, calculate SHA256 integrity hash, and log tamper-evident audit record.
            </p>
            <button
              type="button"
              disabled={running}
              onClick={() =>
                onSubmitTask(
                  "Perform full air-gap security audit: verify 0 bytes egress on transport layer, check model weights hash integrity, and record event into append-only audit trail."
                )
              }
              className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Audit Compliance</span>
            </button>
          </div>

          {/* Air-Gap Policy Card */}
          <div
            className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs space-y-1 shadow-xs"
          >
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>AIR-GAP LOCKDOWN ACTIVE</span>
            </div>
            <div className="text-[10.5px] text-emerald-700">Egress: 0.00 Bytes &bull; Local Host Only</div>
            <div className="text-[10.5px] text-emerald-700">Container: Read-only rootless sandbox</div>
          </div>
        </div>
      </div>
    </div>
  );
}
