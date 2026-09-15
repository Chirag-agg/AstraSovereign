import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ArtifactCard from "./ArtifactCard";
import Conversation, { friendlyJobError } from "./Conversation";
import Markdown from "./Markdown";
import SystemDrawer from "./SystemDrawer";
import WorkConsole from "./WorkConsole";
import { buildConsoleLines, threadTitle } from "@/lib/console";
import {
  artifactFixture,
  cancelledJobFixture,
  completedJobWithFlagshipTrace,
  failedJobWithTrace,
  healthFixture,
  jobFixture,
  runningJobWithDocumentVision,
} from "@/test-utils/factory";

describe("console builder (real execution_trace -> lines)", () => {
  const completed = completedJobWithFlagshipTrace();

  it("derives planning, commands, results and completion from the trace", () => {
    const lines = buildConsoleLines(completed.execution_trace, "completed");
    const kinds = lines.map((l) => l.kind);
    expect(kinds).toContain("planning");
    expect(kinds).toContain("command");
    expect(kinds).toContain("result");
    const commands = lines.filter((l) => l.kind === "command");
    const tools = commands.map((c) => (c.kind === "command" ? c.tool : ""));
    expect(tools).toEqual(["document_search", "document_vision", "document_generation"]);
    const finalLine = lines[lines.length - 1];
    expect(finalLine.kind === "final" && finalLine.state === "done").toBe(true);
    const results = lines.filter((l) => l.kind === "result" && l.ok);
    expect(results.length).toBe(3);
  });

  it("never invents activity and never exposes arguments/content", () => {
    const lines = buildConsoleLines(completed.execution_trace, "completed");
    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain("pump maintenance");
    expect(serialized).not.toContain("query");
    expect(serialized).not.toContain("arguments");
  });

  it("keeps a running tool open when no result has arrived", () => {
    const lines = buildConsoleLines(runningJobWithDocumentVision().execution_trace, "running");
    const commands = lines.filter((l) => l.kind === "command");
    expect(commands.some((c) => c.state === "running")).toBe(true);
    const last = commands[commands.length - 1];
    expect(last && last.kind === "command" && last.tool === "document_vision").toBe(true);
  });

  it("shows a failed tool result and a failed final state", () => {
    const job = failedJobWithTrace();
    const lines = buildConsoleLines(job.execution_trace, job.status);
    expect(lines.some((l) => l.kind === "result" && !l.ok)).toBe(true);
    const finalLine = lines[lines.length - 1];
    expect(finalLine.kind === "final" && finalLine.state === "failed").toBe(true);
  });

  it("shows a cancelled final state", () => {
    const lines = buildConsoleLines([], "cancelled");
    const last = lines[lines.length - 1];
    expect(last.kind === "final" && last.state === "cancelled").toBe(true);
  });
});

describe("threadTitle", () => {
  it("truncates long messages", () => {
    expect(threadTitle("hello")).toBe("hello");
    const long = "x".repeat(100);
    expect(threadTitle(long).length).toBeLessThan(50);
  });
});

