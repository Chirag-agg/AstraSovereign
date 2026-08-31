"use client";

import { useCallback, useState } from "react";

import ActiveJobPanel from "@/components/ActiveJobPanel";
import AppShell from "@/components/AppShell";
import ChatPanel from "@/components/ChatPanel";
import DocumentList from "@/components/DocumentList";
import JobList from "@/components/JobList";
import ResourcePanel from "@/components/ResourcePanel";
import SovereigntyStatus from "@/components/SovereigntyStatus";
import UploadPanel from "@/components/UploadPanel";
import UserSelector from "@/components/UserSelector";
import {
  ApiError,
  cancelJob,
  deleteDocument,
  downloadArtifact,
  submitChat,
  uploadDocument,
} from "@/lib/api";
import { useActiveUser, useDocuments, useHealth, useJobs } from "@/lib/hooks";
import type { ArtifactSummary } from "@/lib/types";

const FLAGSHIP_HINT =
  'Try: "Review the inspection report against the maintenance procedure, identify any issues requiring attention, and create an approval note." (Upload the scanned report and the procedure in Documents first.)';

function messageFromError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unexpected error";
}

export default function WorkbenchPage() {
  const [user, setUser] = useActiveUser();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { health, error: healthError } = useHealth();
  const { jobs, error: jobsError } = useJobs(user);
  const { documents, error: docsError } = useDocuments(user);

  const changeUser = useCallback(
    (next: string) => {
      setUser(next);
      setActiveJobId(null);
      setNotice(null);
    },
    [setUser],
  );

  const handleSubmit = useCallback(
    async (message: string) => {
      try {
        const response = await submitChat(user, message);
        setActiveJobId(response.job_id);
        setNotice(null);
      } catch (err) {
        setNotice(`Submit failed: ${messageFromError(err)}`);
      }
    },
    [user],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setNotice(null);
      try {
        await uploadDocument(user, file);
      } catch (err) {
        setNotice(`Upload failed: ${messageFromError(err)}`);
      } finally {
        setUploading(false);
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
      if (!activeJobId) {
        return;
      }
      try {
        const { blob, filename } = await downloadArtifact(user, activeJobId, artifact.artifact_id);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        setNotice(`Download failed: ${messageFromError(err)}`);
      }
    },
    [user, activeJobId],
  );

  const header = (
    <div className="header-inner">
      <h1 className="app-title">Sovereign AI Workbench</h1>
      <span className="app-subtitle">On-premise · air-gapped · local models</span>
      <div className="header-right">
        <UserSelector user={user} onChange={changeUser} />
      </div>
    </div>
  );

  const sidebar = (
    <div className="sidebar-stack">
      <JobList
        jobs={jobs}
        activeJobId={activeJobId}
        onSelect={setActiveJobId}
        onCancel={(jobId) => void handleCancel(jobId)}
      />
      <UploadPanel onUpload={handleUpload} busy={uploading} />
      <DocumentList documents={documents} onDelete={(id) => void handleDeleteDocument(id)} />
    </div>
  );

  const main = (
    <div className="main-stack">
      {notice ? (
        <div className="alert alert-error" role="alert">
          {notice}
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {healthError && !health ? (
        <div className="alert alert-error" role="alert">
          Backend unreachable — retrying… ({healthError})
        </div>
      ) : null}
      {jobsError && !jobs ? (
        <div className="alert alert-error" role="alert">
          Could not load jobs: {jobsError}
        </div>
      ) : null}
      {docsError && !documents ? (
        <div className="alert alert-error" role="alert">
          Could not load documents: {docsError}
        </div>
      ) : null}

      <ChatPanel onSubmit={handleSubmit} disabled={false} hint={FLAGSHIP_HINT} />

      {activeJobId ? (
        <ActiveJobPanel
          key={activeJobId}
          userId={user}
          jobId={activeJobId}
          onDownload={(artifact) => void handleDownload(artifact)}
        />
      ) : (
        <section className="panel empty-state" aria-label="Welcome">
          <div className="panel-title">Workbench</div>
          <p>
            Submit a task to start a job. The agent runs fully on-premise: routing,
            scheduling, tool calls, retrieval, OCR/vision, and document generation
            all happen on this machine.
          </p>
          <ol className="steps">
            <li>Select a development user.</li>
            <li>Upload the scanned report and maintenance procedure under Documents.</li>
            <li>Submit a task (e.g. the approval-note prompt above).</li>
            <li>Watch QUEUED → RUNNING → COMPLETED and the execution trace.</li>
            <li>Download generated files from the job.</li>
          </ol>
        </section>
      )}
    </div>
  );

  const right = (
    <div className="right-stack">
      <SovereigntyStatus health={health} />
      <ResourcePanel health={health} />
    </div>
  );

  return <AppShell header={header} sidebar={sidebar} main={main} right={right} />;
}
