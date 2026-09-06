"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import Composer, { type AttachmentChip } from "@/components/Composer";
import Conversation, { DEMO_TASK } from "@/components/Conversation";
import Sidebar from "@/components/Sidebar";
import SystemDrawer from "@/components/SystemDrawer";
import { ApiError, cancelJob, deleteDocument, downloadArtifact, submitChat, uploadDocument } from "@/lib/api";
import ThemeToggle from "@/components/core/theme-toggle";
import {
  useActiveUser,
  useArtifacts,
  useDevRole,
  useDocuments,
  useHealth,
  useJob,
  useJobs,
} from "@/lib/hooks";
import type { ArtifactSummary, JobStatus } from "@/lib/types";

function messageFromError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unexpected error";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Polls one job and renders it as a conversation thread. */
function ActiveTask({
  userId,
  jobId,
  onDownload,
  onSubmit,
  onCancel,
  onStatus,
  consoleOpen,
  setConsoleOpen,
}: {
  userId: string;
  jobId: string;
  onDownload: (artifact: ArtifactSummary) => void;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onStatus: (status: JobStatus) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
}) {
  const { job, error } = useJob(userId, jobId);
  useEffect(() => {
    if (job) {
      onStatus(job.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  if (error && !job) {
    return (
      <div className="conversation">
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      </div>
    );
  }
  return (
    <Conversation
      userId={userId}
      job={job}
      onDownload={onDownload}
      onSubmit={onSubmit}
      onCancel={onCancel}
      consoleOpen={consoleOpen}
      setConsoleOpen={setConsoleOpen}
    />
  );
}

export default function WorkbenchPage() {
  const router = useRouter();
  const [user, setUser] = useActiveUser();
  const [devRole, setDevRole] = useDevRole();

  // Landing page follows the development role: admins land in the control plane.
  useEffect(() => {
    if (devRole === "admin") {
      router.replace("/admin");
    }
  }, [devRole, router]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<JobStatus | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [chips, setChips] = useState<AttachmentChip[]>([]);

  const { health, error: healthError } = useHealth();
  const { jobs, error: jobsError } = useJobs(user);
  const { documents, error: docsError } = useDocuments(user);
  const { artifacts, error: artifactsError } = useArtifacts(user);

  const startNew = useCallback(() => {
    setActiveJobId(null);
    setActiveStatus(null);
    setConsoleOpen(false);
    setChips([]);
    setNotice(null);
    setSidebarOpen(false);
  }, []);

  const changeUser = useCallback(
    (next: string) => {
      setUser(next);
      startNew();
    },
    [setUser, startNew],
  );

  const handleSubmit = useCallback(
    async (message: string) => {
      setNotice(null);
      setConsoleOpen(true);
      try {
        const response = await submitChat(user, message);
        setActiveJobId(response.job_id);
        setActiveStatus("queued");
        setChips([]);
      } catch (err) {
        setNotice(`Could not start the task: ${messageFromError(err)}`);
      }
    },
    [user],
  );

  const addAttachment = useCallback(
    async (file: File) => {
      const chipId = `${Date.now()}-${file.name}`;
      setChips((prev) => [...prev, { id: chipId, filename: file.name, state: "uploading" }]);
      try {
        const doc = await uploadDocument(user, file);
        setChips((prev) =>
          prev.map((c) =>
            c.id === chipId ? { ...c, state: doc.status === "ready" ? "ready" : "processing" } : c,
          ),
        );
        if (doc.status === "failed") {
          setNotice(`Document failed to ingest: ${doc.error || "unknown error"}`);
        }
      } catch (err) {
        setChips((prev) => prev.map((c) => (c.id === chipId ? { ...c, state: "failed" } : c)));
        setNotice(`Upload failed: ${messageFromError(err)}`);
      }
    },
    [user],
  );

  const removeAttachment = useCallback((id: string) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleCancel = useCallback(
    async (jobId: string) => {
      try {
        await cancelJob(user, jobId);
      } catch (err) {
        setNotice(`Cancel failed: ${messageFromError(err)}`);
      }
    },
    [user],
  );

  const handleDownload = useCallback(
    async (artifact: ArtifactSummary) => {
      try {
        const { blob, filename } = await downloadArtifact(user, artifact.job_id, artifact.artifact_id);
        triggerDownload(blob, filename);
      } catch (err) {
        setNotice(`Download failed: ${messageFromError(err)}`);
      }
    },
    [user],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument(user, documentId);
      } catch (err) {
        setNotice(`Delete failed: ${messageFromError(err)}`);
      }
    },
    [user],
  );

  const running = activeStatus === "queued" || activeStatus === "running";

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onUserChange={changeUser}
        onNew={startNew}
        jobs={jobs}
        activeJobId={activeJobId}
        onSelectJob={(jobId) => {
          setActiveJobId(jobId);
          setActiveStatus(null);
          setConsoleOpen(false);
          setSidebarOpen(false);
        }}
        onCancelJob={(jobId) => void handleCancel(jobId)}
        documents={documents}
        uploading={chips.some((c) => c.state === "uploading")}
        onUploadDocument={(file) => void addAttachment(file)}
        onDeleteDocument={(id) => void handleDeleteDocument(id)}
        artifacts={artifacts}
        onSelectArtifact={(a) => void handleDownload(a)}
        onOpenSystem={() => setSystemOpen(true)}
      />

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="menu-btn sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">🛡</span>
            Sovereign Workbench
            <small>on-premise · air-gapped · local models</small>
          </div>
          <div className="topbar-spacer" />
          <ThemeToggle />
          <button type="button" className="menu-btn" onClick={() => setSystemOpen(true)}>
            Local
          </button>
          <select
            className="user-select"
            style={{ width: "auto" }}
            aria-label="Development role"
            title="Development-only role (not authentication)"
            value={devRole}
            onChange={(e) => {
              const next = e.target.value === "admin" ? "admin" : "user";
              setDevRole(next);
              router.replace(next === "admin" ? "/admin" : "/");
            }}
          >
            <option value="user">role: user</option>
            <option value="admin">role: admin</option>
          </select>
        </header>        <div className="conversation-scroll">
          {notice ? (
            <div className="banner banner-error" role="alert" style={{ maxWidth: 780, margin: "0 auto 12px" }}>
              <span aria-hidden="true">✕</span>
              <div style={{ flex: 1 }}>{notice}</div>
              <button type="button" className="icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          ) : null}
          {healthError && !health ? (
            <div className="banner banner-error" role="alert" style={{ maxWidth: 780, margin: "0 auto 12px" }}>
              Backend unreachable — retrying… ({healthError})
            </div>
          ) : null}
          {jobsError && !jobs ? (
            <div className="banner banner-error" role="alert" style={{ maxWidth: 780, margin: "0 auto 12px" }}>
              Could not load tasks: {jobsError}
            </div>
          ) : null}

          {activeJobId ? (
            <ActiveTask
              key={activeJobId}
              userId={user}
              jobId={activeJobId}
              onDownload={(artifact) => void handleDownload(artifact)}
              onSubmit={(text) => void handleSubmit(text)}
              onCancel={() => void handleCancel(activeJobId)}
              onStatus={setActiveStatus}
              consoleOpen={consoleOpen}
              setConsoleOpen={setConsoleOpen}
            />
          ) : (
            <Conversation
              userId={user}
              job={null}
              onDownload={() => undefined}
              onSubmit={(text) => void handleSubmit(text)}
              consoleOpen={false}
              setConsoleOpen={() => undefined}
            />
          )}
        </div>

        <div className="composer-wrap">
          <Composer
            user={user}
            attachments={chips}
            onAttachFile={(file) => void addAttachment(file)}
            onRemoveAttachment={removeAttachment}
            running={running}
            onSubmit={(text) => void handleSubmit(text)}
            onCancel={() => activeJobId && void handleCancel(activeJobId)}
            disabled={Boolean(healthError) && !health}
          />
        </div>
      </div>

      <SystemDrawer
        open={systemOpen}
        onClose={() => setSystemOpen(false)}
        health={health}
        error={healthError}
      />
    </div>
  );
}
