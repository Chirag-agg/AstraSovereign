"use client";

/**
 * Tool chip: renders a tool call with state, optional input/output metadata and
 * an error. Adapted from the open-source prompt-kit `tool` primitive and
 * restyled for this design system. Never receives file/document contents.
 */

export interface ToolPart {
  type: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

const STATE_TEXT: Record<ToolPart["state"], string> = {
  "input-streaming": "reading…",
  "input-available": "running",
  "output-available": "done",
  "output-error": "error",
};

function shortKeyValue(obj: Record<string, unknown>): string {
  if (!obj) {
    return "";
  }
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
}

export function Tool({
  toolPart,
  className = "",
}: {
  toolPart: ToolPart;
  className?: string;
}) {
  const state = toolPart.state;
  const isError = state === "output-error";
  const isRunning = state === "input-streaming" || state === "input-available";
  const label = toolPart.type.split("_").join(" ");

  return (
    <div className={`pka-tool ${isError ? "error" : isRunning ? "running" : "ok"} ${className}`} role="status">
      <div className="pka-tool-icon" aria-hidden="true">
        {isError ? "✕" : isRunning ? "⚙" : "✓"}
      </div>
      <div>
        <div className="pka-tool-head">
          <span className="pka-tool-type">{toolPart.type}</span>
          <span className="pka-tool-state">
            {isError ? "error" : STATE_TEXT[state]}
          </span>
        </div>
        {toolPart.input ? (
          <div className="pka-tool-meta">
            {label}: {shortKeyValue(toolPart.input as Record<string, unknown>)}
          </div>
        ) : null}
        {isError && toolPart.errorText ? (
          <div className="pka-tool-error">{toolPart.errorText}</div>
        ) : null}
      </div>
    </div>
  );
}

export default Tool;
