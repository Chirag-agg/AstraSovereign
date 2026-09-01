import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ArtifactList from "./ArtifactList";
import DocumentList from "./DocumentList";
import ExecutionTrace from "./ExecutionTrace";
import JobAuditTimeline from "./JobAuditTimeline";
import SovereigntyStatus from "./SovereigntyStatus";
import StatusBadge from "./StatusBadge";
import TaskStatus from "./TaskStatus";
import UserSelector from "./UserSelector";
import {
  artifactFixture,
  auditEventFixture,
  documentFixture,
  healthFixture,
  installFetch,
  jobFixture,
  jsonResponse,
  traceFixture,
} from "@/test-utils/factory";

describe("StatusBadge", () => {
  it("renders a text label (never color-only)", () => {
    render(<StatusBadge value="completed" />);
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("badge-ok");
  });
});

describe("SovereigntyStatus", () => {
  it("shows LOCAL/SOVEREIGN and verified audit/network facts", () => {
    render(<SovereigntyStatus health={healthFixture()} />);
    expect(screen.getByLabelText("Local / sovereign mode")).toHaveTextContent("LOCAL");
    expect(screen.getByLabelText("Local / sovereign mode")).toHaveTextContent("SOVEREIGN");
    expect(screen.getByText("LOCAL_ONLY")).toBeInTheDocument();
    expect(screen.getByText(/VERIFIED_LOCAL/)).toBeInTheDocument();
    expect(screen.getByText("ENABLED")).toBeInTheDocument();
    expect(screen.getByText("DISABLED")).toBeInTheDocument(); // sandbox network
    expect(screen.getByText(/Ollama at http:\/\/localhost:11434/)).toBeInTheDocument();
    expect(screen.getByText(/3 total/)).toBeInTheDocument(); // local model calls
  });

  it("shows UNKNOWN when there is no external-traffic evidence", () => {
    const unknown = {
      ...healthFixture().sovereignty,
      external_connections: { status: "UNKNOWN" as const, count: 0, blocked_attempts: 0, local_connections: 0 },
    };
    render(<SovereigntyStatus health={healthFixture({ sovereignty: unknown })} />);
    expect(screen.getByText(/UNKNOWN/)).toBeInTheDocument();
  });
});

describe("JobAuditTimeline", () => {
  async function flush(ms = 0) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("renders the job audit timeline with friendly labels and non-sensitive metadata", async () => {
    vi.useFakeTimers();
    installFetch((url) => {
      if (url.includes("/audit")) {
        return jsonResponse([
          auditEventFixture({ event_type: "JOB_CREATED" }),
          auditEventFixture({ event_id: "evt-2", event_type: "MODEL_SELECTED", metadata: { model: "llama3.1:latest" } }),
          auditEventFixture({ event_id: "evt-3", event_type: "DOCUMENT_GENERATION_COMPLETED", metadata: { filename: "approval_note.docx" } }),
        ]);
      }
      return jsonResponse({ detail: { message: "not found" } }, 404);
    });
    render(<JobAuditTimeline userId="user-001" jobId="job-1" terminal />);
    await flush();

    expect(screen.getByText("Job created")).toBeInTheDocument();
    expect(screen.getByText("Model selected")).toBeInTheDocument();
    expect(screen.getByText("document_generation done")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Audit trail" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("ExecutionTrace", () => {
  it("renders trace steps and tool calls without exposing sensitive content", () => {
    const trace = [
      traceFixture({ step: 1, type: "agent_started" }),
      traceFixture({ step: 2, type: "tool_call", tool: "document_generation", arguments: { filename: "note.docx", content: "SECRET-CONTENT" } }),
      traceFixture({ step: 3, type: "tool_result", tool: "document_generation", ok: true, result_summary: "Generated word artifact 'note.docx'" }),
      traceFixture({ step: 4, type: "final", response_summary: "Done." }),
    ];
    render(<ExecutionTrace trace={trace} />);
    expect(screen.getByText("Agent started")).toBeInTheDocument();
    expect(screen.getByText("Tool: document_generation")).toBeInTheDocument();
    expect(screen.getByText(/filename=note.docx/)).toBeInTheDocument();
    expect(screen.queryByText("SECRET-CONTENT")).not.toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});

describe("ArtifactList", () => {
  it("shows artifact metadata and triggers download", () => {
    const artifact = artifactFixture();
    const onDownload = vi.fn();
    render(<ArtifactList artifacts={[artifact]} onDownload={onDownload} />);
    expect(screen.getByText("approval_note.docx")).toBeInTheDocument();
    expect(screen.getByText(/Word document/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Download approval_note.docx/ }));
    expect(onDownload).toHaveBeenCalledWith(artifact);
  });

  it("shows an empty state when there are no artifacts", () => {
    render(<ArtifactList artifacts={[]} onDownload={vi.fn()} />);
    expect(screen.getByText("No artifacts for this job.")).toBeInTheDocument();
  });
});

describe("DocumentList", () => {
  it("lists documents and supports deletion", () => {
    const onDelete = vi.fn();
    render(<DocumentList documents={[documentFixture()]} onDelete={onDelete} />);
    expect(screen.getByText("manual.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete manual.txt" }));
    expect(onDelete).toHaveBeenCalledWith("doc-1");
  });

  it("shows an empty state", () => {
    render(<DocumentList documents={[]} onDelete={vi.fn()} />);
    expect(screen.getByText("No documents uploaded for this user.")).toBeInTheDocument();
  });
});

describe("UserSelector", () => {
  it("switches the active user", () => {
    const onChange = vi.fn();
    render(<UserSelector user="user-001" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Active user" }), {
      target: { value: "user-002" },
    });
    expect(onChange).toHaveBeenCalledWith("user-002");
  });
});

describe("TaskStatus", () => {
  it("renders task/model/agent metadata", () => {
    render(
      <TaskStatus
        job={jobFixture({ status: "running", task_type: "general", model: "llama3.1:latest", agent_stage: "tool_call", iteration_count: 3, tool_call_count: 2, resource_status: "allocated" })}
      />,
    );
    expect(screen.getByText("general")).toBeInTheDocument();
    expect(screen.getByText("llama3.1:latest")).toBeInTheDocument();
    expect(screen.getByText("tool_call")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("allocated")).toBeInTheDocument();
  });
});
