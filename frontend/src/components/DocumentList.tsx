"use client";

import type { DocumentMeta } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export default function DocumentList({
  documents,
  onDelete,
}: {
  documents: DocumentMeta[] | null;
  onDelete: (documentId: string) => void;
}) {
  return (
    <section className="panel" aria-label="Documents">
      <div className="panel-title">Documents</div>
      {!documents || documents.length === 0 ? (
        <p className="muted">No documents uploaded for this user.</p>
      ) : (
        <ul className="doc-list">
          {documents.map((doc) => (
            <li key={doc.document_id} className="doc-item">
              <div className="doc-main">
                <div className="doc-name" title={doc.filename}>
                  {doc.filename}
                </div>
                <div className="doc-meta">
                  {doc.document_type} · {doc.chunk_count} chunks ·{" "}
                  {doc.document_id}
                </div>
                {doc.error ? (
                  <div className="alert alert-error" role="alert">
                    {doc.error}
                  </div>
                ) : null}
              </div>
              <StatusBadge value={doc.status} label={doc.status} />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onDelete(doc.document_id)}
                aria-label={`Delete ${doc.filename}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
