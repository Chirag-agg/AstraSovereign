"use client";

import type { ArtifactSummary } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArtifactList({
  artifacts,
  onDownload,
}: {
  artifacts: ArtifactSummary[];
  onDownload: (artifact: ArtifactSummary) => void;
}) {
  if (artifacts.length === 0) {
    return (
      <section className="panel" aria-label="Generated files">
        <div className="panel-title">Generated files</div>
        <p className="muted">No artifacts for this job.</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-label="Generated files">
      <div className="panel-title">Generated files</div>
      <ul className="artifact-list">
        {artifacts.map((artifact) => (
          <li key={artifact.artifact_id} className="artifact-item">
            <div className="artifact-main">
              <div className="artifact-name">{artifact.filename}</div>
              <div className="artifact-meta">
                {artifact.type === "word" ? "Word document" : artifact.type} ·{" "}
                {formatBytes(artifact.size_bytes)}
              </div>
            </div>
            {artifact.status === "completed" ? (
              <button
                type="button"
                className="btn"
                onClick={() => onDownload(artifact)}
                aria-label={`Download ${artifact.filename}`}
              >
                Download
              </button>
            ) : (
              <span className="badge badge-warn">{artifact.status}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
