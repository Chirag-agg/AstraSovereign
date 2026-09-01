"use client";

import { useJobAudit } from "@/lib/hooks";
import type { AuditEvent } from "@/lib/types";

// Friendly labels for audit event types so the timeline reads clearly.

const LABELS: Record<string, string> = {
  JOB_CREATED: "Job created",
  JOB_STARTED: "Job started",
  JOB_COMPLETED: "Job completed",
  JOB_FAILED: "Job failed",
  MODEL_SELECTED: "Model selected",
  MODEL_CALL_STARTED: "Local inference",
  MODEL_CALL_COMPLETED: "Local inference done",
  TOOL_CALL_STARTED: "Tool call",
  TOOL_CALL_COMPLETED: "Tool result",
  DOCUMENT_INGESTION_STARTED: "Document ingestion",
  DOCUMENT_INGESTION_COMPLETED: "Document ingested",
  DOCUMENT_SEARCH_STARTED: "document_search",
  DOCUMENT_SEARCH_COMPLETED: "document_search done",
  OCR_STARTED: "OCR",
  OCR_COMPLETED: "OCR done",
  VISION_STARTED: "document_vision",
  VISION_COMPLETED: "document_vision done",
  SANDBOX_STARTED: "code_execution",
  SANDBOX_COMPLETED: "code_execution done",
  DOCUMENT_GENERATION_STARTED: "document_generation",
  DOCUMENT_GENERATION_COMPLETED: "document_generation done",
  RESOURCE_ALLOCATED: "Resource allocated",
  RESOURCE_RELEASED: "Resource released",
};

function label(event: AuditEvent): string {
  return LABELS[event.event_type] || event.event_type;
}

function shortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Renders the backend audit timeline for a job (user-scoped, non-sensitive). */
export default function JobAuditTimeline({
  userId,
  jobId,
  terminal,
}: {
  userId: string;
  jobId: string;
  terminal: boolean;
}) {
  const { events, error } = useJobAudit(userId, jobId, terminal);

  if (error) {
    return (
      <section className="panel" aria-label="Audit trail">
        <div className="panel-title">Audit trail</div>
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      </section>
    );
  }
  if (!events || events.length === 0) {
    return (
      <section className="panel" aria-label="Audit trail">
        <div className="panel-title">Audit trail</div>
        <p className="muted">No audit events yet.</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-label="Audit trail">
      <div className="panel-title">Audit trail</div>
      <ol className="trace-list">
        {events.map((event) => (
          <li key={event.event_id} className="trace-entry">
            <span className="trace-marker" aria-hidden="true">
              •
            </span>
            <div className="trace-body">
              <div className="trace-label">{label(event)}</div>
              <div className="trace-detail">
                {event.component} · {event.status} · {shortTime(event.timestamp)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
