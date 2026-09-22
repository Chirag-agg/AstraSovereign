"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The AstraSovereign mark.
 *
 * Six triangles closing into a hexagon around a sealed core, all pointing
 * inward, nothing leaving. Five wedges answer to the routed capabilities in
 * config/models.yaml — general, coding, math, document, vision — and the
 * sixth to nomic-embed-text, the embedding model that classifies each task
 * and chooses between the other five. MarkSection labels all six.
 *
 * The scanline fill is a halftone, not a gradient; the small squares at each
 * vertex are control points, the visual language of a drawing under
 * construction rather than a finished logo.
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

/**
 * The wordmark, set like a title card.
 *
 * Poster typography is condensed caps with the tracking pulled almost shut,
 * over a hairline, with the credit line underneath set wide and small. The
 * width axis is doing the work: Bricolage at wdth 58 gives the tall narrow
 * letterforms a one-sheet uses, which a default-width grotesque never will.
 *
 * The A of ASTRA carries the accent so the mark and the word share one
 * colour event instead of two.
 */
export function AstraWordmark({
  className,
  size = 22,
  tagline = false,
  taglineText = "Sovereign OS",
}: {
  className?: string;
  size?: number;
  /** Adds the rule and the credit line beneath the title. */
  tagline?: boolean;
  taglineText?: string;
}) {
  const titleSize = Math.round(size * 0.78);
  // With the rule and the credit line the text stack is roughly a quarter
  // taller than the title alone, so the mark grows to match it. Optically
  // pairing the mark with the whole block, not just the first line, is what
  // keeps the lockup from looking top-heavy.
  const markSize = tagline ? Math.round(size * 1.3) : size;
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: size * 0.42 }}>
      <AstraMark size={markSize} handles={false} />
      <span className="flex flex-col" style={{ minWidth: 0 }}>
        <span
          className="uppercase truncate"
          style={{
            fontFamily: "var(--display)",
            fontVariationSettings: "'wdth' 58",
            fontWeight: 800,
            fontSize: titleSize,
            lineHeight: 0.92,
            letterSpacing: "0.005em",
            color: "var(--bone)",
          }}
        >
          Astra<span style={{ color: "var(--signal)" }}>Sovereign</span>
        </span>
        {tagline && (
          <>
            <span
              aria-hidden="true"
              style={{ display: "block", height: 1, background: "var(--ash)", margin: `${Math.max(3, size * 0.16)}px 0 ${Math.max(2, size * 0.1)}px` }}
            />
            <span
              className="font-mono uppercase truncate"
              style={{ fontSize: Math.max(7.5, size * 0.33), letterSpacing: "0.34em", color: "var(--granite)" }}
            >
              {taglineText}
            </span>
          </>
        )}
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
