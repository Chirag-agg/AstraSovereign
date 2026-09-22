import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkbenchPage from "@/app/page";
import type { JobStatus } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
import {
  blobResponse,
  cancelledJobFixture,
  completedJobWithFlagshipTrace,
  documentFixture,
  failedJobWithTrace,
  healthFixture,
  installFetch,
  jobFixture,
  jobSummaryFixture,
  jsonResponse,
  runningJobWithDocumentVision,
  statusSequence,
} from "@/test-utils/factory";

const API = "http://localhost:8000";

interface State {
  health: () => Response;
  jobs: (userId: string) => Response;
  documents: (userId: string) => Response;
  artifacts: (userId: string) => Response;
  jobDetail: () => Response;
  submit: () => Response;
}

function makeState(overrides: Partial<State> = {}): State {
  return {
    health: () => jsonResponse(healthFixture()),
    jobs: () => jsonResponse([]),
    documents: () => jsonResponse([]),
    artifacts: () => jsonResponse([]),
    jobDetail: () => jsonResponse(jobFixture({ status: "queued" })),
    submit: () => jsonResponse({ job_id: "job-1", status: "queued" }, 202),
    ...overrides,
  };
}

function renderPage(state: State) {
  window.sessionStorage.setItem("sovereign.session", "1");
  return installFetch((url, init) => {
    const path = url.replace(API, "");
    const method = init?.method || "GET";
    const headers = (init?.headers as Record<string, string>) || {};
    if (path === "/health") {
      return state.health();
    }
    if (path.startsWith("/api/jobs?") || path === "/api/jobs") {
      return state.jobs(headers["X-User-ID"] || "user-001");
    }
    if (path === "/api/documents") {
      if (method === "POST") {
        return jsonResponse(documentFixture({ status: "ready" }), 201);
      }
      return state.documents(headers["X-User-ID"] || "user-001");
    }
    if (path === "/api/artifacts") {
      return state.artifacts(headers["X-User-ID"] || "user-001");
    }
    if (path === "/api/chat" && method === "POST") {
      return state.submit();
    }
    const jobMatch = path.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobMatch) {
      if (method === "DELETE") {
        return jsonResponse(jobFixture({ status: "cancelled" }));
      }
      return state.jobDetail();
    }
    if (path.includes("/audit")) {
      return jsonResponse([]);
    }
    if (path.includes("/artifacts/")) {
      return blobResponse("fake-docx-bytes", "approval_note.docx");
    }
    return jsonResponse({ detail: { message: "not found" } }, 404);
  });
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function typeAndSend(text: string) {
  fireEvent.change(screen.getByLabelText("Task description"), { target: { value: text } });
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await flush();
}

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Workbench page (conversation-first)", () => {
  it("flagship flow: submit -> queued -> running -> completed with work console + artifact", async () => {
    vi.useFakeTimers();
    const TASK =
      "Review the inspection report against the maintenance procedure and create an approval note.";
    const next = statusSequence(["queued", "running", "completed"]);
    const withMessage = (job: ReturnType<typeof completedJobWithFlagshipTrace>) => ({
      ...job,
      message: TASK,
    });
    const state = makeState({
      jobDetail: () => {
        const status = next();
        if (status === "completed") {
          return jsonResponse(withMessage(completedJobWithFlagshipTrace()));
        }
        if (status === "running") {
          return jsonResponse(withMessage(runningJobWithDocumentVision()));
        }
        return jsonResponse(jobFixture({ status: "queued", message: TASK }));
      },
      jobs: () => jsonResponse([jobSummaryFixture({ status: "completed" as JobStatus, message: TASK })]),
    });
    renderPage(state);
    render(<WorkbenchPage />);
    await flush();

    await typeAndSend(TASK);

    // user message appears immediately; first poll reports queued
    expect(screen.getAllByText(new RegExp(TASK.slice(0, 24))).length).toBeGreaterThan(0);
    expect(screen.getByText(/Queued — waiting for the agent/)).toBeInTheDocument();

    await flush(1000);
    expect(screen.getAllByText(/Working on it/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/running…/).length).toBeGreaterThanOrEqual(1);

    await flush(1000);
    expect(screen.getByText(/Completed in/)).toBeInTheDocument();
    expect(screen.getByText("document_search", { selector: ".cmd" })).toBeInTheDocument();
    expect(screen.getByText("document_generation", { selector: ".cmd" })).toBeInTheDocument();
    expect(screen.getByText(/TASK COMPLETED/)).toBeInTheDocument();
    expect(screen.getByText(/Created approval_note.docx/)).toBeInTheDocument();

    const artifactCard = screen.getByRole("group", { name: /Artifact approval_note.docx/ });
    expect(within(artifactCard).getByText("approval_note.docx")).toBeInTheDocument();
  });

  it("shows a readable failure for a failed job", async () => {
    vi.useFakeTimers();
    const state = makeState({ jobDetail: () => jsonResponse(failedJobWithTrace()) });
    renderPage(state);
    render(<WorkbenchPage />);
    await flush();
    await typeAndSend("do the thing");
    await flush(1000);
    expect(screen.getByText(/vision analysis is unavailable/i)).toBeInTheDocument();
  });

  it("cancels a running task from the composer", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem("sovereign.session", "1");
    const deleteMock = vi.fn();
    installFetch((url, init) => {
      const path = url.replace(API, "");
      const method = init?.method || "GET";
      const headers = (init?.headers as Record<string, string>) || {};
      if (path === "/health") {
        return jsonResponse(healthFixture());
      }
      if (path === "/api/chat") {
        return jsonResponse({ job_id: "job-1", status: "queued" }, 202);
      }
      if (path.startsWith("/api/jobs?") || path === "/api/jobs") {
        return jsonResponse([jobSummaryFixture({ status: "running" as JobStatus })]);
      }
      if (path.includes("/api/documents")) {
        return jsonResponse([]);
      }
      if (path.includes("/api/artifacts")) {
        return jsonResponse([]);
      }
      const detail = path.match(/^\/api\/jobs\/([^/]+)$/);
      if (detail) {
        if (method === "DELETE") {
          deleteMock(path);
          return jsonResponse(jobFixture({ status: "cancelled" }));
        }
        return jsonResponse(runningJobWithDocumentVision());
      }
      return jsonResponse({ detail: { message: "not found" } }, 404);
    });
    render(<WorkbenchPage />);
    await flush();
    await typeAndSend("do it");
    await flush(1000);
    fireEvent.click(screen.getByRole("button", { name: "Cancel task" }));
    expect(deleteMock).toHaveBeenCalledWith("/api/jobs/job-1");
  });

  it("uploads an attachment and shows it as a chip", async () => {
    vi.useFakeTimers();
    renderPage(makeState());
    render(<WorkbenchPage />);
    await flush();
    const file = new File(["data"], "manual.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await flush();
    expect(screen.getByText("manual.txt")).toBeInTheDocument();
    // Scoped to the chip: every workbench section mounts at once, and the word
    // "indexed" now appears in body copy elsewhere on the page too.
    expect(document.querySelector(".chip-state")).toHaveTextContent(/indexed/);
  });

  it("attaches a knowledge-base document and sends its id with the job", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem("sovereign.session", "1");
    let chatBody: Record<string, unknown> | null = null;
    installFetch((url, init) => {
      const path = url.replace(API, "");
      const method = init?.method || "GET";
      if (path === "/health") {
        return jsonResponse(healthFixture());
      }
      if (path === "/api/documents") {
        return jsonResponse([
          documentFixture({ document_id: "doc-7", filename: "sop-09.pdf", status: "ready" }),
        ]);
      }
      if (path.startsWith("/api/jobs?") || path === "/api/jobs") {
        return jsonResponse([]);
      }
      if (path.includes("/api/artifacts")) {
        return jsonResponse([]);
      }
      if (path === "/api/chat" && method === "POST") {
        chatBody = JSON.parse(String(init?.body));
        return jsonResponse({ job_id: "job-1", status: "queued" }, 202);
      }
      const detail = path.match(/^\/api\/jobs\/([^/]+)$/);
      if (detail) {
        return jsonResponse(jobFixture({ status: "queued" }));
      }
      return jsonResponse({ detail: { message: "not found" } }, 404);
    });
    render(<WorkbenchPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Choose documents" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /sop-09\.pdf/ }));
    await flush();
    await typeAndSend("compare the SOP against the report");
    expect(chatBody).toEqual({
      message: "compare the SOP against the report",
      document_ids: ["doc-7"],
    });
  });

  it("sends every ready document when 'use all documents' is enabled", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem("sovereign.session", "1");
    let chatBody: Record<string, unknown> | null = null;
    installFetch((url, init) => {
      const path = url.replace(API, "");
      const method = init?.method || "GET";
      if (path === "/health") {
        return jsonResponse(healthFixture());
      }
      if (path === "/api/documents") {
        return jsonResponse([
          documentFixture({ document_id: "doc-7", filename: "sop-09.pdf", status: "ready" }),
          documentFixture({ document_id: "doc-8", filename: "report.pdf", status: "ready" }),
          documentFixture({ document_id: "doc-9", filename: "processing.pdf", status: "processing" }),
        ]);
      }
      if (path.startsWith("/api/jobs?") || path === "/api/jobs") {
        return jsonResponse([]);
      }
      if (path.includes("/api/artifacts")) {
        return jsonResponse([]);
      }
      if (path === "/api/chat" && method === "POST") {
        chatBody = JSON.parse(String(init?.body));
        return jsonResponse({ job_id: "job-1", status: "queued" }, 202);
      }
      const detail = path.match(/^\/api\/jobs\/([^/]+)$/);
      if (detail) {
        return jsonResponse(jobFixture({ status: "queued" }));
      }
      return jsonResponse({ detail: { message: "not found" } }, 404);
    });
    render(<WorkbenchPage />);
    await flush();
    fireEvent.click(screen.getByRole("checkbox", { name: "Use all documents" }));
    await flush();
    await typeAndSend("assess everything");
    expect(chatBody).toEqual({
      message: "assess everything",
      document_ids: ["doc-7", "doc-8"],
    });
  });

  it("downloads an artifact from the conversation card", async () => {
    vi.useFakeTimers();
    const objectUrl = vi.fn(() => "blob:fake");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: objectUrl, revokeObjectURL: revoke });
    const state = makeState({ jobDetail: () => jsonResponse(completedJobWithFlagshipTrace()) });
    renderPage(state);
    render(<WorkbenchPage />);
    await flush();
    await typeAndSend("make it");
    await flush(1000);
    fireEvent.click(screen.getByRole("button", { name: /Download approval_note.docx/ }));
    await flush();
    expect(objectUrl).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalled();
  });

  it("keeps per-user data isolated when switching users", async () => {
    vi.useFakeTimers();
    const state = makeState({
      jobs: (userId) =>
        jsonResponse([
          userId === "user-001"
            ? jobSummaryFixture({ job_id: "job-own", message: "my task", status: "completed" as JobStatus })
            : jobSummaryFixture({ job_id: "job-other", message: "other task", status: "completed" as JobStatus }),
        ]),
      documents: (userId) => jsonResponse(userId === "user-001" ? [documentFixture()] : []),
    });
    renderPage(state);
    render(<WorkbenchPage />);
    await flush();
    expect(screen.getAllByText("my task").length).toBeGreaterThan(0);
    expect(screen.getByText("manual.txt")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Active department user"), { target: { value: "user-002" } });
    await flush();
    expect(screen.getAllByText("other task").length).toBeGreaterThan(0);
    expect(screen.queryByText("my task")).not.toBeInTheDocument();
    expect(screen.queryByText("manual.txt")).not.toBeInTheDocument();
  });

  it("selecting a chat in the sidebar shows it in the conversation", async () => {
    vi.useFakeTimers();
    const state = makeState({
      jobs: () =>
        jsonResponse([
          jobSummaryFixture({ job_id: "job-old", message: "earlier task", status: "completed" as JobStatus }),
        ]),
      jobDetail: () => jsonResponse(completedJobWithFlagshipTrace()),
    });
    renderPage(state);
    render(<WorkbenchPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /earlier task/i }));
    await flush(1000);
    expect(screen.getByText("do the thing")).toBeInTheDocument();
  });

  it("opens the local & privacy drawer and shows verified facts", async () => {
    vi.useFakeTimers();
    renderPage(makeState());
    render(<WorkbenchPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Local" }));
    expect(screen.getByRole("dialog", { name: "Local and privacy" })).toBeInTheDocument();
    expect(screen.getByText("on this machine")).toBeInTheDocument();
  });

  it("shows a graceful banner when the backend is unreachable", async () => {
    vi.useFakeTimers();
    const state = makeState({
      health: () => {
        throw new TypeError("fetch failed");
      },
    });
    renderPage(state);
    render(<WorkbenchPage />);
    await flush();
    expect(screen.getAllByText(/Backend unreachable/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows a cancelled state when the job is cancelled", async () => {
    vi.useFakeTimers();
    const state = makeState({ jobDetail: () => jsonResponse(cancelledJobFixture()) });
    renderPage(state);
    render(<WorkbenchPage />);
    await flush();
    await typeAndSend("stop");
    await flush(1000);
    expect(screen.getByText(/task was cancelled/i)).toBeInTheDocument();
  });
});




describe("Workbench gate (login)", () => {
  it("shows the login when there is no session (via the landing page)", async () => {
    vi.useFakeTimers();
    window.sessionStorage.removeItem("sovereign.session");
    installFetch(() => jsonResponse({ detail: { message: "not found" } }, 404));
    render(<WorkbenchPage />);
    await flush();
    // The landing page is shown first; the nav's log-in control opens the
    // sign-in portal. There are several routes in (hero CTA, closing card) —
    // assert on the nav one, which is present at every breakpoint.
    fireEvent.click(screen.getAllByRole("button", { name: /^Log in$/i })[0]);
    await flush();
    expect(screen.getByRole("heading", { name: /Sign in to the workbench/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Task description")).not.toBeInTheDocument();
  });

  it("enters the workspace once a session exists", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem("sovereign.session", "1");
    renderPage(makeState());
    render(<WorkbenchPage />);
    await flush();
    expect(screen.getByLabelText("Task description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});



