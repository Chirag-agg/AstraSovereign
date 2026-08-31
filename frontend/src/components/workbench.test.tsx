import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkbenchPage from "@/app/page";
import type { JobStatus } from "@/lib/types";
import {
  blobResponse,
  completedJobWithFlagshipTrace,
  documentFixture,
  healthFixture,
  installFetch,
  jobFixture,
  jsonResponse,
  statusSequence,
} from "@/test-utils/factory";

const API = "http://localhost:8000";

interface WorkbenchState {
  health: () => Response;
  jobs: (userId: string) => Response;
  documents: (userId: string) => Response;
  jobDetail: (jobId: string) => Response;
  submit: () => Response;
}

function makeState(overrides: Partial<WorkbenchState> = {}): WorkbenchState {
  const defaultJobDetail = jobFixture({ status: "queued" });
  return {
    health: () => jsonResponse(healthFixture()),
    jobs: () => jsonResponse([]),
    documents: () => jsonResponse([]),
    jobDetail: () => jsonResponse(defaultJobDetail),
    submit: () => jsonResponse({ job_id: "job-1", status: "queued" }, 202),
    ...overrides,
  };
}

function renderWorkbench(state: WorkbenchState) {
  const fetchMock = installFetch((url, init) => {
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
      return state.documents(headers["X-User-ID"] || "user-001");
    }
    if (path === "/api/chat" && method === "POST") {
      return state.submit();
    }
    const jobMatch = path.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobMatch) {
      return state.jobDetail(jobMatch[1]);
    }
    if (path.includes("/artifacts/")) {
      return blobResponse("fake-docx-bytes", "approval_note.docx");
    }
    return jsonResponse({ detail: { message: "not found" } }, 404);
  });
  render(<WorkbenchPage />);
  return fetchMock;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function submitTask(text: string) {
  fireEvent.change(screen.getByLabelText("Task description"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit task" }));
  await flush();
}

const taskRegion = () => screen.getByRole("region", { name: "Task status" });

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Workbench page", () => {
  it("runs the flagship workflow: submit → QUEUED → RUNNING → COMPLETED with trace and artifact", async () => {
    vi.useFakeTimers();
    const next = statusSequence(["queued", "running", "completed"]);
    const state = makeState({
      jobDetail: () => {
        const status = next();
        return jsonResponse(
          status === "completed" ? completedJobWithFlagshipTrace() : jobFixture({ status }),
        );
      },
    });
    renderWorkbench(state);
    await flush();

    await submitTask(
      "Review the inspection report against the maintenance procedure and create an approval note.",
    );

    expect(within(taskRegion()).getByText("QUEUED")).toBeInTheDocument();

    await flush(1000);
    expect(within(taskRegion()).getByText("RUNNING")).toBeInTheDocument();

    await flush(1000);
    expect(within(taskRegion()).getByText("COMPLETED")).toBeInTheDocument();

    // execution trace rendered
    expect(screen.getByText("Tool: document_search")).toBeInTheDocument();
    expect(screen.getByText("Tool: document_vision")).toBeInTheDocument();
    expect(screen.getByText("Tool: document_generation")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    // model information rendered
    expect(screen.getAllByText("llama3.1:latest").length).toBeGreaterThan(0);
    expect(screen.getAllByText("general").length).toBeGreaterThan(0);

    // artifacts rendered
    const artifactRegion = screen.getByRole("region", { name: "Generated files" });
    expect(within(artifactRegion).getByText("approval_note.docx")).toBeInTheDocument();
    expect(within(artifactRegion).getByText(/Word document/)).toBeInTheDocument();

    // answer rendered
    const answerRegion = screen.getByRole("region", { name: "Answer" });
    expect(within(answerRegion).getByText(/Created approval_note.docx/)).toBeInTheDocument();
  });

  it("stops polling once the job is terminal", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const state = makeState({
      jobDetail: () => {
        calls += 1;
        return jsonResponse(completedJobWithFlagshipTrace());
      },
    });
    renderWorkbench(state);
    await flush();

    await submitTask("do it");
    expect(within(taskRegion()).getByText("COMPLETED")).toBeInTheDocument();

    const callsAtTerminal = calls;
    await flush(5000);
    expect(calls).toBe(callsAtTerminal);
  });

  it("downloads an artifact through the secure endpoint", async () => {
    vi.useFakeTimers();
    const state = makeState({
      jobDetail: () => jsonResponse(completedJobWithFlagshipTrace()),
    });
    renderWorkbench(state);
    await flush();

    const objectUrl = vi.fn(() => "blob:fake");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: objectUrl, revokeObjectURL: revoke });

    await submitTask("make a note");
    const artifactRegion = screen.getByRole("region", { name: "Generated files" });
    fireEvent.click(within(artifactRegion).getByRole("button", { name: /Download approval_note.docx/ }));
    await flush();

    expect(objectUrl).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalled();
  });

  it("keeps per-user jobs isolated in client state", async () => {
    vi.useFakeTimers();
    const state = makeState({
      jobs: (userId) =>
        jsonResponse([
          userId === "user-001"
            ? { ...jobFixture({ job_id: "job-own-1", status: "completed" }) }
            : { ...jobFixture({ job_id: "job-other-1", status: "completed" }) },
        ]),
    });
    renderWorkbench(state);
    await flush();
    expect(screen.getByText("job-own-1")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Active user" }), {
      target: { value: "user-002" },
    });
    await flush();
    expect(screen.getByText("job-other-1")).toBeInTheDocument();
    expect(screen.queryByText("job-own-1")).not.toBeInTheDocument();
  });

  it("shows a graceful banner when the backend is unreachable", async () => {
    vi.useFakeTimers();
    const state = makeState({
      health: () => {
        throw new TypeError("fetch failed");
      },
    });
    renderWorkbench(state);
    await flush();
    expect(screen.getByText(/Backend unreachable — retrying/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("surfaces job failure errors with a readable message", async () => {
    vi.useFakeTimers();
    const state = makeState({
      jobDetail: () =>
        jsonResponse(
          jobFixture({
            status: "failed",
            error: "model_routing_error: Model for task type 'document' is disabled.",
          }),
        ),
    });
    renderWorkbench(state);
    await flush();

    await submitTask("make a thing");
    expect(screen.getByText(/model_routing_error/)).toBeInTheDocument();
  });

  it("lists the active user's documents", async () => {
    vi.useFakeTimers();
    const state = makeState({
      documents: (userId) =>
        jsonResponse(
          userId === "user-001"
            ? [documentFixture({ filename: "inspection_report.pdf", document_id: "doc-1" })]
            : [],
        ),
    });
    renderWorkbench(state);
    await flush();
    expect(screen.getByText("inspection_report.pdf")).toBeInTheDocument();
  });
});