describe("WorkConsole", () => {
  it("renders commands, results and completion from a completed job", () => {
    const job = completedJobWithFlagshipTrace();
    render(<WorkConsole job={job} expanded onToggle={() => undefined} />);
    expect(screen.getByText("document_search", { selector: ".cmd" })).toBeInTheDocument();
    expect(screen.getByText(/3 relevant chunk/)).toBeInTheDocument();
    expect(screen.getByText(/TASK COMPLETED/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Work console" })).toBeInTheDocument();
  });

  it("indicates a running tool with text", () => {
    const job = runningJobWithDocumentVision();
    render(<WorkConsole job={job} expanded onToggle={() => undefined} />);
    expect(screen.getAllByText(/running…/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("document_vision", { selector: ".cmd" })).toBeInTheDocument();
  });

  it("is collapsible", () => {
    const job = completedJobWithFlagshipTrace();
    const onToggle = vi.fn();
    render(<WorkConsole job={job} expanded={false} onToggle={onToggle} />);
    expect(screen.queryByRole("group", { name: "Work console" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Work console/i }));
    expect(onToggle).toHaveBeenCalled();
  });
});

describe("Markdown", () => {
  it("renders paragraphs, lists and code blocks", () => {
    render(
      <Markdown text={"Hello **world**.\n\n- one\n- two\n\n```py\nprint(1)\n```"} />,
    );
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
    expect(screen.getByText("print(1)")).toBeInTheDocument();
  });
});

describe("ArtifactCard", () => {
  it("shows metadata and downloads", () => {
    const artifact = artifactFixture();
    const onDownload = vi.fn();
    render(<ArtifactCard artifact={artifact} onDownload={onDownload} />);
    expect(screen.getByText("approval_note.docx")).toBeInTheDocument();
    expect(screen.getByText(/Word document/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Download approval_note.docx/ }));
    expect(onDownload).toHaveBeenCalledWith(artifact);
  });

  it("labels Excel and PowerPoint deliverables", () => {
    const { rerender } = render(
      <ArtifactCard
        artifact={{ ...artifactFixture(), type: "excel", filename: "findings.xlsx" }}
        onDownload={() => undefined}
      />,
    );
    expect(screen.getByText(/Excel workbook/)).toBeInTheDocument();
    rerender(
      <ArtifactCard
        artifact={{ ...artifactFixture(), type: "pptx", filename: "deck.pptx" }}
        onDownload={() => undefined}
      />,
    );
    expect(screen.getByText(/PowerPoint deck/)).toBeInTheDocument();
  });
});

describe("friendlyJobError", () => {
  it("maps model/vision/resource errors to human messages", () => {
    expect(friendlyJobError(jobFixture({ status: "failed", error: "resource_rejected: nope" }))).toMatch(
      /resource scheduler/i,
    );
    expect(
      friendlyJobError(jobFixture({ status: "failed", error: "OllamaModelNotFoundError: x" })),
    ).toMatch(/model is unavailable/i);
  });
});

describe("Conversation", () => {
  it("shows the user message, assistant answer and artifact card for a completed job", () => {
    const job = completedJobWithFlagshipTrace();
    render(
      <Conversation
        userId="user-001"
        job={job}
        onDownload={() => undefined}
        onSubmit={() => undefined}
        consoleOpen
        setConsoleOpen={() => undefined}
      />,
    );
    expect(screen.getByText(job.message)).toBeInTheDocument();
    expect(screen.getByText(/Created approval_note.docx/)).toBeInTheDocument();
    expect(screen.getByText("approval_note.docx")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Work console" })).toBeInTheDocument();
  });

  it("shows a readable failure message, not a raw error", () => {
    const job = failedJobWithTrace();
    render(
      <Conversation
        userId="user-001"
        job={job}
        onDownload={() => undefined}
        onSubmit={() => undefined}
        consoleOpen
        setConsoleOpen={() => undefined}
      />,
    );
    expect(screen.getByText(/vision analysis is unavailable/i)).toBeInTheDocument();
  });

  it("shows a cancelled notice", () => {
    render(
      <Conversation
        userId="user-001"
        job={cancelledJobFixture()}
        onDownload={() => undefined}
        onSubmit={() => undefined}
        consoleOpen={false}
        setConsoleOpen={() => undefined}
      />,
    );
    expect(screen.getByText(/task was cancelled/i)).toBeInTheDocument();
  });

  it("shows a welcome state when no job is active", () => {
    render(
      <Conversation
        userId="user-001"
        job={null}
        onDownload={() => undefined}
        onSubmit={vi.fn()}
        consoleOpen={false}
        setConsoleOpen={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /Try the demo/i })).toBeInTheDocument();
  });
});

describe("SystemDrawer (user Local & privacy)", () => {
  it("renders only backend-verified local facts", () => {
    render(<SystemDrawer open onClose={() => undefined} health={healthFixture()} error={null} />);
    expect(screen.getByText("on this machine")).toBeInTheDocument();
    expect(screen.getByText(/VERIFIED_LOCAL/)).toBeInTheDocument();
    expect(screen.getByText("ENABLED")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Local and privacy" })).toBeInTheDocument();
    // no infrastructure tables in the user view
    expect(screen.queryByText("GPU-0")).not.toBeInTheDocument();
    expect(screen.queryByText("Worker")).not.toBeInTheDocument();
  });

  it("shows an unavailable state when the backend is down", () => {
    render(<SystemDrawer open onClose={() => undefined} health={null} error="Backend unreachable" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/backend is unavailable/i);
  });
});
