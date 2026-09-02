"use client";

import type { ArtifactSummary } from "@/lib/types";

export function formatBytes(bytes: number): string {
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

export function artifactTypeLabel(type: string): string {
  if (type === "word") {
    return "Word document";
  }
  return type;
}

export default function ArtifactCard({
  artifact,
  onDownload,
}: {
  artifact: ArtifactSummary;
  onDownload: (artifact: ArtifactSummary) => void;
}) {
  return (
    <div className="artifact-card" role="group" aria-label={`Artifact ${artifact.filename}`}>
      <div className="artifact-icon" aria-hidden="true">
        {artifact.type === "word" ? "W" : "F"}
      </div>
      <div className="artifact-main">
        <div className="artifact-name" title={artifact.filename}>
          {artifact.filename}
        </div>
        <div className="artifact-meta">
          {artifactTypeLabel(artifact.type)} · {formatBytes(artifact.size_bytes)}
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
        <span className="status t-mut">
          <span className="dot" aria-hidden="true" />
          {artifact.status}
        </span>
      )}
    </div>
  );
}
