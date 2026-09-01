import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHealth, useJob } from "./hooks";
import {
  installFetch,
  jsonResponse,
  healthFixture,
  jobFixture,
} from "@/test-utils/factory";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function JobHarness({ userId, jobId }: { userId: string; jobId: string }) {
  const { job, error, stopped } = useJob(userId, jobId);
  return (
    <div>
      <span data-testid="status">{job ? job.status : "loading"}</span>
      <span data-testid="error">{error || ""}</span>
      <span data-testid="stopped">{String(stopped)}</span>
    </div>
  );
}

describe("useJob polling", () => {
  it("polls through queued → running → completed and stops at the terminal state", async () => {
    vi.useFakeTimers();
    const statuses = ["queued", "running", "completed"];
    let index = 0;
    const fetchMock = installFetch((url) => {
      expect(url).toContain("/api/jobs/job-1");
      return jsonResponse(jobFixture({ status: statuses[Math.min(index++, 2)] as never }));
    });

    render(<JobHarness userId="user-001" jobId="job-1" />);
    await flush();
    expect(screen.getByTestId("status")).toHaveTextContent("queued");

    await flush(1000);
    expect(screen.getByTestId("status")).toHaveTextContent("running");

    await flush(1000);
    expect(screen.getByTestId("status")).toHaveTextContent("completed");
    expect(screen.getByTestId("stopped")).toHaveTextContent("true");

    const callsAtTerminal = fetchMock.mock.calls.length;
    await flush(5000);
    expect(fetchMock.mock.calls.length).toBe(callsAtTerminal);
  });

  it("stops polling when the job returns 404", async () => {
    vi.useFakeTimers();
    const fetchMock = installFetch(() =>
      jsonResponse({ detail: { message: "Job not found." } }, 404),
    );

    render(<JobHarness userId="user-001" jobId="job-missing" />);
    await flush();
    expect(screen.getByTestId("error")).toHaveTextContent("Job not found.");
    expect(screen.getByTestId("stopped")).toHaveTextContent("true");

    const calls = fetchMock.mock.calls.length;
    await flush(3000);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("keeps retrying (reconnect) while the backend is down, then recovers", async () => {
    vi.useFakeTimers();
    let down = true;
    installFetch((url) => {
      if (url.endsWith("/health")) {
        if (down) {
          throw new TypeError("fetch failed");
        }
        return jsonResponse(healthFixture());
      }
      return jsonResponse(jobFixture({ status: "completed" }));
    });

    function HealthHarness() {
      const { health, error } = useHealth();
      return (
        <div>
          <span data-testid="healthy">{health ? "yes" : "no"}</span>
          <span data-testid="herror">{error || ""}</span>
        </div>
      );
    }
    render(<HealthHarness />);
    await flush();
    expect(screen.getByTestId("herror")).toHaveTextContent("Backend unreachable");

    down = false;
    await flush(3000);
    expect(screen.getByTestId("healthy")).toHaveTextContent("yes");
    expect(screen.getByTestId("herror")).toHaveTextContent("");
  });
});
