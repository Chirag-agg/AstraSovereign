"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The AstraSovereign mark.
 *
 * Six triangles closing into a hexagon around a sealed core: the six things
 * the router can reach — reason, code, math, document, vision, embed — all
 * pointing inward, nothing leaving. The scanline fill is a halftone, not a
 * gradient; the small squares at each vertex are control points, the visual
 * language of a drawing under construction rather than a finished logo.
 *
 * `interactive` adds parallax tilt toward the pointer with an idle drift.
 * It is CSS transform only — no WebGL, because on a demo box the GPU is busy
 * running the model.
 */

const R = 128; // outer radius
const CORE = 26; // sealed core radius
const GAP = 0.055; // radians trimmed from each triangle so the seams read

function vertex(index: number, radius: number): [number, number] {
  const angle = (Math.PI / 3) * index - Math.PI / 2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function wedge(index: number): string {
  const a0 = (Math.PI / 3) * index - Math.PI / 2 + GAP;
  const a1 = (Math.PI / 3) * (index + 1) - Math.PI / 2 - GAP;
  const p = (a: number, r: number) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  return `M ${p(a0, CORE + 8)} L ${p(a0, R)} L ${p(a1, R)} L ${p(a1, CORE + 8)} Z`;
}

export interface AstraMarkProps {
  size?: number;
  className?: string;
  /** Pointer-reactive tilt and idle drift. Off inside the app. */
  interactive?: boolean;
  /** Draw the construction squares at each vertex. */
  handles?: boolean;
  title?: string;
}

export function AstraMark({
  size = 220,
  className,
  interactive = false,
  handles = true,
  title = "AstraSovereign",
}: AstraMarkProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (!interactive || reduced) return;
    const onMove = (event: PointerEvent) => {
      const node = hostRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Normalised to the viewport so the mark responds across the whole hero.
      const dx = (event.clientX - cx) / window.innerWidth;
      const dy = (event.clientY - cy) / window.innerHeight;
      setTilt({ x: Math.max(-1, Math.min(1, dy)) * -16, y: Math.max(-1, Math.min(1, dx)) * 22 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [interactive, reduced]);

  const uid = React.useId().replace(/[:]/g, "");

  return (
    <div
      ref={hostRef}
      className={cn("relative select-none", interactive && "astra-mark-idle", className)}
      style={{ width: size, height: size, perspective: 900 }}
    >
      <svg
        viewBox="-150 -150 300 300"
        width={size}
        height={size}
        role="img"
        aria-label={title}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 420ms cubic-bezier(0.16, 1, 0.3, 1)",
          transformStyle: "preserve-3d",
          overflow: "visible",
        }}
      >
        <defs>
          <pattern id={`scan-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="none" />
            <rect width="6" height="2.1" fill="currentColor" />
          </pattern>
          <pattern id={`dither-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="none" />
            <rect width="1.4" height="1.4" fill="currentColor" />
            <rect x="2" y="2" width="1.4" height="1.4" fill="currentColor" />
          </pattern>
          <radialGradient id={`core-${uid}`}>
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
          </radialGradient>
        </defs>

        {/* Six wedges. Alternating fills give the halftone its rhythm without
            six separate assets. */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i} style={{ transform: `translateZ(${(i % 2 === 0 ? 10 : 0)}px)` }}>
            <path
              d={wedge(i)}
              fill={`url(#${i % 2 === 0 ? "scan" : "dither"}-${uid})`}
              fillOpacity={i % 2 === 0 ? 0.85 : 0.6}
            />
            <path d={wedge(i)} fill="none" stroke="currentColor" strokeWidth="1.15" strokeOpacity="0.9" />
          </g>
        ))}

        {/* Sealed core — the thing nothing leaves. */}
        <circle r={CORE} fill={`url(#core-${uid})`} />
        <circle r={CORE} fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle r={CORE - 7} fill="none" stroke="var(--signal, #ee6018)" strokeWidth="1.1" />
        <circle r={3} fill="var(--signal, #ee6018)" />

        {handles &&
          [0, 1, 2, 3, 4, 5].map((i) => {
            const [x, y] = vertex(i, R);
            return (
              <rect
                key={i}
                x={x - 5}
                y={y - 5}
                width="10"
                height="10"
                fill="var(--canvas, #101010)"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            );
          })}
      </svg>
    </div>
  );
}

/** Compact lockup for the nav and the app shell. */
export function AstraWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AstraMark size={22} handles={false} />
      <span
        className="font-mono uppercase"
        style={{ fontSize: 12, letterSpacing: "0.12em", color: "var(--bone)" }}
      >
        AstraSovereign
      </span>
    </span>
  );
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export default AstraMark;
