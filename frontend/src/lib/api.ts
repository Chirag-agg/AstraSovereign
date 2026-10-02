// Typed API client for the local workbench backend.
// All backend calls go through here â€” components never scatter raw fetch calls.

import type {
  AdminJobDetail,
  AdminJobMeta,
  AdminModelRow,
  AdminOverview,
  AdminResources,
  AdminSystemHealth,
  AdminUserRow,
  ArtifactSummary,
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

// Mirrors the backend's DEMO_MODE: with it on the backend accepts a request
// that carries no session, so the client-side sign-in screen is skipped
// rather than shown for a login that authenticates nothing. Must be set to
// "true" on both sides — this one only decides whether the gate is rendered.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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

export function submitChat(
  userId: string,
  message: string,
  documentIds: string[] = [],
): Promise<JobSubmitResponse> {
  return request<JobSubmitResponse>(
    "/api/chat",
    { method: "POST", body: { message, document_ids: documentIds } },
    userId,
  );
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

export function uploadDocument(
  userId: string,
  file: File,
  documentKind: string = "general",
): Promise<DocumentMeta> {
  const form = new FormData();
  form.append("file", file);
  form.append("document_kind", documentKind);
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

/**
 * Fuzzy-search documents by filename. Used to resolve a document name typed in
 * a chat message (e.g. "summarise report.pdf") to a document_id so the agent
 * receives it as an explicit attachment.  Returns [] on error so callers don't
 * have to guard.
 */
export async function searchDocumentsByName(
  userId: string,
  q: string,
): Promise<DocumentMeta[]> {
  try {
    return await request<DocumentMeta[]>(
      `/api/documents/search-by-name?q=${encodeURIComponent(q)}`,
      {},
      userId,
    );
  } catch {
    return [];
  }
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

export function listArtifacts(userId: string): Promise<ArtifactSummary[]> {
  return request<ArtifactSummary[]>("/api/artifacts", {}, userId);
}

// ------------------------------------------------- development admin (dev-only)

// All /api/admin calls carry the development `X-Role: admin` header. This is a
// DEV-ONLY role switch, NOT production authentication â€” the backend enforces it.

const ADMIN_HEADER = { "X-Role": "admin" };

function adminRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = { ...(options.headers || {}), ...ADMIN_HEADER };
  return request<T>(path, { ...options, headers });
}

export function getAdminOverview(): Promise<AdminOverview> {
  return adminRequest<AdminOverview>("/api/admin/overview");
}

export function getAdminJobs(
  status?: JobStatus,
  limit = 200,
): Promise<AdminJobMeta[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) {
    params.set("status", status);
  }
  return adminRequest<AdminJobMeta[]>(`/api/admin/jobs?${params.toString()}`);
}

export function getAdminJob(jobId: string): Promise<AdminJobDetail> {
  return adminRequest<AdminJobDetail>(`/api/admin/jobs/${encodeURIComponent(jobId)}`);
}

export function getAdminUsers(): Promise<AdminUserRow[]> {
  return adminRequest<AdminUserRow[]>("/api/admin/users");
}

export function getAdminModels(): Promise<AdminModelRow[]> {
  return adminRequest<AdminModelRow[]>("/api/admin/models");
}

export function getAdminResources(): Promise<AdminResources> {
  return adminRequest<AdminResources>("/api/admin/resources");
}

export function getAdminKnowledge(): Promise<{
  documents: number;
  chunks: number;
  embedding: Record<string, unknown>;
  per_user: Record<string, number>;
}> {
  return adminRequest("/api/admin/knowledge");
}

export function getAdminAudit(opts?: {
  userId?: string;
  jobId?: string;
  eventType?: string;
}): Promise<AuditEvent[]> {
  const params = new URLSearchParams();
  if (opts?.userId) {
    params.set("user_id", opts.userId);
  }
  if (opts?.jobId) {
    params.set("job_id", opts.jobId);
  }
  if (opts?.eventType) {
    params.set("event_type", opts.eventType);
  }
  const qs = params.toString();
  return adminRequest<AuditEvent[]>(`/api/admin/audit${qs ? `?${qs}` : ""}`);
}

export function getAdminSovereignty(): Promise<SovereigntyStatus> {
  return adminRequest<SovereigntyStatus>("/api/admin/sovereignty");
}

export function getAdminSystem(): Promise<AdminSystemHealth> {
  return adminRequest<AdminSystemHealth>("/api/admin/system");
}

export async function downloadArtifact(
  userId: string,
  jobId: string,
  artifactId: string,
  fallbackFilename?: string,
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
  // The header names the file exactly; the fallback uses the caller's known
  // filename rather than a hardcoded extension, so a header the browser did not
  // expose cannot silently mislabel the download.
  const filename = match ? match[1] : fallbackFilename || "artifact";
  return { blob, filename };
}

export interface DocumentContentResult {
  document_id: string;
  filename: string;
  document_type: string;
  status: string;
  chunk_count: number;
  has_file: boolean;
  text: string;
  size_bytes: number;
}

export function getDocumentContent(userId: string, documentId: string): Promise<DocumentContentResult> {
  return request<DocumentContentResult>(`/api/documents/${encodeURIComponent(documentId)}/content`, {}, userId);
}

export async function getDocumentFileBlob(
  userId: string,
  documentId: string,
  fallbackFilename?: string,
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/documents/${encodeURIComponent(documentId)}/file`,
      { headers: { "X-User-ID": userId }, cache: "no-store" }
    );
  } catch {
    throw new ApiError(0, "Backend unreachable");
  }
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to load document file");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : fallbackFilename || "document";
  return { blob, filename };
}

export interface ArtifactPreviewResult {
  artifact_id: string;
  filename: string;
  type: string;
  job_id: string;
  size_bytes: number;
  text: string;
}

export function getArtifactPreview(userId: string, jobId: string, artifactId: string): Promise<ArtifactPreviewResult> {
  return request<ArtifactPreviewResult>(`/api/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}/preview`, {}, userId);
}


// -------------------------------------------------------------- cowork

export interface ProjectMeta {
  project_id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFileEntry {
  name: string;
  path: string;
  kind: "dir" | "file";
  size: number | null;
  updated: string | null;
}

export interface ProjectHistory {
  project_id: string;
  messages: { role: "user" | "assistant"; text: string; timestamp?: string }[];
  decisions: { decision: string; reason?: string; timestamp?: string; source_job?: string }[];
  executions: {
    job_id: string;
    timestamp?: string;
    model?: string | null;
    summary?: string;
    files_touched?: string[];
  }[];
  active_task: string;
  project_summary: string;
}

export function listProjects(userId: string): Promise<ProjectMeta[]> {
  return request<ProjectMeta[]>("/api/projects", {}, userId);
}

export function createProject(userId: string, name: string): Promise<ProjectMeta> {
  return request<ProjectMeta>("/api/projects", { method: "POST", body: { name } }, userId);
}

export function deleteProject(userId: string, projectId: string): Promise<void> {
  return request<void>(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" }, userId);
}

export function listProjectFiles(userId: string, projectId: string): Promise<{ entries: ProjectFileEntry[] }> {
  return request(`/api/projects/${encodeURIComponent(projectId)}/files`, {}, userId);
}

export function readProjectFile(userId: string, projectId: string, path: string): Promise<{ path: string; content: string }> {
  const qs = new URLSearchParams({ path });
  return request(`/api/projects/${encodeURIComponent(projectId)}/file?${qs.toString()}`, {}, userId);
}

export function writeProjectFile(userId: string, projectId: string, path: string, content: string): Promise<{ ok: boolean }> {
  return request(
    `/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`,
    { method: "PUT", body: { content } },
    userId,
  );
}

export function coworkChat(userId: string, projectId: string, message: string): Promise<JobSubmitResponse> {
  return request<JobSubmitResponse>("/api/cowork/chat", { method: "POST", body: { project_id: projectId, message } }, userId);
}

export function projectHistory(userId: string, projectId: string): Promise<ProjectHistory> {
  return request<ProjectHistory>(`/api/projects/${encodeURIComponent(projectId)}/history`, {}, userId);
}

export interface SandboxRunResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  timed_out: boolean;
  duration_ms: number;
  error?: string | null;
}

export function runSandboxCode(
  code: string,
  language: string = "python",
  stdin: string = "",
  userId?: string,
): Promise<SandboxRunResult> {
  return request<SandboxRunResult>(
    "/api/sandbox/run",
    {
      method: "POST",
      body: { code, language, stdin },
    },
    userId,
  );
}



export interface JobWorkspaceFile {
  name: string;
  path: string;
  kind: "dir" | "file";
  size: number | null;
}

export function listJobFiles(userId: string, jobId: string): Promise<{ job_id: string; files: JobWorkspaceFile[] }> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}/files`, {}, userId);
}

export function listUserWorkspaceFiles(userId: string): Promise<{ user_id: string; files: JobWorkspaceFile[] }> {
  return request("/api/workspace/files", {}, userId);
}