"use client";

import type { ReactNode } from "react";

/** Underline-grow action (hover fills with an accent wash). */
export function UnderlineButton({
  children,
  onClick,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button type="button" className={`uib-btn ${className}`} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

export default UnderlineButton;
