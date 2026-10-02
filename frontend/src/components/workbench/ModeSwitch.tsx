"use client";

import * as React from "react";

/**
 * Home and Assistant both take a question, so people could not tell them
 * apart. This strip sits at the top of both and says, side by side, what each
 * one is for — the current one lit, the other one a click away.
 */

export type AskMode = "home" | "agent";

const MODES: { id: AskMode; name: string; line: string; points: string[] }[] = [
  {
    id: "home",
    name: "Quick ask",
    line: "A plain answer, fast.",
    points: ["Answer only", "No setup"],
  },
  {
    id: "agent",
    name: "Assistant workspace",
    line: "Every step shown and kept.",
    points: ["Step-by-step trace", "Files it produced", "Audit trail"],
  },
];

export function ModeSwitch({
  current,
  onSwitch,
}: {
  current: AskMode;
  onSwitch?: (mode: AskMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Ways to ask"
      className="grid grid-cols-2"
      style={{ border: "1px solid var(--carbon)", borderRadius: 6, overflow: "hidden", background: "var(--surface-panel)" }}
    >
      {MODES.map((mode) => {
        const on = mode.id === current;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => !on && onSwitch?.(mode.id)}
            className="text-left"
            style={{
              padding: "10px 14px",
              border: "none",
              borderTop: `2px solid ${on ? "var(--signal)" : "transparent"}`,
              background: on ? "color-mix(in srgb, var(--signal) 7%, var(--surface-panel))" : "transparent",
              cursor: on ? "default" : "pointer",
              minWidth: 0,
            }}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? "var(--bone)" : "var(--granite)" }}>
                {mode.name}
              </span>
              <span
                className="font-mono uppercase shrink-0"
                style={{ fontSize: 9.5, letterSpacing: "0.12em", color: on ? "var(--signal)" : "var(--graphite)" }}
              >
                {on ? "You are here" : "Switch →"}
              </span>
            </span>
            <span className="block truncate" style={{ marginTop: 3, fontSize: 12, color: "var(--granite)" }}>
              {mode.line} <span style={{ color: "var(--graphite)" }}>{mode.points.join(" · ")}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ModeSwitch;
