"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, FileText, FolderOpen, RefreshCw, Sliders, X } from "lucide-react";
import Composer, { type AttachmentChip } from "@/components/Composer";
import type { ArtifactSummary, DocumentMeta, Job, JobStatus } from "@/lib/types";
import { getArtifactPreview, listJobFiles, listUserWorkspaceFiles } from "@/lib/api";
import type { JobWorkspaceFile } from "@/lib/api";
import Conversation from "@/components/Conversation";
import { ModeSwitch, type AskMode } from "@/components/workbench/ModeSwitch";

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
  /** Switch to Home's quick ask from the mode strip. */
  onNavigate?: (section: AskMode) => void;
}

type Panel = "files" | "settings" | null;

/**
 * The assistant workspace.
 *
 * One column for the conversation, with the answer given the most weight.
 * Everything else lives behind a button and opens beside it:
 *
 *   Files    — like the artifacts pane in a chat app. It opens on its own the
 *              first time a task produces files, previews them in place, and
 *              lists the task's working folder underneath.
 *   Settings — model preferences, as a drawer you slide in and out.
 */
export default function AgentWorkspaceView({
  user,
  activeJob,
  activeJobId,
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
  onNavigate,
}: AgentWorkspaceViewProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<JobWorkspaceFile[]>([]);

  const artifacts = activeJob?.artifacts ?? [];
  const realFiles = workspaceFiles.filter((f) => f.kind === "file");
  const fileCount = artifacts.length + realFiles.length;

  // The task's working folder (or the user's root with no task). Refetched
  // when the task finishes, because that is when its files land.
  useEffect(() => {
    let alive = true;
    // `files` is read straight off the response and then indexed, so a reply
    // that omits it used to throw out of render and take the whole workbench
    // down to the error boundary. An empty list is the honest fallback.
    const accept = (res: { files?: JobWorkspaceFile[] } | null | undefined) => {
      if (alive) setWorkspaceFiles(res?.files ?? []);
    };
    const reject = () => {
      if (alive) setWorkspaceFiles([]);
    };
    if (!activeJobId) listUserWorkspaceFiles(user).then(accept).catch(reject);
    else listJobFiles(user, activeJobId).then(accept).catch(reject);
    return () => {
      alive = false;
    };
  }, [activeJobId, user, activeJob?.status]);

  // Open the Files pane by itself once per task, the moment it produces
  // something — the way an artifact appears beside a chat reply.
  const autoOpenedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!activeJob || activeJob.status !== "completed" || artifacts.length === 0) return;
    if (autoOpenedFor.current === activeJob.job_id) return;
    autoOpenedFor.current = activeJob.job_id;
    setPanel("files");
  }, [activeJob, artifacts.length]);

  const toggle = (next: Exclude<Panel, null>) => setPanel((cur) => (cur === next ? null : next));

  return (
    <div className="flex flex-1 overflow-hidden h-full min-w-0 min-h-0 bg-[var(--canvas)]">
      {/* ------------------------------------------------ conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex h-12 shrink-0 items-center justify-between gap-3 px-4"
          style={{ borderBottom: "1px solid var(--carbon)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--bone)" }}>Assistant</span>
            <StatusPill running={running} status={activeJob?.status ?? null} />
            {activeJobId ? (
              <span className="font-mono truncate" style={{ fontSize: 11, color: "var(--graphite)" }}>
                {activeJob?.job_id || activeJobId}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onResetSession && activeJobId ? (
              <HeaderButton onClick={onResetSession} label="New task">
                <RefreshCw className="w-3.5 h-3.5" />
              </HeaderButton>
            ) : null}
            <HeaderButton onClick={() => toggle("files")} label="Files" active={panel === "files"} badge={fileCount}>
              <FolderOpen className="w-3.5 h-3.5" />
            </HeaderButton>
            <HeaderButton onClick={() => toggle("settings")} label="Settings" active={panel === "settings"}>
              <Sliders className="w-3.5 h-3.5" />
            </HeaderButton>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 sm:px-6 pt-4 pb-8 flex flex-col gap-5">
            <div style={{ maxWidth: 820, margin: "0 auto", width: "100%" }}>
              <ModeSwitch current="agent" onSwitch={(mode) => onNavigate?.(mode)} />
            </div>
            <Conversation
              userId={user}
              job={activeJob}
              documents={libraryDocuments}
              onDownload={onDownloadArtifact}
              onSubmit={onSubmitTask}
              onCancel={onCancelTask}
              consoleOpen={consoleOpen}
              setConsoleOpen={setConsoleOpen}
            />
          </div>
        </div>

        {/* Composer at the foot, where a reply box belongs. */}
        <div className="shrink-0 px-4 sm:px-6 py-3" style={{ borderTop: "1px solid var(--carbon)" }}>
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
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
        </div>
      </div>

      {/* ------------------------------------------------ side panels */}
      <aside
        aria-label={panel === "files" ? "Files" : panel === "settings" ? "Settings" : undefined}
        aria-hidden={panel === null}
        className="shrink-0 overflow-hidden"
        style={{
          width: panel === null ? 0 : panel === "files" ? 400 : 300,
          borderLeft: panel === null ? "none" : "1px solid var(--carbon)",
          background: "var(--surface-panel)",
          transition: "width 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {panel === "files" ? (
          <FilesPanel
            user={user}
            job={activeJob}
            artifacts={artifacts}
            workingFiles={realFiles}
            onDownload={onDownloadArtifact}
            onClose={() => setPanel(null)}
          />
        ) : panel === "settings" ? (
          <SettingsPanel onClose={() => setPanel(null)} />
        ) : null}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ header bits */

function StatusPill({ running, status }: { running: boolean; status: JobStatus | null }) {
  const [text, colour] = running
    ? ["Working", "var(--signal)"]
    : status === "completed"
      ? ["Done", "var(--metric)"]
      : status === "failed"
        ? ["Failed", "var(--alert)"]
        : ["Ready", "var(--graphite)"];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono uppercase shrink-0" style={{ fontSize: 10, letterSpacing: "0.1em", color: colour }}>
      <span className={running ? "reasoning-dot is-live" : "reasoning-dot"} style={{ background: colour }} />
      {text}
    </span>
  );
}

