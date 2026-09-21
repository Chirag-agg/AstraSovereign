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
  libraryDocuments: DocumentMeta[];
  useAllDocuments: boolean;
  onToggleUseAllDocuments: (value: boolean) => void;
  onAttachDocument: (document: DocumentMeta) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  healthError: string | null;
  onResetSession?: () => void;
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
  libraryDocuments,
  useAllDocuments,
  onToggleUseAllDocuments,
  onAttachDocument,
  consoleOpen,
  setConsoleOpen,
  healthError,
  onResetSession,
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
      className="flex flex-1 overflow-hidden h-full p-3 sm:p-4 gap-3 bg-[var(--canvas)] min-w-0 min-h-0"
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
                            ? "bg-[var(--accent-light)] text-[var(--accent-strong)] font-bold"
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
                      ? "bg-[var(--accent-light)] text-[var(--accent-strong)] font-bold"
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
                <span className="text-slate-500">·</span>
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
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[var(--accent)] border border-purple-200">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
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
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="font-semibold text-slate-700">Task Prompt</span>
            <button
              type="button"
              onClick={() => onSubmitTask(DEMO_TASK)}
              className="text-[var(--accent)] hover:text-[var(--accent-strong)] font-semibold cursor-pointer"
            >
              Try Demo
            </button>
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
          />
        </div>
      </div>

      {/* 3. RIGHT PANEL: CONFIGURATION (Model, Temp, Context, Tools) */}
      <div
        className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex flex-col overflow-hidden select-none hidden lg:flex"
      >
        <div
          className="flex h-12 items-center justify-between px-4 border-b border-zinc-100 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase"
        >
          <span>Configuration</span>
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs space-y-5">
          {/* Target Model */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
              Local Inference Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 cursor-pointer outline-none focus:border-purple-500 focus:bg-white transition-all shadow-xs"
            >
              <option value="Qwen 2.5 14B">Qwen 2.5 14B (Default)</option>
              <option value="Llama 3.1 8B">Llama 3.1 8B (Fast)</option>
              <option value="DeepSeek Coder 6.7B">DeepSeek Coder 6.7B</option>
              <option value="Llama 3.2 Vision">Llama 3.2 Vision (OCR)</option>
            </select>
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
              <span>Temperature</span>
              <span className="text-[var(--accent)] font-mono font-bold">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-[var(--accent)]"
            />
          </div>

          {/* Context Window */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
              <span>Context Window</span>
              <span className="text-zinc-800 font-mono font-bold">{contextWindow}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: "24%" }} />
            </div>
            <span className="text-[10px] text-zinc-400">4,120 / 32,768 tokens allocated</span>
          </div>

          {/* Local Tools Enabled */}
          <div className="space-y-2 pt-3 border-t border-zinc-100">
            <label className="block text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
              Enabled Local Tools
            </label>
            <div className="space-y-1">
              {Object.entries(selectedTools).map(([tool, enabled]) => (
                <label
                  key={tool}
                  className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      setSelectedTools((prev) => ({ ...prev, [tool]: e.target.checked }))
                    }
                    className="rounded border-zinc-300 accent-[var(--accent)] cursor-pointer"
                  />
                  <span className="text-xs font-medium text-zinc-700">
                    {tool}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Air-Gap Policy */}
          <div
            className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs space-y-1 shadow-xs"
          >
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>AIR-GAP ISOLATION</span>
            </div>
            <div className="text-[11px] text-emerald-700">Network egress: Disabled (Local Only)</div>
            <div className="text-[11px] text-emerald-700">Sandbox: rootless seccomp container</div>
            <div className="text-[11px] text-emerald-700">Memory cap: 1024 MB / task</div>
          </div>
        </div>
      </div>
    </div>
  );
}
