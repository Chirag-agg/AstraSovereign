// Typed API client for the Sovereign backend.
// All backend calls go through here — components never scatter raw fetch calls.

import type {
  AuditEvent,
  DocumentMeta,
  Health,
  Job,
  JobStatus,
  JobSubmitResponse,
  JobSummary,
  SovereigntyStatus,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  userId?: string,
): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (userId) {
    headers["X-User-ID"] = userId;
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (typeof options.body === "string") {
      body = options.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Backend unreachable");
  }

  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status})`;
    try {
      const payload = await response.json();
      const detail = payload.detail;
      if (typeof detail === "string" && detail) {
        message = detail;
      } else if (detail && typeof detail === "object") {
        message = detail.message || message;
      }
    } catch {
      // keep the generic message
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function isLocalHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

// --------------------------------------------------------------- health

export function getHealth(): Promise<Health> {
  return request<Health>("/health");
}

// ----------------------------------------------------------------- jobs

export function submitChat(userId: string, message: string): Promise<JobSubmitResponse> {
  return request<JobSubmitResponse>("/api/chat", { method: "POST", body: { message } }, userId);
}

export function getJob(userId: string, jobId: string): Promise<Job> {
  return request<Job>(`/api/jobs/${encodeURIComponent(jobId)}`, {}, userId);
}

export function listJobs(
  userId: string,
  status?: JobStatus,
  limit = 50,
): Promise<JobSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) {
    params.set("status", status);
  }
  return request<JobSummary[]>(`/api/jobs?${params.toString()}`, {}, userId);
}

export function cancelJob(userId: string, jobId: string): Promise<Job> {
  return request<Job>(
    `/api/jobs/${encodeURIComponent(jobId)}`,
    { method: "DELETE" },
    userId,
  );
}

// ------------------------------------------------------------ documents

export function listDocuments(userId: string): Promise<DocumentMeta[]> {
  return request<DocumentMeta[]>("/api/documents", {}, userId);
}

export function uploadDocument(userId: string, file: File): Promise<DocumentMeta> {
  const form = new FormData();
  form.append("file", file);
  return request<DocumentMeta>(
    "/api/documents",
    { method: "POST", body: form },
    userId,
  );
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  await request<unknown>(
    `/api/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
    userId,
  );
}

// ------------------------------------------------------------- artifacts

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

// ------------------------------------------------- audit + sovereignty

export function getSovereignty(): Promise<SovereigntyStatus> {
  return request<SovereigntyStatus>("/api/sovereignty");
}

export function getAudit(
  userId: string,
  jobId?: string,
  limit = 100,
  offset = 0,
): Promise<AuditEvent[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (jobId) {
    params.set("job_id", jobId);
  }
  return request<AuditEvent[]>(`/api/audit?${params.toString()}`, {}, userId);
}

export function getJobAudit(userId: string, jobId: string): Promise<AuditEvent[]> {
  return request<AuditEvent[]>(
    `/api/jobs/${encodeURIComponent(jobId)}/audit`,
    {},
    userId,
  );
}

export async function downloadArtifact(
  userId: string,
  jobId: string,
  artifactId: string,
): Promise<DownloadResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}`,
      { headers: { "X-User-ID": userId }, cache: "no-store" },
    );
  } catch {
    throw new ApiError(0, "Backend unreachable");
  }
  if (!response.ok) {
    let message = `Download failed (HTTP ${response.status})`;
    try {
      const payload = await response.json();
      message = payload.detail?.message || message;
    } catch {
      // keep generic
    }
    throw new ApiError(response.status, message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : "artifact.docx";
  return { blob, filename };
}
