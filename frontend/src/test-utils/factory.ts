// Shared fixtures + fetch mocking helpers for frontend tests.

import { vi } from "vitest";

import type {
  ArtifactSummary,
  AuditEvent,
  DocumentMeta,
  Health,
  Job,
  JobStatus,
  JobSummary,
  TraceEntry,
} from "@/lib/types";

export function installFetch(
  handler: (url: string, init?: RequestInit) => Response,
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function blobResponse(
  content: string,
  filename: string,
  status = 200,
): Response {
  return new Response(content, {
    status,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function healthFixture(overrides: Partial<Health> = {}): Health {
  return {
    status: "ok",
    service: "sovereign-backend",
    ollama: { reachable: true, url: "http://localhost:11434", models: ["llama3.1:latest"] },
    models: {
      general: { configured: "llama3.1:latest", available: true, enabled: true },
      coding: { configured: "llama3:latest", available: true, enabled: true },
      document: { configured: "doc-model", available: false, enabled: false },
      vision: { configured: "llava:7b", available: false, enabled: true },
    },
    default_model: "llama3.1:latest",
    queue_size: 0,
    jobs: { total: 1, queued: 0, running: 0, completed: 1, failed: 0, cancelled: 0 },
    scheduler: {
      queued_jobs: 0,
      running_jobs: 0,
      allocated: {
        cpu_cores: 2,
        memory_mb: 4096,
        gpu: { "GPU-0": { allocated_vram_mb: 8192, capacity_vram_mb: 16384 } },
      },
    },
    knowledge_base: {
      documents: 2,
      chunks: 4,
      embedding: { provider: "ollama", model: "nomic-embed-text" },
      vector_store: "json",
    },
    multimodal: {
      status: "ok",
      ocr: { enabled: true, provider: { provider: "rapidocr" } },
      vision: {
        model: "llava:7b",
        enabled: true,
        available: false,
        provider: { provider: "ollama" },
        resources: {},
      },
    },
    document_generation: { available: true, word: "available", artifacts: { artifacts: 1, completed: 1 } },
    sovereignty: {
      network_policy: "LOCAL_ONLY",
      local_model_calls: 3,
      external_connections: {
        status: "VERIFIED_LOCAL",
        count: 0,
        blocked_attempts: 0,
        local_connections: 5,
      },
      audit_logging: true,
      audit_events: 12,
      sandbox_network: "DISABLED",
      ollama_endpoint: "http://localhost:11434",
    },
    worker: { state: "idle", active_job_id: null },
    ...overrides,
  };
}

export function auditEventFixture(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    event_id: "evt-1",
    timestamp: "2026-09-01T12:00:00Z",
    event_type: "JOB_CREATED",
    component: "job_manager",
    status: "ok",
    job_id: "job-1",
    user_id: "user-001",
    metadata: {},
    ...overrides,
  };
}

export function artifactFixture(overrides: Partial<ArtifactSummary> = {}): ArtifactSummary {
  return {
    artifact_id: "art-1",
    job_id: "job-1",
    filename: "approval_note.docx",
    type: "word",
    size_bytes: 18432,
    status: "completed",
    created_at: "2026-08-31T12:00:00Z",
    ...overrides,
  };
}

export function traceFixture(overrides: Partial<TraceEntry> = {}): TraceEntry {
  return { step: 1, type: "agent_started", task_type: "general", model: "llama3.1:latest", ...overrides };
}

export function jobFixture(overrides: Partial<Job> = {}): Job {
  return {
    job_id: "job-abc",
    user_id: "user-001",
    message: "do the thing",
    task_type: "general",
    status: "queued",
    priority: 0,
    created_at: "2026-08-31T12:00:00Z",
    started_at: null,
    completed_at: null,
    model: "llama3.1:latest",
    response: null,
    error: null,
    agent_stage: null,
    iteration_count: 0,
    tool_call_count: 0,
    execution_trace: [],
    resource_status: "not_required",
    artifacts: [],
    ...overrides,
  };
}

export function jobSummaryFixture(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    job_id: "job-abc",
    user_id: "user-001",
    message: "do the thing",
    task_type: "general",
    status: "queued",
    priority: 0,
    created_at: "2026-08-31T12:00:00Z",
    model: "llama3.1:latest",
    ...overrides,
  };
}

export function documentFixture(overrides: Partial<DocumentMeta> = {}): DocumentMeta {
  return {
    document_id: "doc-1",
    filename: "manual.txt",
    document_type: "txt",
    status: "ready",
    chunk_count: 1,
    created_at: "2026-08-31T12:00:00Z",
    error: null,
    ...overrides,
  };
}

export function flagshipTrace(): TraceEntry[] {
  return [
    traceFixture({ step: 1, type: "agent_started", task_type: "general" }),
    traceFixture({ step: 2, type: "plan", description: "Gather requirements and findings" }),
    traceFixture({ step: 3, type: "tool_call", tool: "document_search", arguments: { query: "pump maintenance", top_k: 3 } }),
    traceFixture({ step: 4, type: "tool_result", tool: "document_search", ok: true, result_summary: "3 relevant chunk(s) from 1 document(s)" }),
    traceFixture({ step: 5, type: "plan", description: "Now analyze the scanned page" }),
    traceFixture({ step: 6, type: "tool_call", tool: "document_vision", arguments: { document_id: "doc-1", pages: [1], question: "findings?" } }),
    traceFixture({ step: 7, type: "tool_result", tool: "document_vision", ok: true, result_summary: "Analyzed 1 page(s) of 'scan.pdf'" }),
    traceFixture({ step: 8, type: "plan", description: "Generate the approval note" }),
    traceFixture({ step: 9, type: "tool_call", tool: "document_generation", arguments: { filename: "approval_note.docx", title: "Approval Note" } }),
    traceFixture({ step: 10, type: "tool_result", tool: "document_generation", ok: true, result_summary: "Generated word artifact 'approval_note.docx' (18432 bytes)" }),
    traceFixture({ step: 11, type: "final", response_summary: "Created approval_note.docx." }),
  ];
}

export function completedJobWithFlagshipTrace(): Job {
  return jobFixture({
    status: "completed",
    agent_stage: "completed",
    iteration_count: 5,
    tool_call_count: 3,
    started_at: "2026-08-31T12:00:00Z",
    completed_at: "2026-08-31T12:00:18Z",
    response:
      "Created approval_note.docx (Word artifact). The inspection is within limits; monitor the seal.",
    execution_trace: flagshipTrace(),
    artifacts: [artifactFixture({ job_id: "job-abc" })],
  });
}

export function runningJobWithDocumentVision(): Job {
  return jobFixture({
    status: "running",
    agent_stage: "tool_call",
    iteration_count: 3,
    tool_call_count: 2,
    started_at: "2026-08-31T12:00:05Z",
    completed_at: null,
    response: null,
    execution_trace: flagshipTrace().slice(0, 6), // ends at tool_call document_vision (no result yet)
  });
}

export function failedJobWithTrace(): Job {
  return jobFixture({
    status: "failed",
    agent_stage: "failed",
    iteration_count: 2,
    tool_call_count: 1,
    error: "vision analysis failed: vision model is not available locally",
    response: null,
    execution_trace: [
      traceFixture({ step: 1, type: "agent_started", task_type: "general" }),
      traceFixture({ step: 2, type: "tool_call", tool: "document_vision", arguments: {} }),
      traceFixture({ step: 3, type: "tool_result", tool: "document_vision", ok: false, result_summary: "vision analysis failed" }),
    ],
  });
}

export function cancelledJobFixture(): Job {
  return jobFixture({ status: "cancelled", agent_stage: "cancelled" });
}

export const statusSequence = (statuses: JobStatus[]) => {
  let index = 0;
  return () => statuses[Math.min(index++, statuses.length - 1)];
};
