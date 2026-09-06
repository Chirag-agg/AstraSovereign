"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

/**
 * Chain of thought: a list of collapsible reasoning steps, each with a trigger
 * and content composed of items. Adapted from the open-source prompt-kit
 * primitives and restyled for this design system.
 */

const StepContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: true,
  setOpen: () => undefined,
});

export function ChainOfThought({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`pka-cot ${className}`}>{children}</div>;
}

export function ChainOfThoughtStep({
  children,
  defaultOpen = true,
  className = "",
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <StepContext.Provider value={{ open, setOpen }}>
      <div className={`pka-cot-step ${className}`}>{children}</div>
    </StepContext.Provider>
  );
}

export function ChainOfThoughtTrigger({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { open, setOpen } = useContext(StepContext);
  return (
    <button
      type="button"
      className={`pka-cot-trigger ${open ? "open" : ""} ${className}`}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      <span className="chev" aria-hidden="true">
        ▶
      </span>
      {children}
    </button>
  );
}

export function ChainOfThoughtContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open } = useContext(StepContext);
  if (!open) {
    return null;
  }
  return <div className={`pka-cot-content ${className}`}>{children}</div>;
}

export function ChainOfThoughtItem({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export default ChainOfThought;
