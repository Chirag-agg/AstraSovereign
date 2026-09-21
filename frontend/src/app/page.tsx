"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

import Sidebar from "@/components/workbench/Sidebar";
import TopBar from "@/components/workbench/TopBar";
import CommandCenter from "@/components/workbench/CommandCenter";
import CoworkingView from "@/components/workbench/CoworkingView";
import JobsView from "@/components/workbench/JobsView";
import AgentWorkspaceView from "@/components/workbench/AgentWorkspaceView";
import ModelsView from "@/components/workbench/ModelsView";
import ToolsView from "@/components/workbench/ToolsView";
import WorkflowsView from "@/components/workbench/WorkflowsView";
import KnowledgeBaseView from "@/components/workbench/KnowledgeBaseView";
import FilesView from "@/components/workbench/FilesView";
import OutputsView from "@/components/workbench/OutputsView";
import ComputeView from "@/components/workbench/ComputeView";
import MonitoringView from "@/components/workbench/MonitoringView";
import AuditLogsView from "@/components/workbench/AuditLogsView";
import TeamView from "@/components/workbench/TeamView";
import SecurityConsoleView from "@/components/workbench/SecurityConsoleView";
import SandboxView from "@/components/workbench/SandboxView";
import CommandPalette from "@/components/workbench/CommandPalette";
import HomeSearchView from "@/components/workbench/HomeSearchView";
import SystemDrawer from "@/components/SystemDrawer";
import Login from "@/components/Login";
import LandingPage from "@/components/LandingPage";
import { BootCurtain } from "@/components/ui/terminal-loader";

import {
  ApiError,
  cancelJob,
  deleteDocument,
  downloadArtifact,
  submitChat,
  uploadDocument,
} from "@/lib/api";
import {
  useActiveUser,
  useArtifacts,
  useDevRole,
  useDocuments,
  useHealth,
  useJob,
  useJobs,
} from "@/lib/hooks";
import type { ArtifactSummary, DocumentMeta, JobStatus } from "@/lib/types";
import type { AttachmentChip } from "@/components/Composer";
import type { WorkbenchSection } from "@/components/workbench/types";

function messageFromError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
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

/** Active Task runner that polls the selected job */
function ActiveAgentWorkspace({
  userId,
  activeJobId,
  onDownload,
  onSubmit,
  onCancel,
  onStatus,
  chips,
  onAttachFile,
  onRemoveChip,
  documents,
  useAllDocuments,
  onToggleUseAllDocuments,
  onAttachDocument,
  consoleOpen,
  setConsoleOpen,
  running,
  healthError,
  onResetSession,
}: {
  userId: string;
  activeJobId: string;
  onDownload: (artifact: ArtifactSummary) => void;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onStatus: (status: JobStatus) => void;
  chips: AttachmentChip[];
  onAttachFile: (file: File) => void;
  onRemoveChip: (id: string) => void;
  documents: DocumentMeta[];
  useAllDocuments: boolean;
  onToggleUseAllDocuments: (value: boolean) => void;
  onAttachDocument: (document: DocumentMeta) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  running: boolean;
  healthError: string | null;
  onResetSession?: () => void;
}) {
  const { job, error } = useJob(userId, activeJobId);

  useEffect(() => {
    if (job) {
      onStatus(job.status);
    }
  }, [job?.status, onStatus]);

  return (
    <AgentWorkspaceView
      user={userId}
      activeJob={job}
      activeJobId={activeJobId}
      activeStatus={job?.status ?? null}
      running={running}
      onSubmitTask={onSubmit}
      onCancelTask={onCancel}
      onDownloadArtifact={onDownload}
      chips={chips}
      onAttachFile={onAttachFile}
      onRemoveChip={onRemoveChip}
      libraryDocuments={documents}
      useAllDocuments={useAllDocuments}
      onToggleUseAllDocuments={onToggleUseAllDocuments}
      onAttachDocument={onAttachDocument}
      consoleOpen={consoleOpen}
      setConsoleOpen={setConsoleOpen}
      healthError={healthError || error}
      onResetSession={onResetSession}
    />
  );
}

