import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SovereignUI2 from "./SovereignUI2";

describe("SovereignUI2 Light Theme & Multi-Page Component", () => {
  it("renders the main brand and light top navigation elements", () => {
    render(<SovereignUI2 />);
    expect(screen.getByText("Astra Sovereign")).toBeInTheDocument();
    expect(screen.getByText("Ops Room")).toBeInTheDocument();
    expect(screen.getByText("100% Air-Gapped")).toBeInTheDocument();
  });

  it("renders the executive overview with lead model and 2x2 metrics", () => {
    render(<SovereignUI2 />);
    expect(screen.getByText("AI Powered Dashboard")).toBeInTheDocument();
    expect(screen.getAllByText("Qwen 2.5-Coder").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Work Orders")).toBeInTheDocument();
    expect(screen.getByText("Deliverables")).toBeInTheDocument();
    expect(screen.getByText("Zero Egress")).toBeInTheDocument();
    expect(screen.getByText("Compute Load")).toBeInTheDocument();
  });

  it("switches across multiple subpages (Tasks, Coworking, Sandbox, Audit)", () => {
    render(<SovereignUI2 />);
    
    // Switch to AI Tasks page
    const tasksNavBtn = screen.getAllByRole("button", { name: /tasks/i })[0];
    fireEvent.click(tasksNavBtn);
    expect(screen.getByText("Autonomous Tasks & Execution Stream")).toBeInTheDocument();

    // Switch to Coworking page
    const coworkNavBtn = screen.getAllByRole("button", { name: /coworking/i })[0];
    fireEvent.click(coworkNavBtn);
    expect(screen.getByText("Department Coworking & Clearance Sign-Offs")).toBeInTheDocument();

    // Switch to Docker & OCR page
    const sandboxNavBtn = screen.getAllByRole("button", { name: /docker & ocr/i })[0];
    fireEvent.click(sandboxNavBtn);
    expect(screen.getByText("Docker Code Sandbox & Multimodal OCR")).toBeInTheDocument();

    // Switch to Deliverables & Audit page
    const auditNavBtn = screen.getAllByRole("button", { name: /audit/i })[0];
    fireEvent.click(auditNavBtn);
    expect(screen.getByText("Signed Deliverables & Tamper-Evident Audit Trail")).toBeInTheDocument();
  });

  it("cycles hero personas in the overview showcase", () => {
    render(<SovereignUI2 />);
    expect(screen.getByText("Astra Sovereign Core: Agent-Alpha")).toBeInTheDocument();
    
    const nextBtn = screen.getByTitle("Next AI System");
    fireEvent.click(nextBtn);
    expect(screen.getByText("Hyperion Container Sandbox")).toBeInTheDocument();
  });

  it("opens the task modal from the Launch button", () => {
    render(<SovereignUI2 />);
    const launchBtn = screen.getByRole("button", { name: /launch autonomous task/i });
    fireEvent.click(launchBtn);
    expect(screen.getByText("Dispatch Autonomous Work Order")).toBeInTheDocument();
  });
});
