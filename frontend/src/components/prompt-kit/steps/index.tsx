"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

const StepsContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => undefined,
});

/** Collapsible "agent run steps" panel. */
export function Steps({
  defaultOpen = false,
  children,
  className = "",
}: {
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <StepsContext.Provider value={{ open, setOpen }}>
      <div className={`pka-steps ${className}`}>{children}</div>
    </StepsContext.Provider>
  );
}

export function StepsTrigger({ children, className = "" }: { children?: ReactNode; className?: string }) {
  const { open, setOpen } = useContext(StepsContext);
  return (
    <button type="button" className={`pka-steps-trigger ${className}`} aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{children}</span>
      <span className="chev" aria-hidden="true">
        {open ? "▾" : "▸"}
      </span>
    </button>
  );
}

export function StepsContent({ children, className = "" }: { children?: ReactNode; className?: string }) {
  const { open } = useContext(StepsContext);
  if (!open) {
    return null;
  }
  return <div className={`pka-steps-content ${className}`}>{children}</div>;
}

export function StepsItem({
  children,
  className = "",
  state = "done",
}: {
  children?: ReactNode;
  className?: string;
  state?: "done" | "active" | "pending";
}) {
  const marker = state === "done" ? "✓" : state === "active" ? "●" : "○";
  return (
    <div className={`pka-step-item ${state} ${className}`}>
      <span className="marker" aria-hidden="true">
        {marker}
      </span>
      <span>{children}</span>
    </div>
  );
}

export default Steps;
