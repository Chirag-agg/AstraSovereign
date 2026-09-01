import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  cancelJob,
  deleteDocument,
  downloadArtifact,
  getHealth,
  getJob,
  isLocalHost,
  listJobs,
  submitChat,
  uploadDocument,
} from "./api";
import {
  blobResponse,
  installFetch,
  jsonResponse,
  documentFixture,
  healthFixture,
  jobFixture,
} from "@/test-utils/factory";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("submits a chat with the X-User-ID header and returns the job id", async () => {
    const fetchMock = installFetch((url, init) => {
      expect(url).toBe("http://localhost:8000/api/chat");
      expect(init?.headers).toMatchObject({ "X-User-ID": "user-001" });
      expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
      expect(JSON.parse(String(init?.body))).toEqual({ message: "hello" });
      return jsonResponse({ job_id: "job-1", status: "queued" }, 202);
    });

    const result = await submitChat("user-001", "hello");
    expect(result).toEqual({ job_id: "job-1", status: "queued" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches a job with the user header", async () => {
    const fetchMock = installFetch((url, init) => {
      expect(url).toBe("http://localhost:8000/api/jobs/job-1");
      expect(init?.headers).toMatchObject({ "X-User-ID": "user-002" });
      return jsonResponse(jobFixture({ status: "running" }));
    });
    const job = await getJob("user-002", "job-1");
    expect(job.status).toBe("running");
    expect(job.job_id).toBe("job-abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lists jobs for the caller only", async () => {
    installFetch((url) => {
      expect(url).toContain("/api/jobs?");
      return jsonResponse([jobFixture({ job_id: "job-1" })]);
    });
    const jobs = await listJobs("user-001");
    expect(jobs).toHaveLength(1);
  });

  it("uploads a document as multipart form data", async () => {
    installFetch((url, init) => {
      expect(url).toBe("http://localhost:8000/api/documents");
      expect(init?.body).toBeInstanceOf(FormData);
      expect(init?.headers).toMatchObject({ "X-User-ID": "user-001" });
      return jsonResponse(documentFixture({ status: "ready" }), 201);
    });
    const file = new File(["pump data"], "manual.txt", { type: "text/plain" });
    const doc = await uploadDocument("user-001", file);
    expect(doc.status).toBe("ready");
    expect(doc.filename).toBe("manual.txt");
  });

  it("deletes a document", async () => {
    installFetch((url, init) => {
      expect(url).toBe("http://localhost:8000/api/documents/doc-1");
      expect(init?.method).toBe("DELETE");
      return jsonResponse({ document_id: "doc-1", deleted: true });
    });
    await expect(deleteDocument("user-001", "doc-1")).resolves.toBeUndefined();
  });

  it("cancels a job", async () => {
    installFetch((url, init) => {
      expect(url).toBe("http://localhost:8000/api/jobs/job-1");
      expect(init?.method).toBe("DELETE");
      return jsonResponse(jobFixture({ status: "cancelled" }));
    });
    const job = await cancelJob("user-001", "job-1");
    expect(job.status).toBe("cancelled");
  });

  it("fetches health", async () => {
    installFetch((url) => {
      expect(url).toBe("http://localhost:8000/health");
      return jsonResponse(healthFixture());
    });
    const health = await getHealth();
    expect(health.ollama.reachable).toBe(true);
  });

  it("downloads an artifact with the user header and parses the filename", async () => {
    installFetch((url, init) => {
      expect(url).toBe("http://localhost:8000/api/jobs/job-1/artifacts/art-1");
      expect(init?.headers).toMatchObject({ "X-User-ID": "user-001" });
      return blobResponse("docx-bytes", "approval_note.docx");
    });
    const result = await downloadArtifact("user-001", "job-1", "art-1");
    expect(result.filename).toBe("approval_note.docx");
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("maps backend detail messages into ApiError", async () => {
    installFetch(() =>
      jsonResponse({ detail: { error: "job_not_found", message: "Job not found." } }, 404),
    );
    const error = await getJob("user-001", "missing").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("Job not found.");
  });

  it("throws a friendly error when the backend is unreachable", async () => {
    installFetch(() => {
      throw new TypeError("fetch failed");
    });
    const error = await getHealth().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe("Backend unreachable");
  });

  it("reports local-host detection", () => {
    expect(isLocalHost("http://localhost:11434")).toBe(true);
    expect(isLocalHost("http://127.0.0.1:8000")).toBe(true);
    expect(isLocalHost("https://api.example.com")).toBe(false);
  });
});
