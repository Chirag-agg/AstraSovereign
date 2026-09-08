import { useEffect, useRef, useState } from "react";
import { Play, Loader2, ShieldCheck, WifiOff, TerminalSquare, RefreshCw } from "lucide-react";
import { getJob, getSovereignty, submitChat } from "@/lib/api";
import type { Job, SovereigntyStatus } from "@/lib/types";

function activeUserId(): string {
  try {
    return window.localStorage.getItem("sovereign.active-user") || "user-001";
  } catch {
    return "user-001";
  }
}

interface Run {
  id: string;
  prompt: string;
  time: string;
  status: string;
  error?: string;
  lines: string[];
}

function short(text: string, limit = 300): string {
  const t = (text ?? "").trim();
  return t.length > limit ? `${t.slice(0, limit)}…` : t;
}

function terminalLines(job: Job): string[] {
  const out: string[] = [];
  for (const e of job.execution_trace ?? []) {
    if (e.type === "agent_started") {
      out.push(`$ agent session · task ${e.task_type ?? job.task_type ?? "general"} · model ${(e.model as string) || job.model || "local"}`);
      continue;
    }
    if (e.type === "plan") {
      const d = (e.description as string) || "";
      if (d && !d.toLowerCase().startsWith("call tool") && !d.toLowerCase().startsWith("produce the final")) {
        out.push(`$ plan: ${short(d, 200)}`);
      }
      continue;
    }
    if (e.type === "tool_call") {
      const tool = (e.tool as string) || "tool";
      out.push(`$ run ${tool}${tool === "code_execution" ? "  # isolated sandbox, egress off" : ""}`);
      continue;
    }
    if (e.type === "tool_result") {
      const ok = e.ok !== false;
      const summary = short(e.result_summary as string, 240) || (ok ? "ok" : "failed");
      out.push(`  ${ok ? "✓" : "✕"} ${summary}`);
    }
  }
  return out;
}

function friendlyError(err?: string): string {
  const t = err || "";
  if (/docker/i.test(t) || /daemon|container/i.test(t)) {
    return "The code sandbox needs Docker. The Docker daemon does not appear to be available on this machine, so the code task could not run.";
  }
  if (/model_routing_error|is disabled/.test(t)) {
    return "No local model is configured for this task type.";
  }
  if (/Ollama/i.test(t)) {
    return "The local model server (Ollama) is unreachable.";
  }
  return short(t, 500) || "The task failed.";
}

export function Sandbox() {
  const userId = activeUserId();
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null);
  const [prompt, setPrompt] = useState(
    "Write a Python function that sizes a vertical flare knockout drum with the Souders-Brown method, then run it with a small worked example and report the result.",
  );
  const [runs, setRuns] = useState<Run[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSovereignty().then(setSovereignty).catch(() => undefined);
  }, []);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight });
  }, [runs]);

  const patchRun = (id: string, patch: Partial<Run>) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const run = async () => {
    const text = prompt.trim();
    if (!text || runningId) return;
    try {
      const submitted = await submitChat(userId, text);
      const id = submitted.job_id;
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setRunningId(id);
      setRuns((prev) => [{ id, prompt: text, time: now, status: "queued", lines: [] }, ...prev]);
    } catch (err) {
      const id = `failed-${Date.now()}`;
      setRuns((prev) => [
        {
          id,
          prompt: text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "failed",
          error: err instanceof Error ? err.message : "Could not reach the backend.",
          lines: [],
        },
        ...prev,
      ]);
    }
  };

  // poll the running job and stream its terminal
  useEffect(() => {
    if (!runningId) return;
    let alive = true;
    const tick = async () => {
      try {
        const job = await getJob(userId, runningId);
        if (!alive) return;
        patchRun(runningId, { status: job.status, lines: terminalLines(job) });
        if (["completed", "failed", "cancelled"].includes(job.status)) {
          setRunningId((cur) => (cur === runningId ? null : cur));
          if (job.status === "failed") {
            patchRun(runningId, { error: friendlyError(job.error ?? undefined) });
          }
          if (job.status === "cancelled") {
            patchRun(runningId, { error: "The task was cancelled." });
          }
        }
      } catch {
        // transient error, keep polling
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1100);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningId]);

  const active = runs.find((r) => r.id === runningId);
  const history = runningId ? runs.filter((r) => r.id !== runningId) : runs;
  const networkLabel = sovereignty?.sandbox_network || "egress disabled";

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Code sandbox</span>
          <span className="rounded-full border px-2 py-0.5 text-[10.5px]" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            python · isolated
          </span>
          <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <WifiOff size={10} />
            {networkLabel}
          </span>
        </div>
        {sovereignty ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--safe-600)" }}>
            <ShieldCheck size={12} />
            {sovereignty.external_connections?.status === "VERIFIED_LOCAL" ? "Verified local-only execution" : "Local execution"}
          </span>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-4xl p-6">
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Ask the agent to write and run Python code in the isolated sandbox…"
            className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              The agent writes the script, executes it inside the sandbox and returns the output here.
            </p>
            <button
              onClick={() => void run()}
              disabled={Boolean(runningId) || !prompt.trim()}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--accent-solid)" }}
            >
              {runningId ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {runningId ? "Running…" : "Run in sandbox"}
            </button>
          </div>
        </div>

        <p className="mb-2 mt-6 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          Terminal
        </p>
        <div
          className="mono max-h-[300px] min-h-[140px] overflow-y-auto rounded-lg border px-4 py-3 text-[12.5px] leading-relaxed"
          style={{ background: "var(--bg-sunken)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          ref={termRef}
        >
          {active ? (
            <>
              {active.lines.map((line, i) => (
                <div key={i} style={{ color: line.startsWith("$") ? "var(--text-primary)" : line.startsWith("✓") ? "var(--safe-600)" : line.startsWith("✕") ? "var(--alert-600)" : undefined, whiteSpace: "pre-wrap" }}>
                  {line}
                </div>
              ))}
              {active.status === "queued" || active.status === "running" ? (
                <div className="flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                  <span className="caret">▍</span>
                  <Loader2 size={12} className="animate-spin" />
                </div>
              ) : (
                <div className="mt-1">
                  <p style={{ color: active.status === "completed" ? "var(--safe-600)" : "var(--alert-600)" }}>
                    {active.status === "completed" ? "✓ TASK COMPLETED" : active.status === "cancelled" ? "— TASK CANCELLED" : "✕ TASK FAILED"}
                  </p>
                  {active.error ? (
                    <p className="mt-1 whitespace-pre-wrap" style={{ color: "var(--alert-600)" }}>{active.error}</p>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-tertiary)" }}>
              No run yet. Write a coding request above and press <span style={{ color: "var(--text-primary)" }}>Run in sandbox</span>.
            </p>
          )}
        </div>

        <div className="mb-2 mt-6 flex items-center justify-between">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            Recent sandbox runs
          </p>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            <RefreshCw size={11} /> refreshes as tasks finish
          </span>
        </div>
        {history.length === 0 ? (
          <p className="rounded-lg border p-4 text-[12.5px]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-tertiary)" }}>
            Nothing finished yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((r) => (
              <div key={r.id} className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>{r.prompt}</p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      background: r.status === "completed" ? "var(--safe-100)" : r.status === "running" || r.status === "queued" ? "var(--amber-100)" : "var(--alert-100)",
                      color: r.status === "completed" ? "var(--safe-600)" : r.status === "running" || r.status === "queued" ? "var(--amber-600)" : "var(--alert-600)",
                    }}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {r.time}
                  {r.error ? ` · ${r.error}` : ` · ${r.lines.length} events`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
