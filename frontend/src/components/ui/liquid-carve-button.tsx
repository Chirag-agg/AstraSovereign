"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Liquid Carve Button.
 *
 * A fill rises from the bottom edge on hover, carrying a shallow liquid
 * meniscus cut into its leading edge, and the label inverts against it. The
 * movement is a single transform on a compositor-friendly layer — no JS
 * animation loop, nothing that competes with the GPU while a model is running.
 *
 * Built here rather than pulled from the Originkit registry: the CLI could not
 * run in this environment (see the branch notes). The API is intentionally the
 * same shape, so swapping in the official component later is a file move.
 */

type Variant = "solid" | "ghost" | "bone";

export interface LiquidCarveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Render as an anchor instead of a button. */
  href?: string;
  /** Trailing glyph — an arrow reads as "this navigates". */
  arrow?: boolean;
  size?: "sm" | "md" | "lg";
}

const MENISCUS =
  "M0,14 C 60,14 70,0 130,2 C 190,4 210,14 280,10 C 350,6 366,14 420,13 L420,15 L0,15 Z";

const BASE: Record<Variant, { rest: React.CSSProperties; fill: string; hover: string }> = {
  // Neutral dark fill — the committing action inside a dark surface.
  solid: {
    rest: { background: "var(--carbon)", color: "var(--bone)", border: "1px solid var(--carbon)" },
    fill: "var(--chalk)",
    hover: "#101010",
  },
  // Typographic button: border only, no fill until the carve arrives.
  ghost: {
    rest: { background: "transparent", color: "var(--bone)", border: "1px solid var(--ash)" },
    fill: "var(--bone)",
    hover: "#101010",
  },
  // The single bright control. Used once per view, never twice.
  bone: {
    rest: { background: "var(--chalk)", color: "#101010", border: "1px solid var(--chalk)" },
    fill: "var(--carbon)",
    hover: "var(--bone)",
  },
};

const PAD: Record<NonNullable<LiquidCarveButtonProps["size"]>, React.CSSProperties> = {
  sm: { padding: "0 12px", height: 32, fontSize: 13 },
  md: { padding: "0 16px", height: 40, fontSize: 14 },
  lg: { padding: "0 22px", height: 50, fontSize: 15 },
};

export function LiquidCarveButton({
  variant = "solid",
  size = "md",
  href,
  arrow = false,
  className,
  children,
  style,
  ...rest
}: LiquidCarveButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const skin = BASE[variant];

  const content = (
    <>
      <span
        className="carve-fill"
        aria-hidden="true"
        style={{ background: skin.fill }}
      >
        <svg viewBox="0 0 420 15" preserveAspectRatio="none" aria-hidden="true">
          <path d={MENISCUS} fill={skin.fill} />
        </svg>
      </span>
      <span className="relative inline-flex items-center gap-2 whitespace-nowrap">
        {children}
        {arrow && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="13 6 19 12 13 18" />
          </svg>
        )}
      </span>
    </>
  );

  const shared = {
    className: cn("carve inline-flex items-center justify-center font-medium", className),
    style: {
      ...skin.rest,
      ...PAD[size],
      ...(hovered ? { color: skin.hover } : null),
      ...style,
    } as React.CSSProperties,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setHovered(true),
    onBlur: () => setHovered(false),
  };

  if (href) {
    return (
      <a href={href} {...shared}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" {...shared} {...rest}>
      {content}
    </button>
  );
}

export default LiquidCarveButton;