function HeaderButton({
  onClick,
  label,
  active = false,
  badge,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: 12.5,
        padding: "5px 10px",
        borderRadius: 4,
        border: `1px solid ${active ? "var(--signal)" : "var(--carbon)"}`,
        background: active ? "color-mix(in srgb, var(--signal) 9%, transparent)" : "transparent",
        color: active ? "var(--bone)" : "var(--stone)",
        cursor: "pointer",
      }}
    >
      {children}
      {label}
      {badge ? (
        <span className="font-mono" style={{ fontSize: 10.5, padding: "0 5px", borderRadius: 99, background: "var(--signal)", color: "#101010" }}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function PanelHeader({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose: () => void }) {
  return (
    <div className="flex h-12 items-center gap-2 px-4 shrink-0" style={{ borderBottom: "1px solid var(--carbon)" }}>
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back to files" className="panel-icon-btn">
          <ArrowLeft className="w-4 h-4" />
        </button>
      ) : null}
      <span className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--bone)" }}>{title}</span>
      <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="panel-icon-btn ml-auto">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ files panel */

function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FilesPanel({
  user,
  job,
  artifacts,
  workingFiles,
  onDownload,
  onClose,
}: {
  user: string;
  job: Job | null;
  artifacts: ArtifactSummary[];
  workingFiles: JobWorkspaceFile[];
  onDownload: (artifact: ArtifactSummary) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<ArtifactSummary | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A different task means a different set of files.
  useEffect(() => setOpen(null), [job?.job_id]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setText(null);
    setError(null);
    getArtifactPreview(user, open.job_id, open.artifact_id)
      .then((res) => alive && setText(res?.text ?? ""))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load a preview."));
    return () => {
      alive = false;
    };
  }, [open, user]);

  if (open) {
    return (
      <div className="flex flex-col h-full" style={{ width: 400 }}>
        <PanelHeader title={open.filename} onBack={() => setOpen(null)} onClose={onClose} />
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--carbon)" }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--graphite)" }}>
            {open.type} · {formatBytes(open.size_bytes)}
          </span>
          <button type="button" onClick={() => onDownload(open)} className="panel-download">
            <Download className="w-3.5 h-3.5" /> Download
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <p className="trace-note">{error}</p>
          ) : text === null ? (
            <p className="trace-note">Loading preview…</p>
          ) : text.trim() === "" ? (
            <p className="trace-note">No text preview for this file. Download it to open it.</p>
          ) : (
            <pre className="panel-preview">{text}</pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ width: 400 }}>
      <PanelHeader title="Files" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <span className="turn-label">Made by this task</span>
          {artifacts.length === 0 ? (
            <p className="panel-empty">
              {job ? "This task has not produced a file." : "Files a task produces — a Word note, a report — appear here, ready to open."}
            </p>
          ) : (
            artifacts.map((a) => (
              <button key={a.artifact_id} type="button" onClick={() => setOpen(a)} className="panel-file">
                <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--signal)" }} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate" style={{ color: "var(--bone)", fontSize: 13.5 }}>{a.filename}</span>
                  <span className="block font-mono" style={{ fontSize: 10.5, color: "var(--graphite)" }}>
                    {a.type} · {formatBytes(a.size_bytes)}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: "var(--granite)" }}>Open</span>
              </button>
            ))
          )}
        </section>

        <section className="flex flex-col gap-2">
          <span className="turn-label">{job ? "Working folder" : "Your workspace"}</span>
          {workingFiles.length === 0 ? (
            <p className="panel-empty">Nothing here yet. Scratch files the agent writes while it works show up here.</p>
          ) : (
            <ul className="flex flex-col" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {workingFiles.map((f) => (
                <li key={f.path} className="flex items-center gap-2 py-1.5" style={{ borderBottom: "1px solid var(--carbon)" }}>
                  <span className="font-mono truncate flex-1" style={{ fontSize: 12, color: "var(--stone)" }}>{f.path}</span>
                  <span className="font-mono shrink-0" style={{ fontSize: 10.5, color: "var(--graphite)" }}>{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- settings panel */

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [model, setModel] = useState("Qwen 2.5 14B");
  const [temperature, setTemperature] = useState(0.7);

  return (
    <div className="flex flex-col h-full" style={{ width: 300 }}>
      <PanelHeader title="Settings" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5" style={{ fontSize: 12.5 }}>
        <label className="flex flex-col gap-1.5">
          <span className="turn-label">Local model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ padding: "7px 9px", fontSize: 12.5 }}>
            <option value="Qwen 2.5 14B">Qwen 2.5 14B (default)</option>
            <option value="Llama 3.1 8B">Llama 3.1 8B (fast)</option>
            <option value="DeepSeek Coder 6.7B">DeepSeek Coder 6.7B</option>
            <option value="Llama 3.2 Vision">Llama 3.2 Vision (OCR)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between">
            <span className="turn-label">Temperature</span>
            <span className="font-mono" style={{ color: "var(--signal)" }}>{temperature}</span>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-[var(--accent)]"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="flex justify-between">
            <span className="turn-label">Context window</span>
            <span className="font-mono" style={{ color: "var(--stone)" }}>32,768</span>
          </span>
          <span style={{ display: "block", height: 3, background: "var(--carbon)" }}>
            <span style={{ display: "block", height: 3, width: "24%", background: "var(--signal)" }} />
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: "var(--graphite)" }}>
          Preferences for this screen. Tasks are routed by the models configured in
          config/models.yaml.
        </p>
      </div>
    </div>
  );
}
