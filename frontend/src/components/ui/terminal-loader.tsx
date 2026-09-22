"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Boot loader.
 *
 * Markup and keyframes from Uiverse.io by jeremyssocial, retimed and put on
 * the system palette (see .terminal-loader in globals.css). The typed line is
 * the honest one: this is what the backend actually does on start — load the
 * registry, check Ollama, arm the network guard.
 */

export interface TerminalLoaderProps {
  /** The line that types and deletes. Keep it under ~34 characters. */
  text?: string;
  title?: string;
  className?: string;
}

export function TerminalLoader({
  text = "arming network guard…",
  title = "astra://boot",
  className,
}: TerminalLoaderProps) {
  return (
    <div className={cn("terminal-loader", className)} role="status" aria-live="polite">
      <div className="terminal-header">
        <div className="terminal-title">{title}</div>
        <div className="terminal-controls">
          <span className="control close" />
          <span className="control minimize" />
          <span className="control maximize" />
        </div>
      </div>
      <span className="text">{text}</span>
    </div>
  );
}

/**
 * The scanning eye (Uiverse.io by Shoh2008, recoloured). Used on the boot
 * curtain in place of the terminal: it reads as something looking rather
 * than something typing, which is closer to what start-up actually does.
 */
export function EyeLoader({ label = "Starting the workbench" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-5" role="status" aria-live="polite">
      <span className="loader-shell">
        <span className="loader" />
      </span>
      <span className="mono-label" style={{ letterSpacing: "0.12em" }}>
        {label}
      </span>
    </div>
  );
}

export const BOOT_STEPS: { label: string; note: string }[] = [
  { label: "model registry", note: "config/models.yaml — 5 capabilities" },
  { label: "network guard", note: "external hosts → blocked" },
  { label: "audit chain", note: "hash-chained, append-only" },
  { label: "sandbox image", note: "workbench-sandbox:py312" },
  { label: "knowledge base", note: "local vectors, per user" },
];

/**
 * Full-screen boot curtain. Shown while the shell hydrates and the first
 * /health round-trip lands — never on a timer alone, so it can't pretend to
 * be doing work it isn't.
 */
export function BootCurtain({
  done,
  onDismissed,
}: {
  done: boolean;
  onDismissed?: () => void;
}) {
  const [hidden, setHidden] = React.useState(false);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, BOOT_STEPS.length - 1)), 420);
    return () => window.clearInterval(id);
  }, [done]);

  React.useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => {
      setHidden(true);
      onDismissed?.();
    }, 260);
    return () => window.clearTimeout(id);
  }, [done, onDismissed]);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-10"
      style={{
        background: "var(--canvas)",
        opacity: done ? 0 : 1,
        transition: "opacity 240ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <EyeLoader />
      <ol className="flex flex-col gap-1.5" style={{ minWidth: 320 }}>
        {BOOT_STEPS.map((entry, index) => {
          const state = done || index < step ? "ok" : index === step ? "run" : "wait";
          return (
            <li key={entry.label} className="flex items-baseline gap-3 font-mono" style={{ fontSize: 11 }}>
              <span
                style={{
                  color:
                    state === "ok"
                      ? "var(--metric)"
                      : state === "run"
                        ? "var(--signal)"
                        : "var(--graphite)",
                  width: 12,
                }}
              >
                {state === "ok" ? "✓" : state === "run" ? "›" : "·"}
              </span>
              <span style={{ color: state === "wait" ? "var(--graphite)" : "var(--stone)", minWidth: 128 }}>
                {entry.label}
              </span>
              <span style={{ color: "var(--graphite)" }}>{entry.note}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default TerminalLoader;
