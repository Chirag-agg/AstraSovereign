"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

const ReasoningContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  isStreaming: boolean;
}>({ open: false, setOpen: () => undefined, isStreaming: false });

/** Collapsible "show AI reasoning" block. */
export function Reasoning({
  isStreaming = false,
  defaultOpen = false,
  children,
  className = "",
}: {
  isStreaming?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <ReasoningContext.Provider value={{ open, setOpen, isStreaming }}>
      <div className={`pka-reasoning ${className}`}>{children}</div>
    </ReasoningContext.Provider>
  );
}

export function ReasoningTrigger({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { open, setOpen, isStreaming } = useContext(ReasoningContext);
  const label = children
    ? children
    : isStreaming
      ? "Thinking…"
      : open
        ? "Hide AI reasoning"
        : "Show AI reasoning";
  return (
    <button
      type="button"
      className={`pka-reasoning-trigger ${className}`}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      <span aria-hidden="true">{isStreaming ? "✦" : open ? "▾" : "▸"}</span>
      {label}
    </button>
  );
}

export function ReasoningContent({
  children,
  className = "",
  markdown = false,
}: {
  children: ReactNode;
  className?: string;
  markdown?: boolean;
}) {
  void markdown;
  const { open } = useContext(ReasoningContext);
  if (!open) {
    return null;
  }
  return <div className={`pka-reasoning-content ${className}`}>{children}</div>;
}

export default Reasoning;
