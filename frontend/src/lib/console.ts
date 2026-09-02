// Work Console model: derived ONLY from real backend execution_trace entries.
// Never invents activity; never exposes tool arguments/file contents.

import type { Job, JobStatus, TraceEntry } from "./types";
import { isTerminalStatus } from "./types";

export type ConsoleLine =
  | { kind: "header"; text: string }
  | { kind: "plan"; text: string }
  | { kind: "planning"; items: string[] }
  | { kind: "command"; tool: string; state: "running" | "done" | "failed"; note?: string }
  | { kind: "result"; ok: boolean; text: string }
  | { kind: "final"; state: "done" | "failed" | "cancelled"; seconds?: number };

function toolDisplayName(tool: string): string {
  return tool;
}

/** Group the leading plan entries into a single "planning" block. */
export function buildConsoleLines(trace: TraceEntry[], status: JobStatus): ConsoleLine[] {
  const lines: ConsoleLine[] = [];
  const plans: string[] = [];
  let sawTool = false;

  const flushPlanning = () => {
    if (plans.length > 0) {
      lines.push({ kind: "planning", items: plans.splice(0) });
    }
  };

  const openCommands: { tool: string; index: number }[] = [];

  for (const entry of trace) {
    switch (entry.type) {
      case "agent_started":
        lines.push({ kind: "header", text: "agent session" });
        break;
      case "plan": {
        const description = (entry.description as string) || "";
        const meaningful = description && !description.toLowerCase().startsWith("call tool");
        if (!meaningful) {
          break;
        }
        if (!sawTool) {
          plans.push(description);
        } else {
          lines.push({ kind: "plan", text: description });
        }
        break;
      }
      case "tool_call": {
        if (!sawTool) {
          flushPlanning();
          sawTool = true;
        }
        const tool = entry.tool || "tool";
        lines.push({ kind: "command", tool: toolDisplayName(tool), state: "running" });
        openCommands.push({ tool, index: lines.length - 1 });
        break;
      }
      case "tool_result": {
        const tool = entry.tool || "";
        const ok = entry.ok !== false;
        const text = (entry.result_summary as string) || (ok ? "ok" : "failed");
        const idx = [...openCommands].reverse().findIndex((c) => c.tool === tool);
        if (idx >= 0) {
          const open = openCommands.splice(openCommands.length - 1 - idx, 1)[0];
          const previous = lines[open.index];
          if (previous && previous.kind === "command") {
            lines[open.index] = {
              ...previous,
              state: ok ? "done" : "failed",
              note: text,
            };
          }
        }
        lines.push({ kind: "result", ok, text });
        break;
      }
      case "final":
        break;
      default:
        break;
    }
  }
  flushPlanning();

  if (isTerminalStatus(status)) {
    const done = status === "completed";
    const cancelled = status === "cancelled";
    lines.push({
      kind: "final",
      state: cancelled ? "cancelled" : done ? "done" : "failed",
    });
  }
  return lines;
}

export function elapsedSeconds(job: Job): number | undefined {
  const start = job.started_at ? new Date(job.started_at).getTime() : NaN;
  const end = job.completed_at ? new Date(job.completed_at).getTime() : NaN;
  if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
    return Math.round(end - start) / 1000;
  }
  if (!Number.isNaN(start)) {
    return Math.max(0, Math.round((Date.now() - start) / 1000));
  }
  return undefined;
}

export function threadTitle(message: string): string {
  const clean = (message || "").trim().replace(/\s+/g, " ");
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean || "Untitled task";
}
