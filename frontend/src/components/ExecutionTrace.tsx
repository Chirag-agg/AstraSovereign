"use client";

import type { TraceEntry } from "@/lib/types";

// Renders the ordered execution trace the backend records on each job. Only
// the summaries/metadata the backend stores are shown — never file contents.

const MAX_VALUE_CHARS = 60;

function summarizeArgs(args?: Record<string, unknown>): string {
  if (!args) {
    return "";
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (key === "content" || key === "code") {
      parts.push(`${key}=[hidden]`);
      continue;
    }
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    const shown = raw.length > MAX_VALUE_CHARS ? `${raw.slice(0, MAX_VALUE_CHARS)}…` : raw;
    parts.push(`${key}=${shown}`);
  }
  return parts.join("  ");
}

function traceLabel(entry: TraceEntry): string {
  switch (entry.type) {
    case "agent_started":
      return "Agent started";
    case "plan":
      return "Plan";
    case "tool_call":
      return entry.tool ? `Tool: ${entry.tool}` : "Tool call";
    case "tool_result":
      return entry.tool ? `Result: ${entry.tool}` : "Tool result";
    case "final":
      return "Completed";
    case "agent_failed":
      return "Failed";
    case "agent_cancelled":
      return "Cancelled";
    default:
      return entry.type;
  }
}

function traceDetail(entry: TraceEntry): string {
  switch (entry.type) {
    case "tool_call":
      return summarizeArgs(entry.arguments);
    case "tool_result":
      return entry.ok === false
        ? entry.result_summary || "failed"
        : entry.result_summary || "ok";
    case "final":
      return entry.response_summary || "";
    case "plan": {
      const description = entry.description as string | undefined;
      return description || "";
    }
    case "agent_started":
      return entry.task_type ? `task: ${entry.task_type}` : "";
    case "agent_failed":
      return entry.error || "";
    default:
      return "";
  }
}

export default function ExecutionTrace({ trace }: { trace: TraceEntry[] }) {
  if (!trace || trace.length === 0) {
    return (
      <section className="panel" aria-label="Execution trace">
        <div className="panel-title">Execution trace</div>
        <p className="muted">No trace yet.</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-label="Execution trace">
      <div className="panel-title">Execution trace</div>
      <ol className="trace-list">
        {trace.map((entry) => {
          const detail = traceDetail(entry);
          const kind =
            entry.type === "agent_failed"
              ? "trace-error"
              : entry.type === "agent_cancelled"
                ? "trace-warn"
                : entry.type === "tool_call" || entry.type === "tool_result"
                  ? "trace-tool"
                  : entry.type === "final"
                    ? "trace-final"
                    : "trace-plain";
          return (
            <li key={entry.step} className={`trace-entry ${kind}`}>
              <span className="trace-marker" aria-hidden="true">
                {entry.type === "agent_failed"
                  ? "✕"
                  : entry.type === "agent_cancelled"
                    ? "—"
                    : entry.type === "final"
                      ? "✓"
                      : "•"}
              </span>
              <div className="trace-body">
                <div className="trace-label">
                  <span className="trace-step">#{entry.step}</span> {traceLabel(entry)}
                </div>
                {detail ? <div className="trace-detail">{detail}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
