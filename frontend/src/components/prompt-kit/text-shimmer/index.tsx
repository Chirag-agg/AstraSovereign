"use client";

import type { CSSProperties, ReactNode } from "react";

/** Animated loading text (accessible: content is real text). */
export function TextShimmer({
  children,
  className = "",
  duration = 1.6,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
}) {
  const style: CSSProperties = { animationDuration: `${duration}s` };
  return (
    <span className={`pka-shimmer ${className}`} style={style} aria-hidden={undefined}>
      {children}
    </span>
  );
}

export default TextShimmer;
