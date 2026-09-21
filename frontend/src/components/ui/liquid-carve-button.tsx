"use client";

import * as React from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

/**
 * Liquid Carve Button.
 *
 * A blob of accent colour tracks the pointer inside the button and carves
 * through the label: the same text is painted twice, once in the resting
 * colour and once in the inverse, with the second copy clipped to the blob.
 * Where the blob passes, the letters knock out — nothing fades, nothing
 * cross-dissolves, the type is simply cut by the shape moving under it.
 *
 * The follow is a GSAP `quickTo` on two CSS custom properties, so the whole
 * effect is one clip-path and one translate per frame on the compositor —
 * no layout, no paint of the text itself, and no canvas competing with the
 * GPU while a model is generating.
 *
 * Reverse-engineered to match the Originkit component's behaviour; the CLI
 * could not run in this environment, so the props are kept in the same shape
 * for a later swap.
 */

type Variant = "solid" | "ghost" | "bone" | "carve";

export interface LiquidCarveButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart"> {
  variant?: Variant;
  href?: string;
  arrow?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Blob colour. Defaults to the system's signal orange. */
  tone?: string;
}

interface Skin {
  surface: string;
  label: string;
  border: string;
  /** The colour the label flips to inside the blob. */
  knockout: string;
  blob: string;
  glow?: string;
}

const SKINS: Record<Variant, Skin> = {
  // Neutral dark fill — the committing action inside a dark surface.
  solid: { surface: "var(--carbon)", label: "var(--bone)", border: "var(--carbon)", knockout: "var(--chalk-ink)", blob: "var(--chalk)" },
  // Typographic button: border only until the blob arrives.
  ghost: { surface: "transparent", label: "var(--bone)", border: "var(--ash)", knockout: "var(--canvas)", blob: "var(--bone)" },
  // The single bright control. Used once per view, never twice.
  bone: { surface: "var(--chalk)", label: "var(--chalk-ink)", border: "var(--chalk)", knockout: "var(--chalk)", blob: "var(--chalk-ink)" },
  // The display treatment from the reference: near-black plate, accent blob,
  // faint accent rim and bloom.
  carve: {
    surface: "#0a0a0a",
    label: "var(--bone)",
    border: "color-mix(in srgb, var(--signal) 42%, transparent)",
    knockout: "#0a0a0a",
    blob: "var(--signal)",
    glow: "0 0 0 1px color-mix(in srgb, var(--signal) 18%, transparent), 0 18px 60px -28px var(--signal)",
  },
};

const SIZES: Record<NonNullable<LiquidCarveButtonProps["size"]>, React.CSSProperties & { blob: number }> = {
  sm: { padding: "0 13px", height: 32, fontSize: 13, blob: 46 },
  md: { padding: "0 17px", height: 40, fontSize: 14, blob: 62 },
  lg: { padding: "0 24px", height: 52, fontSize: 15, blob: 84 },
  xl: { padding: "0 56px", height: 168, fontSize: 56, blob: 124 },
};

export function LiquidCarveButton({
  variant = "solid",
  size = "md",
  href,
  arrow = false,
  tone,
  className,
  children,
  style,
  ...rest
}: LiquidCarveButtonProps) {
  const hostRef = React.useRef<HTMLElement | null>(null);
  const setX = React.useRef<((value: number) => void) | null>(null);
  const setY = React.useRef<((value: number) => void) | null>(null);
  const setR = React.useRef<((value: number) => void) | null>(null);

  const skin = SKINS[variant];
  const { blob: blobSize, ...pad } = SIZES[size];
  const isDisplay = size === "xl";

  React.useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Park the blob off the plate so nothing shows before the first move.
    // Plain numbers: the CSS multiplies by 1px (see .carve-blob).
    gsap.set(node, { "--carve-x": 0, "--carve-y": -9999, "--carve-r": 0 });

    const duration = reduced ? 0.01 : 0.45;
    setX.current = gsap.quickTo(node, "--carve-x", { duration, ease: "power3.out" });
    setY.current = gsap.quickTo(node, "--carve-y", { duration, ease: "power3.out" });
    setR.current = gsap.quickTo(node, "--carve-r", { duration: reduced ? 0.01 : 0.34, ease: "power2.out" });

    return () => {
      gsap.killTweensOf(node);
      setX.current = setY.current = setR.current = null;
    };
  }, []);

  const track = React.useCallback((event: React.PointerEvent) => {
    const node = hostRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setX.current?.(event.clientX - rect.left);
    setY.current?.(event.clientY - rect.top);
  }, []);

  const enter = React.useCallback(
    (event: React.PointerEvent) => {
      const node = hostRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      // Snap to the entry point before growing, so the blob appears at the
      // edge the pointer crossed rather than sliding in from the last one.
      gsap.set(node, { "--carve-x": event.clientX - rect.left, "--carve-y": event.clientY - rect.top });
      setR.current?.(blobSize / 2);
    },
    [blobSize],
  );

  const leave = React.useCallback(() => setR.current?.(0), []);

  const label = (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      {children}
      {arrow && (
        <svg width={isDisplay ? 22 : 14} height={isDisplay ? 22 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="13 6 19 12 13 18" />
        </svg>
      )}
    </span>
  );

  const shared = {
    ref: hostRef as React.Ref<never>,
    className: cn("carve", isDisplay && "carve-display", className),
    onPointerEnter: enter,
    onPointerMove: track,
    onPointerLeave: leave,
    style: {
      "--carve-blob": tone ?? skin.blob,
      "--carve-knockout": skin.knockout,
      background: skin.surface,
      color: skin.label,
      border: `1px solid ${skin.border}`,
      boxShadow: skin.glow,
      ...pad,
      ...style,
    } as React.CSSProperties,
  };

  const inner = (
    <>
      {/* The blob. Sits under the knockout copy and above the plate. */}
      <span className="carve-blob" aria-hidden="true" />
      {/* Resting label. */}
      <span className="carve-label">{label}</span>
      {/* The carved copy: identical text, inverse colour, clipped to the blob.
          aria-hidden so the label is announced once. */}
      <span className="carve-label carve-label--cut" aria-hidden="true">
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} {...shared}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" {...shared} {...rest}>
      {inner}
    </button>
  );
}

export default LiquidCarveButton;
