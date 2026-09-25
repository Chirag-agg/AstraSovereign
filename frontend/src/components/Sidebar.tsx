"use client";

import { useMemo, useRef } from "react";

import { threadTitle } from "@/lib/console";
import { ACCEPTED_UPLOAD_TYPES, dedupeDocuments } from "@/lib/documents";
import type { ArtifactSummary, DocumentMeta, JobSummary } from "@/lib/types";
import { isTerminalStatus } from "@/lib/types";
import { formatBytes } from "./ArtifactCard";

const STATUS_LABEL: Record<string, string> = {
  queued: "queued",
  running: "running",
  completed: "done",
  failed: "failed",
  cancelled: "cancelled",
};

function sbStatusClass(status: string): string {
  if (status === "completed" || status === "ready") {
    return "t-ok";
  }
  if (status === "running" || status === "processing") {
    return "t-run";
  }
  if (status === "failed" || status === "error") {
    return "t-fail";
  }
  if (status === "cancelled" || status === "rejected") {
    return "t-warn";
  }
  return "t-mut";
}

export default function Sidebar({
  open,
  onClose,
  user,
  onUserChange,
  onNew,
  jobs,
  activeJobId,
  onSelectJob,
  onCancelJob,
  documents,
  uploading,
  onUploadDocument,
  onDeleteDocument,
  artifacts,
  onSelectArtifact,
  onOpenSystem,
}: {
  open: boolean;
  onClose: () => void;
  user: string;
  onUserChange: (user: string) => void;
  onNew: () => void;
  jobs: JobSummary[] | null;
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  documents: DocumentMeta[] | null;
  uploading: boolean;
  onUploadDocument: (file: File) => void;
  onDeleteDocument: (documentId: string) => void;
  artifacts: ArtifactSummary[] | null;
  onSelectArtifact: (artifact: ArtifactSummary) => void;
  onOpenSystem: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickFile = () => inputRef.current?.click();
  const uniqueDocuments = useMemo(() => dedupeDocuments(documents), [documents]);

  return (
    <>
      <aside
        className={open ? "sidebar open" : "sidebar"}
        aria-label="Workspace"
      >
        <div className="sidebar-scroll">
          <button type="button" className="new-btn" onClick={onNew}>
            <span aria-hidden="true">＋</span> New task
          </button>

          {/* chats */}
          <div className="sb-section">
            <div className="sb-head">
              <span>Chats</span>
              <span className="sb-count">{jobs ? jobs.length : ""}</span>
            </div>
            <ul className="sb-list">
              {!jobs || jobs.length === 0 ? (
                <li className="sb-item" aria-hidden="true">
                  <span className="sb-title t-mut">No tasks yet</span>
                </li>
              ) : (
                jobs.map((job) => (
                  <li key={job.job_id} className="sb-row">
                    <button
                      type="button"
                      className={`sb-item ${job.job_id === activeJobId ? "active" : ""}`}
                      onClick={() => onSelectJob(job.job_id)}
                    >
                      <span className="sb-main">
                        <span className="sb-title">{threadTitle(job.message)}</span>
                        <span className="sb-sub">{job.task_type}</span>
                      </span>
                      <span className={`status ${sbStatusClass(job.status)}`}>
                        <span className="dot" aria-hidden="true" />
                        {STATUS_LABEL[job.status] || job.status}
                      </span>
                    </button>
                    {!isTerminalStatus(job.status) ? (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Cancel ${threadTitle(job.message)}`}
                        onClick={() => onCancelJob(job.job_id)}
                        title="Cancel"
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* documents */}
          <div className="sb-section">
            <div className="sb-head">
              <span>Documents</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Upload document"
                onClick={pickFile}
                disabled={uploading}
                title="Upload"
              >
                ＋
              </button>
              <input
                ref={inputRef}
                type="file"
                className="visually-hidden"
                aria-hidden="true"
                tabIndex={-1}
                accept={ACCEPTED_UPLOAD_TYPES}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUploadDocument(file);
                  }
                  e.target.value = "";
                }}
              />
            </div>
            <ul className="sb-list">
              {uniqueDocuments.length === 0 ? (
                <li className="sb-item" aria-hidden="true">
                  <span className="sb-title t-mut">
                    {uploading ? "Uploading…" : "No documents"}
                  </span>
                </li>
              ) : (
                uniqueDocuments.map((doc) => (
                  <li key={doc.document_id} className="sb-row">
                    <div className="sb-item">
                      <span className="sb-main">
                        <span className="sb-title">{doc.filename}</span>
                        <span className="sb-sub">
                          {doc.document_type}
                          {doc.error ? ` · ${doc.error}` : ""}
                        </span>
                      </span>
                      <span className={`status ${sbStatusClass(doc.status)}`}>
                        <span className="dot" aria-hidden="true" />
                        {doc.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${doc.filename}`}
                      onClick={() => onDeleteDocument(doc.document_id)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* artifacts */}
          <div className="sb-section">
            <div className="sb-head">
              <span>Artifacts</span>
              <span className="sb-count">{artifacts ? artifacts.length : ""}</span>
            </div>
            <ul className="sb-list">
              {!artifacts || artifacts.length === 0 ? (
                <li className="sb-item" aria-hidden="true">
                  <span className="sb-title t-mut">No generated files</span>
                </li>
              ) : (
                artifacts.map((artifact) => (
                  <li key={artifact.artifact_id}>
                    <button
                      type="button"
                      className="sb-item"
                      onClick={() => onSelectArtifact(artifact)}
                      aria-label={`Download ${artifact.filename}`}
                    >
                      <span className="sb-main">
                        <span className="sb-title">{artifact.filename}</span>
                        <span className="sb-sub">
                          {artifact.type === "word" ? "Word" : artifact.type} ·{" "}
                          {formatBytes(artifact.size_bytes)}
                        </span>
                      </span>
                      <span className="sb-status">↓</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* local & privacy */}
          <div className="sb-section">
            <div className="sb-head">
              <span>Local</span>
            </div>
            <ul className="sb-list">
              <li>
                <button type="button" className="sb-item" onClick={onOpenSystem}>
                  <span className="sb-main">
                    <span className="sb-title">Local &amp; privacy</span>
                    <span className="sb-sub">how your work stays on this machine</span>
                  </span>
                  <span className="sb-status">›</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="sidebar-footer">
          <select
            className="user-select"
            aria-label="Active user"
            value={user}
            onChange={(e) => onUserChange(e.target.value)}
          >
            <option value="user-001">user-001</option>
            <option value="user-002">user-002</option>
            <option value="user-003">user-003</option>
            <option value="user-004">user-004</option>
            <option value="user-005">user-005</option>
          </select>
          <button type="button" className="local-pill" onClick={onOpenSystem}>
            <span className="dot" aria-hidden="true" />
            LOCAL
          </button>
        </div>
      </aside>
      {open ? (
        <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={onClose} />
      ) : null}
    </>
  );
}
