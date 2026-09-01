// TypeScript interfaces matching the backend API responses (Phase 1-9).
// These mirror the FastAPI schemas exactly — the frontend never re-derives logic.

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ArtifactStatus = "creating" | "completed" | "failed";

export interface JobSubmitResponse {
  job_id: string;
  status: JobStatus;
}

export interface TraceEntry {
  step: number;
  type: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  result_summary?: string;
  ok?: boolean;
  response_summary?: string;
  error?: string;
  task_type?: string;
  model?: string;
  [key: string]: unknown;
}

export interface ArtifactSummary {
  artifact_id: string;
  filename: string;
  type: string;
  size_bytes: number;
  status: ArtifactStatus;
  created_at: string;
}

export interface Job {
  job_id: string;
  user_id: string;
  message: string;
  task_type: string;
  status: JobStatus;
  priority: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  model?: string | null;
  response?: string | null;
  error?: string | null;
  agent_stage?: string | null;
  iteration_count: number;
  tool_call_count: number;
  execution_trace: TraceEntry[];
  resource_status: string;
  artifacts: ArtifactSummary[];
}

export interface JobSummary {
  job_id: string;
  user_id: string;
  task_type: string;
  status: JobStatus;
  priority: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  model?: string | null;
}

export interface ModelAvailability {
  configured: string;
  available: boolean;
  enabled: boolean;
}

export interface GpuAllocation {
  allocated_vram_mb: number;
  capacity_vram_mb: number;
}

export interface SchedulerStats {
  queued_jobs: number;
  running_jobs: number;
  allocated: {
    cpu_cores: number;
    memory_mb: number;
    gpu: Record<string, GpuAllocation>;
  };
}

export interface DocumentMeta {
  document_id: string;
  filename: string;
  document_type: string;
  status: string;
  chunk_count: number;
  created_at: string;
  error?: string | null;
}

export interface Health {
  status: string;
  service: string;
  ollama: { reachable: boolean; url: string; models?: string[]; error?: string };
  models: Record<string, ModelAvailability>;
  default_model: string;
  queue_size: number;
  jobs: Record<string, number>;
  scheduler: SchedulerStats;
  knowledge_base: {
    documents: number;
    chunks: number;
    embedding: Record<string, unknown>;
    vector_store: string;
  };
  multimodal: {
    status: string;
    ocr: { enabled: boolean; provider: Record<string, unknown> | null };
    vision: {
      model: string | null;
      enabled: boolean;
      available: boolean;
      provider: Record<string, unknown>;
      resources: Record<string, unknown>;
    };
  };
  document_generation: {
    available: boolean;
    word: string;
    artifacts: { artifacts: number; completed: number };
  };
  worker: { state: string; active_job_id: string | null };
}

export const TERMINAL_JOB_STATUSES: JobStatus[] = ["completed", "failed", "cancelled"];

export function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}
