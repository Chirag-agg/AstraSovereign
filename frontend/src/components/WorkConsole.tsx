"use client";

import { useMemo, useState } from "react";

import { buildConsoleLines, elapsedSeconds } from "@/lib/console";
import type { Job } from "@/lib/types";

function classFor(state: string): string {
  if (state === "failed") {
    return "err";
  }
  if (state === "done") {
    return "ok";
  }
  return "";
}

function renderLine(line: ReturnType<typeof buildConsoleLines>[number], key: string) {
  switch (line.kind) {
    case "header":
      return (
        <div key={key} className="cline header">
          {line.text}
        </div>
      );
    case "plan":
      return (
        <div key={key} className="cline plan">
          · {line.text}
        </div>
      );
    case "planning":
      return (
        <div key={key}>
          <div className="cline">
            <span className="dollar">$</span> <span className="cmd">planning</span>
          </div>
          {line.items.map((item, j) => (
            <div key={j} className="cline plan">
              <span className="plan-num">
                {String(j + 1).padStart(2, " ")}.</span> {item}
            </div>
          ))}
        </div>
      );
    case "command":
      return (
        <div key={key} className="cline">
          <span className="dollar">$</span> <span className="cmd">{line.tool}</span>
          {line.state === "running" ? (
            <span className="meta">
              {" "}
              running…<span className="spinner" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true" />
            </span>
          ) : null}
        </div>
      );
    case "result":
      return (
        <div key={key} className="cline">
          <span className={line.ok ? "ok" : "err"}>{line.ok ? "✓" : "✕"}</span>{" "}
          {line.text}
        </div>
      );
    case "final":
      return (
        <div key={key} className="cline console-final">
          {line.state === "done" ? (
            <span className="ok">✓ TASK COMPLETED</span>
          ) : line.state === "cancelled" ? (
            <span className="warn">— TASK CANCELLED</span>
          ) : (
            <span className="err">✕ TASK FAILED</span>
          )}
          {line.seconds !== undefined ? <span className="meta"> · {line.seconds}s</span> : null}
        </div>
      );
    default:
      return null;
  }
}

export default function WorkConsole({
  job,
  expanded,
  onToggle,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lines = useMemo(
    () => buildConsoleLines(job.execution_trace || [], job.status),
    [job.execution_trace, job.status],
  );
  const seconds = elapsedSeconds(job);
  const statusText =
    job.status === "completed"
      ? `✓ completed${seconds !== undefined ? ` · ${seconds.toFixed(1)}s` : ""}`
      : job.status === "failed"
        ? "✕ failed"
        : job.status === "cancelled"
          ? "— cancelled"
          : "running…";

  return (
    <div className="console" role="group" aria-label="Work console">
      <button
        type="button"
        className={`console-header ${expanded ? "open" : ""}`}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="work-console-body"
      >
        <span className="chev" aria-hidden="true">
          ▶
        </span>
        <span className="console-title">Work console</span>
        <span className="console-sub">{statusText}</span>
      </button>
      {expanded ? (
        <div id="work-console-body" className="console-body">
          {lines.map((line, i) => renderLine(line, `${i}`))}
        </div>
      ) : null}
    </div>
  );
}
