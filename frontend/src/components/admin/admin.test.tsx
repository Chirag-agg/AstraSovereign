import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminConsole from "./AdminConsole";
import { installFetch, jsonResponse } from "@/test-utils/factory";

let path = "/admin/overview";

vi.mock("next/navigation", () => ({
  usePathname: () => path,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function adminHandler(url: string): Response {
  const pathname = url.replace("http://localhost:8000", "");
  if (pathname.startsWith("/api/admin/overview")) {
    return jsonResponse({
      jobs: { total: 3, queued: 1, running: 1, completed: 1, failed: 0, cancelled: 0 },
      models_available: 3,
      models_configured: 4,
      ollama_reachable: true,
      scheduler: { queued_jobs: 1, running_jobs: 1, allocated: { cpu_cores: 2, memory_mb: 4096, gpu: {} } },
      worker: { state: "running" },
      failed_today: 1,
      audit_events: 40,
      sovereignty: {
        network_policy: "LOCAL_ONLY",
        external_connections: { status: "VERIFIED_LOCAL", count: 0, blocked_attempts: 0, local_connections: 3 },
        audit_logging: true,
        audit_events: 40,
        sandbox_network: "DISABLED",
        ollama_endpoint: "http://localhost:11434",
        local_model_calls: 12,
      },
    });
  }
  if (pathname.startsWith("/api/admin/jobs/")) {
    return jsonResponse({
      job_id: "job-1",
      user_id: "user-001",
      task_type: "general",
      status: "running",
      model: "llama3.1:latest",
      execution_trace: [{ step: 1, type: "agent_started" }],
      artifacts: [],
    });
  }
  if (pathname.startsWith("/api/admin/jobs")) {
    return jsonResponse([
      { job_id: "job-1", user_id: "user-001", task_type: "general", status: "running", model: "llama3.1:latest" },
      { job_id: "job-2", user_id: "user-002", task_type: "coding", status: "queued", model: "qwen-coder" },
    ]);
  }
  if (pathname.startsWith("/api/admin/users")) {
    return jsonResponse([{ user_id: "user-001", jobs: 2, active_jobs: 1, failed_jobs: 0, documents: 3, artifacts: 1 }]);
  }
  if (pathname.startsWith("/api/admin/models")) {
    return jsonResponse([
      { task_type: "general", provider: "ollama", model: "qwen2.5:7b", enabled: true, available: true, capabilities: [], resources: { gpu_vram_mb: 4096 } },
    ]);
  }
  if (pathname.startsWith("/api/admin/resources")) {
    return jsonResponse({ capacity: { cpu_cores: 8, memory_mb: 16384, gpus: [] }, allocated: [], waiting_jobs: 0, running_jobs: 0, allocated_gpu: {} });
  }
  if (pathname.startsWith("/api/admin/knowledge")) {
    return jsonResponse({ documents: 2, chunks: 4, embedding: { provider: "ollama" }, per_user: {} });
  }
  if (pathname.startsWith("/api/admin/audit")) {
    return jsonResponse([{ event_id: "e1", event_type: "JOB_CREATED", component: "job_manager", status: "ok", user_id: "user-001", job_id: "job-1", timestamp: "2026-09-01T12:00:00Z", metadata: {} }]);
  }
  if (pathname.startsWith("/api/admin/sovereignty")) {
    return jsonResponse({ network_policy: "LOCAL_ONLY", external_connections: { status: "VERIFIED_LOCAL", count: 0, blocked_attempts: 0, local_connections: 3 }, audit_logging: true, audit_events: 40, sandbox_network: "DISABLED", ollama_endpoint: "http://localhost:11434", local_model_calls: 12 });
  }
  if (pathname.startsWith("/api/admin/system")) {
    return jsonResponse({ ollama: "HEALTHY", models: "HEALTHY", worker: "HEALTHY", queue: "HEALTHY", scheduler: "HEALTHY", knowledge_base: "HEALTHY", ocr: "HEALTHY", vision: "DEGRADED", document_generation: "HEALTHY", audit_store: "HEALTHY", sandbox_network: "DISABLED" });
  }
  return jsonResponse({ detail: { message: "not found" } }, 404);
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AdminConsole (dev-only)", () => {
  it("blocks when the dev role is not admin", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("sovereign.dev-role", "user");
    installFetch(() => jsonResponse({}, 403));
    render(<AdminConsole />);
    expect(screen.getByText("Development admin access")).toBeInTheDocument();
    expect(screen.queryByText("Platform overview")).not.toBeInTheDocument();
  });

  it("renders the overview with real backend data for admins", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("sovereign.dev-role", "admin");
    path = "/admin/overview";
    installFetch(adminHandler);
    render(<AdminConsole />);
    await flush();
    expect(screen.getByText("Platform overview")).toBeInTheDocument();
    expect(screen.getByText("Models available")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/VERIFIED_LOCAL/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Workloads" }).length).toBeGreaterThan(0);
  });

  it("renders the workloads view from the admin jobs API", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("sovereign.dev-role", "admin");
    path = "/admin/workloads";
    installFetch(adminHandler);
    render(<AdminConsole />);
    await flush();
    await flush(1000);
    expect(screen.getByText("All jobs")).toBeInTheDocument();
    expect(screen.getByText("user-002")).toBeInTheDocument();
    expect(screen.getByText("qwen-coder")).toBeInTheDocument();
  });

  it("renders the system health view with explicit states", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("sovereign.dev-role", "admin");
    path = "/admin/system";
    installFetch(adminHandler);
    render(<AdminConsole />);
    await flush();
    await flush(3000);
    expect(screen.getByText("Component states")).toBeInTheDocument();
    expect(screen.getAllByText("HEALTHY").length).toBeGreaterThan(1);
    expect(screen.getByText("DEGRADED")).toBeInTheDocument();
  });
});