function WorkbenchWorkspace({ onSignOut }: { onSignOut: () => void }) {
  const router = useRouter();
  const [user, setUser] = useActiveUser();
  const [devRole, setDevRole] = useDevRole();

  // Admin users have full access to the Sovereign workbench with AI Assistant, Sandbox, and Team management.

  const [currentSection, setCurrentSection] = useState<WorkbenchSection>(
    typeof process !== "undefined" && process.env.NODE_ENV === "test" ? "agent" : "home"
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        return window.sessionStorage.getItem("sovereign.active-job-id") || null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [activeStatus, setActiveStatus] = useState<JobStatus | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [chips, setChips] = useState<AttachmentChip[]>([]);
  const [useAllDocuments, setUseAllDocuments] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // Switching users must reset any in-flight/selected job (no cross-user leakage).
  useEffect(() => {
    setActiveJobId(null);
    setActiveStatus(null);
    setConsoleOpen(false);
  }, [user]);

  // Sync active job to sessionStorage
  useEffect(() => {
    try {
      if (activeJobId) {
        window.sessionStorage.setItem("sovereign.active-job-id", activeJobId);
      } else {
        window.sessionStorage.removeItem("sovereign.active-job-id");
      }
    } catch {
      // ignore
    }
  }, [activeJobId]);

  const { health, error: healthError } = useHealth();
  const { jobs, error: jobsError } = useJobs(user);
  const { documents, error: docsError } = useDocuments(user);
  const { artifacts, error: artifactsError } = useArtifacts(user);

  // The workbench is dark, full stop. A light variant would need its own pass
  // over the document surfaces and the console, and half a theme is worse than
  // one. Any stale "light" left in localStorage by an older build is cleared.
  useEffect(() => {
    setTheme("dark");
    document.documentElement.dataset.theme = "dark";
    try {
      window.localStorage.removeItem("sovereign.theme");
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Intentionally inert: kept so the existing call sites and the toggle's
    // props stay valid while there is only one theme.
  }, []);

  const startNew = useCallback(() => {
    setActiveJobId(null);
    setActiveStatus(null);
    try {
      window.sessionStorage.removeItem("sovereign.active-job-id");
    } catch {
      // ignore
    }
    setConsoleOpen(false);
    setChips([]);
    setNotice(null);
    setSidebarOpen(false);
    setCurrentSection("agent");
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
      setCurrentSection("agent");
      // Attachments are explicit: either the ready documents chosen in the
      // composer, or (with the toggle) every ready document in the library.
      const readyDocuments = (documents ?? []).filter((doc) => doc.status === "ready");
      const selected = useAllDocuments
        ? readyDocuments.map((doc) => doc.document_id)
        : chips
            .filter((chip) => chip.documentId && chip.state === "ready")
            .map((chip) => chip.documentId as string);
      const documentIds = Array.from(new Set(selected));
      try {
        const response = await submitChat(user, message, documentIds);
        setActiveJobId(response.job_id);
        setActiveStatus("queued");
        setChips([]);
        setUseAllDocuments(false);
      } catch (err) {
        setNotice(`Could not start the task: ${messageFromError(err)}`);
      }
    },
    [user, documents, chips, useAllDocuments],
  );

  const addAttachment = useCallback(
    async (file: File) => {
      const chipId = `${Date.now()}-${file.name}`;
      setChips((prev) => [...prev, { id: chipId, filename: file.name, state: "uploading" }]);
      try {
        const doc = await uploadDocument(user, file);
        setChips((prev) =>
          prev.map((c) =>
            c.id === chipId
              ? {
                  ...c,
                  state: doc.status === "ready" ? "ready" : "processing",
                  documentId: doc.document_id,
                }
              : c,
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

  const attachDocument = useCallback(
    (document: DocumentMeta) => {
      setChips((prev) => {
        if (prev.some((chip) => chip.documentId === document.document_id)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `doc-${document.document_id}`,
            filename: document.filename,
            state: document.status === "ready" ? "ready" : "processing",
            documentId: document.document_id,
          },
        ];
      });
    },
    [],
  );

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
    <div
      className="flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--bone)]"
    >
      {/* 1. Left Navigation Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={(sec) => setCurrentSection(sec)}
        onNewJob={startNew}
        jobs={jobs}
        activeJobId={activeJobId}
        onSelectJob={(jobId) => {
          setActiveJobId(jobId);
          setActiveStatus(null);
          setCurrentSection("agent");
          setSidebarOpen(false);
        }}
        documents={documents}
        isOpenMobile={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        user={user}
        onSignOut={onSignOut}
      />

      {/* 2. Main Workbench Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Bar */}
        <TopBar
          onOpenMobileNav={() => setSidebarOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onSelectSection={(sec) => setCurrentSection(sec)}
          onNewJob={startNew}
          onOpenSystem={() => setSystemOpen(true)}
          user={user}
          onUserChange={changeUser}
          devRole={devRole}
          onDevRoleChange={(next) => {
            setDevRole(next);
            router.replace(next === "admin" ? "/admin" : "/");
          }}
          onSignOut={onSignOut}
          theme={theme}
          onToggleTheme={toggleTheme}
          currentSection={currentSection}
        />

        {/* System Error Banners */}
        {notice && (
          <div
            className="flex items-center justify-between px-4 py-2.5 text-sm border-l-4 border-rose-400 bg-rose-50 text-rose-800 rounded-r-lg mx-3 mt-2"
            role="alert"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-rose-400 hover:text-rose-600 cursor-pointer px-2 rounded-lg hover:bg-rose-100 transition-colors"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {healthError && !health && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 text-sm border-l-4 border-amber-400 bg-amber-50 text-amber-800 rounded-r-lg mx-3 mt-2"
            role="alert"
          >
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Backend unreachable — retrying… ({healthError})
          </div>
        )}

        {jobsError && !jobs && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 text-sm border-l-4 border-amber-400 bg-amber-50 text-amber-800 rounded-r-lg mx-3 mt-2"
            role="alert"
          >
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Could not load tasks: {jobsError}
          </div>
        )}

        {/* Active Viewport — persistent mounting to preserve view and sub-view states across tab switches */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          <div
            style={{
              display: currentSection === "home" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <HomeSearchView
              onSearchSubmit={(query) => {
                void handleSubmit(query);
              }}
              onNavigate={(sec) => setCurrentSection(sec)}
              jobs={jobs}
              documents={documents}
              onDownloadArtifact={(a) => void handleDownload(a)}
            />
          </div>

          <div
            style={{
              display: currentSection === "coworking" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <CoworkingView
              onOpenAgentWorkspace={(taskPrompt) => {
                if (taskPrompt) {
                  void handleSubmit(taskPrompt);
                } else {
                  setCurrentSection("agent");
                }
              }}
            />
          </div>

          <div
            style={{
              display: currentSection === "dashboard" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <CommandCenter
              onNewJob={startNew}
              onSelectJob={(id) => {
                setActiveJobId(id);
                setCurrentSection("agent");
              }}
              onNavigate={(sec) => setCurrentSection(sec)}
              jobs={jobs}
            />
          </div>

          <div
            style={{
              display: currentSection === "jobs" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <JobsView
              jobs={jobs}
              onSelectJob={(id) => {
                setActiveJobId(id);
                setCurrentSection("agent");
              }}
              onNewJob={startNew}
            />
          </div>

          {/* Agent Workspace: Always mounted in DOM so state, logs, and inputs persist */}
          <div
            style={{
              display: currentSection === "agent" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            {activeJobId ? (
              <ActiveAgentWorkspace
                key={activeJobId}
                userId={user}
                activeJobId={activeJobId}
                onDownload={(artifact) => void handleDownload(artifact)}
                onSubmit={(text) => void handleSubmit(text)}
                onCancel={() => void handleCancel(activeJobId)}
                onStatus={setActiveStatus}
                chips={chips}
                onAttachFile={(file) => void addAttachment(file)}
                onRemoveChip={removeAttachment}
                documents={documents ?? []}
                useAllDocuments={useAllDocuments}
                onToggleUseAllDocuments={setUseAllDocuments}
                onAttachDocument={attachDocument}
                consoleOpen={consoleOpen}
                setConsoleOpen={setConsoleOpen}
                running={running}
                healthError={healthError}
                onResetSession={startNew}
              />
            ) : (
              <AgentWorkspaceView
                user={user}
                activeJob={null}
                activeJobId={null}
                activeStatus={null}
                running={false}
                onSubmitTask={(text) => void handleSubmit(text)}
                onCancelTask={() => undefined}
                onDownloadArtifact={() => undefined}
                chips={chips}
                onAttachFile={(file) => void addAttachment(file)}
                onRemoveChip={removeAttachment}
                libraryDocuments={documents ?? []}
                useAllDocuments={useAllDocuments}
                onToggleUseAllDocuments={setUseAllDocuments}
                onAttachDocument={attachDocument}
                consoleOpen={false}
                setConsoleOpen={() => undefined}
                healthError={healthError}
                onResetSession={startNew}
              />
            )}
          </div>

          <div
            style={{
              display: currentSection === "models" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <ModelsView />
          </div>

          <div
            style={{
              display: currentSection === "tools" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <ToolsView />
          </div>

          <div
            style={{
              display: currentSection === "workflows" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <WorkflowsView />
          </div>

          <div
            style={{
              display:
                currentSection === "knowledge" || currentSection === "documents"
                  ? "flex"
                  : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <KnowledgeBaseView
              documents={documents}
              onUploadDocument={(file) => void addAttachment(file)}
              onDeleteDocument={(id) => void handleDeleteDocument(id)}
              uploading={chips.some((c) => c.state === "uploading")}
            />
          </div>

          <div
            style={{
              display: currentSection === "files" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <FilesView />
          </div>

          <div
            style={{
              display: currentSection === "outputs" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <OutputsView
              artifacts={artifacts}
              onDownloadArtifact={(a) => void handleDownload(a)}
            />
          </div>

          <div
            style={{
              display: currentSection === "compute" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <ComputeView />
          </div>

          <div
            style={{
              display: currentSection === "monitoring" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <MonitoringView />
          </div>

          <div
            style={{
              display: currentSection === "audit" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <AuditLogsView />
          </div>

          <div
            style={{
              display: currentSection === "team" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <TeamView user={user} devRole={devRole} />
          </div>

          <div
            style={{
              display: currentSection === "sandbox" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <SandboxView user={user} />
          </div>

          <div
            style={{
              display: currentSection === "settings" ? "flex" : "none",
              height: "100%",
              width: "100%",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <SecurityConsoleView />
          </div>
        </main>
      </div>

      {/* Local System and Privacy Drawer */}
      <SystemDrawer
        open={systemOpen}
        onClose={() => setSystemOpen(false)}
        health={health}
        error={healthError}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectSection={(sec) => setCurrentSection(sec)}
        onNewJob={startNew}
      />
    </div>
  );
}

export default function WorkbenchPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  // The boot curtain lifts when the client has actually hydrated and read the
  // session — not on a timer. A loader that outlives the work it describes is
  // theatre, and this product does not get to do theatre.
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    try {
      setAuthed(window.sessionStorage.getItem("sovereign.session") === "1");
    } catch {
      setAuthed(false);
    } finally {
      setBooted(true);
    }
  }, []);

  if (!booted) {
    return <BootCurtain done={false} />;
  }

  if (!authed) {
    if (showLogin) {
      return (
        <Login
          onBack={() => setShowLogin(false)}
          onAuthenticated={(role) => {
            setAuthed(true);
            // Admin remains inside the full Sovereign Workbench with full AI Assistant, Sandbox, and Admin tools!
          }}
        />
      );
    }

    return <LandingPage onEnter={() => setShowLogin(true)} />;
  }

  const signOut = () => {
    try {
      window.sessionStorage.removeItem("sovereign.session");
    } catch {
      // ignore
    }
    setAuthed(false);
    setShowLogin(false);
  };

  return <WorkbenchWorkspace onSignOut={signOut} />;
}
