"use client";

import * as React from "react";
import { gsap } from "gsap";
import { AstraMark } from "@/components/brand/AstraMark";
import { useGsap, prefersReducedMotion, CountUp } from "@/lib/motion";
import { PAGE, Eyebrow } from "@/components/landing/atoms";
import { MODEL_ROSTER, EMBEDDING_MODEL } from "@/lib/metrics";

/**
 * The mark, given its own room — drawn as a chart rather than a logo.
 *
 * The hexagon field behind the mark is the chart's scale: each ring is one
 * gigabyte of declared GPU reservation, on the mark's own geometry. The
 * orange polygon is the reservation itself, one vertex per wedge, so its
 * shape is information — math sits inside the others because it is the 2 GB
 * model among four 4 GB ones.
 *
 * Six wedges, six models. Five are the routed capabilities declared in
 * config/models.yaml. The sixth is nomic-embed-text, which is not routed and
 * has no reservation declared for it — its vertex sits on the floor of the
 * chart for exactly that reason — but it is the model that decides between
 * the other five: the capability classifier embeds each task and picks the
 * nearest one, and document search runs on it too.
 *
 * Every figure comes from metrics.ts, and verify-metrics checks those against
 * models.yaml and config.py, so the drawing cannot drift from the config.
 *
 * Nothing on this plate rotates. The motion is arrival (rings, polygon,
 * cards) and one quiet signal: a pulse running down each spoke into the core.
 */

/* ------------------------------------------------------------ geometry */

const VIEW = 340; // viewBox half-size
const MARK_R = 124; // radius the mark occupies, in viewBox units
const SCALE_FLOOR = 136; // 0 GB on the chart
const SCALE_STEP = 22; // one GB of reservation
const CHIP_R = 232; // where the capability cards anchor
const CHIP_W = 188;
const CHIP_H = 96;

function polar(angleDeg: number, radius: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}

function hexPoints(radius: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => polar(60 * i - 90, radius).map((n) => n.toFixed(2)).join(","))
    .join(" ");
}

function gbRadius(vramMb: number): number {
  return SCALE_FLOOR + (vramMb / 1024) * SCALE_STEP;
}

/* --------------------------------------------------------------- data */

interface Wedge {
  index: number;
  name: string;
  role: string;
  model: string;
  /** Declared GPU reservation; null when the scheduler reserves nothing. */
  vramMb: number | null;
}

const ROLE: Record<string, string> = {
  document: "reads your files",
  vision: "reads scans",
  coding: "writes & runs code",
  math: "checks arithmetic",
  general: "reasons & drafts",
};

const VERTEX_OF: Record<string, number> = {
  document: 0,
  vision: 1,
  coding: 2,
  math: 3,
  general: 4,
};

const WEDGES: Wedge[] = [
  ...MODEL_ROSTER.map((entry) => ({
    index: VERTEX_OF[entry.capability] ?? 0,
    name: entry.capability,
    role: ROLE[entry.capability] ?? "",
    model: entry.model.replace(/:latest$/, ""),
    vramMb: entry.vram_mb as number,
  })),
  {
    index: 5,
    name: "embed",
    role: "picks the capability",
    model: EMBEDDING_MODEL.model,
    vramMb: null,
  },
].sort((a, b) => a.index - b.index);

const MAX_GB = Math.max(...WEDGES.map((w) => (w.vramMb ?? 0) / 1024));
const RESERVED_GB = WEDGES.reduce((sum, w) => sum + (w.vramMb ?? 0), 0) / 1024;
const SCALE_RINGS = Array.from({ length: Math.ceil(MAX_GB) }, (_, i) => i + 1);

const RADAR_POINTS = WEDGES.map((w) =>
  polar(60 * w.index - 90, w.vramMb === null ? SCALE_FLOOR : gbRadius(w.vramMb))
    .map((n) => n.toFixed(2))
    .join(","),
).join(" ");

/* --------------------------------------------------------- corner cards */

interface CornerStat {
  label: string;
  value: string;
  corner: "tl" | "tr" | "bl" | "br";
  /** Numeric stats count up on entry; "0 bytes" has nowhere to count from. */
  count?: number;
}

const STATS: CornerStat[] = [
  { label: "Cloud egress", value: "0 bytes", corner: "tl" },
  { label: "Routed models", value: "5", corner: "tr", count: 5 },
  { label: "Agent tools", value: "12", corner: "bl", count: 12 },
  { label: "Backend tests", value: "819", corner: "br", count: 819 },
];

const CORNER_STYLE: Record<CornerStat["corner"], React.CSSProperties> = {
  tl: { left: 0, top: "6%" },
  tr: { right: 0, top: "6%" },
  bl: { left: 0, bottom: "6%" },
  br: { right: 0, bottom: "6%" },
};

const READOUT: { k: string; v: string }[] = [
  { k: "Router", v: "config/models.yaml" },
  { k: "Classifier", v: EMBEDDING_MODEL.model },
  { k: "Reserved if all five load", v: `${RESERVED_GB.toFixed(0)} GB VRAM` },
  { k: "Fallback", v: "bounded · 2 hops" },
];

function StatCard({ stat }: { stat: CornerStat }) {
  const fromLeft = stat.corner === "tl" || stat.corner === "bl";
  return (
    <div
      data-mark-card
      data-from={fromLeft ? "left" : "right"}
      className="absolute hidden lg:block"
      style={{ ...CORNER_STYLE[stat.corner], width: 186 }}
    >
      <span
        className="inline-block font-mono uppercase"
        style={{ fontSize: 10.5, letterSpacing: "0.06em", background: "var(--signal)", color: "#101010", padding: "4px 9px" }}
      >
        {stat.label}
      </span>
      <div
        style={{
          background: "var(--bone)",
          color: "var(--canvas)",
          padding: "10px 12px",
          fontFamily: "var(--display)",
          fontVariationSettings: "'wdth' 84",
          fontWeight: 500,
          fontSize: 27,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {stat.count !== undefined ? <CountUp value={stat.count} /> : stat.value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ capability card */

function chipOrigin(index: number): { x: number; y: number } {
  const angle = 60 * index - 90;
  const [ax, ay] = polar(angle, CHIP_R);
  const cos = Math.cos((angle * Math.PI) / 180);
  if (cos > 0.1) return { x: ax + 6, y: ay - CHIP_H / 2 };
  if (cos < -0.1) return { x: ax - 6 - CHIP_W, y: ay - CHIP_H / 2 };
  return ay < 0 ? { x: -CHIP_W / 2, y: ay - CHIP_H + 8 } : { x: -CHIP_W / 2, y: ay - 8 };
}

function CapabilityCard({
  wedge,
  active,
  onEnter,
  onLeave,
}: {
  wedge: Wedge;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { x, y } = chipOrigin(wedge.index);
  const routed = wedge.vramMb !== null;
  const segments = 8;
  const filled = routed ? Math.round(((wedge.vramMb as number) / 1024 / MAX_GB) * segments) : 0;

  return (
    <foreignObject x={x} y={y} width={CHIP_W} height={CHIP_H} data-chip style={{ overflow: "visible" }}>
      <div
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{
          height: "100%",
          boxSizing: "border-box",
          padding: "9px 11px 9px 12px",
          background: "var(--canvas)",
          border: `1px solid ${active ? "var(--signal)" : "var(--carbon)"}`,
          borderLeft: `2px solid ${routed ? "var(--signal)" : "var(--metric)"}`,
          borderRadius: 3,
          boxShadow: active ? "0 0 0 3px color-mix(in srgb, var(--signal) 14%, transparent)" : "none",
          transition: "border-color 200ms, box-shadow 200ms",
          cursor: "default",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 13.5,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--bone)",
            }}
          >
            {wedge.name}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--graphite)" }}>
            0{wedge.index + 1}
          </span>
        </div>
        {/* Model and role on their own lines: sharing one line truncated
            both at any card width the plate has room for. */}
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--stone)", whiteSpace: "nowrap" }}>
          {wedge.model}
        </div>
        <div style={{ fontSize: 12, color: "var(--granite)", whiteSpace: "nowrap", marginTop: -2 }}>
          {wedge.role}
        </div>
        {routed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ display: "flex", gap: 2, flex: 1 }}>
              {Array.from({ length: segments }, (_, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: 5,
                    background: i < filled ? "var(--signal)" : "var(--carbon)",
                  }}
                />
              ))}
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--signal)", whiteSpace: "nowrap" }}>
              {((wedge.vramMb as number) / 1024).toFixed(0)} GB
            </span>
          </div>
        ) : (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--metric)", whiteSpace: "nowrap" }}>
            not routed · 0 GB
          </div>
        )}
      </div>
    </foreignObject>
  );
}

/* ----------------------------------------------------------- the plate */

export function MarkSection() {
  const [active, setActive] = React.useState<number | null>(null);

  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;

    const rings = element.querySelectorAll("[data-ring]");
    const scale = element.querySelectorAll("[data-scale]");
    const radar = element.querySelector("[data-radar]");
    const dots = element.querySelectorAll("[data-vertex]");
    const spokes = element.querySelectorAll("[data-spoke]");
    const chips = element.querySelectorAll("[data-chip]");
    const cards = element.querySelectorAll<HTMLElement>("[data-mark-card]");
    const readout = element.querySelectorAll("[data-readout]");
    const pulses = element.querySelectorAll<SVGCircleElement>("[data-pulse]");
    const mark = element.querySelector("[data-mark]");

    gsap.set(rings, { opacity: 0, scale: 0.6, transformOrigin: "center" });
    gsap.set(scale, { opacity: 0 });
    gsap.set(radar, { opacity: 0, scale: 0.4, transformOrigin: "center" });
    gsap.set(dots, { scale: 0, transformOrigin: "center", transformBox: "fill-box" });
    gsap.set(spokes, { opacity: 0 });
    gsap.set(chips, { opacity: 0 });
    gsap.set(cards, { opacity: 0, x: (_i, el) => ((el as HTMLElement).dataset.from === "left" ? -24 : 24) });
    gsap.set(readout, { opacity: 0, y: 10 });
    gsap.set(pulses, { opacity: 0 });
    gsap.set(mark, { opacity: 0, scale: 0.88 });

    const tl = gsap.timeline({ scrollTrigger: { trigger: element, start: "top 72%", once: true } });
    tl.to(mark, { opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" })
      .to(rings, { opacity: 1, scale: 1, duration: 0.8, stagger: 0.06, ease: "power2.out" }, 0.1)
      .to(scale, { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.55)
      .to(spokes, { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.5)
      // The reservation draws last among the chart marks: it is the result.
      .to(radar, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" }, 0.65)
      .to(dots, { scale: 1, duration: 0.35, stagger: 0.05, ease: "back.out(2.4)" }, 0.95)
      .to(chips, { opacity: 1, duration: 0.45, stagger: 0.07, ease: "power2.out" }, 0.9)
      .to(cards, { opacity: 1, x: 0, duration: 0.55, stagger: 0.08, ease: "power3.out" }, 0.8)
      .to(readout, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power3.out" }, 1.1);

    // One pulse per spoke, travelling inward from the card to the core — the
    // section's title, animated. Offsets keep the six from marching in step.
    pulses.forEach((pulse, i) => {
      const angle = Number(pulse.dataset.angle ?? 0);
      const [fx, fy] = polar(angle, CHIP_R - 10);
      const [tx, ty] = polar(angle, MARK_R + 6);
      gsap
        .timeline({ repeat: -1, repeatDelay: 1.8, delay: 1.6 + i * 0.55 })
        .set(pulse, { attr: { cx: fx, cy: fy }, opacity: 0 })
        .to(pulse, { opacity: 1, duration: 0.2 })
        .to(pulse, { attr: { cx: tx, cy: ty }, duration: 1.3, ease: "power1.in" }, 0)
        .to(pulse, { opacity: 0, duration: 0.25 }, 1.1);
    });
  }, []);

  return (
    <section ref={ref} style={{ position: "relative", paddingTop: 120, overflow: "hidden" }}>
      {/* Vertical scanlines — the band's own texture, one gradient, static. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(90deg, color-mix(in srgb, var(--signal) 13%, transparent) 0 1px, transparent 1px 34px)",
          maskImage: "radial-gradient(64% 54% at 50% 52%, #000 10%, transparent 74%)",
          WebkitMaskImage: "radial-gradient(64% 54% at 50% 52%, #000 10%, transparent 74%)",
          opacity: 0.5,
        }}
      />

      <div className={PAGE} style={{ position: "relative" }}>
        <div className="flex flex-col items-center text-center">
          <Eyebrow>Five routed capabilities · one classifier</Eyebrow>
          <h2 className="display-m" style={{ margin: "18px 0 0", color: "var(--bone)", maxWidth: "18ch" }}>
            Everything reports to the same core.
          </h2>
        </div>

        <div style={{ position: "relative", height: 640, marginTop: 28 }}>
          <svg
            viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
            role="img"
            aria-label={`Declared GPU reservation per capability: ${WEDGES.map((w) => `${w.name} ${w.vramMb === null ? "none" : `${w.vramMb / 1024} GB`}`).join(", ")}.`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
          >
            <defs>
              <radialGradient id="mark-radar-fill" cx="0" cy="0" r="210" gradientUnits="userSpaceOnUse">
                <stop offset="55%" stopColor="var(--signal)" stopOpacity="0.02" />
                <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.16" />
              </radialGradient>
            </defs>

            {/* Two atmospheric rings outside the scale, static. */}
            {[272, 306].map((r) => (
              <polygon
                key={r}
                data-ring
                points={hexPoints(r)}
                fill="none"
                stroke="var(--ash)"
                strokeWidth="0.8"
                strokeOpacity="0.35"
                strokeDasharray="2 6"
              />
            ))}

            {/* The scale: floor plus one ring per gigabyte. */}
            <polygon data-ring points={hexPoints(SCALE_FLOOR)} fill="none" stroke="var(--ash)" strokeWidth="1" strokeOpacity="0.7" />
            {SCALE_RINGS.map((gb) => (
              <polygon
                key={gb}
                data-ring
                points={hexPoints(SCALE_FLOOR + gb * SCALE_STEP)}
                fill="none"
                stroke="var(--signal)"
                strokeWidth="0.8"
                strokeOpacity={0.14 + gb * 0.04}
              />
            ))}
            {SCALE_RINGS.map((gb) => {
              const [x, y] = polar(-60, (SCALE_FLOOR + gb * SCALE_STEP) * Math.cos(Math.PI / 6));
              return (
                <text
                  key={gb}
                  data-scale
                  x={x + 4}
                  y={y}
                  dominantBaseline="middle"
                  fill="var(--graphite)"
                  style={{ fontFamily: "var(--mono)", fontSize: 10 }}
                >
                  {gb}G
                </text>
              );
            })}

            {/* Spokes: core edge out to the card, dashed; solid when hovered. */}
            {WEDGES.map((w) => {
              const angle = 60 * w.index - 90;
              const [x1, y1] = polar(angle, MARK_R + 4);
              const [x2, y2] = polar(angle, CHIP_R - 6);
              const on = active === w.index;
              return (
                <g key={w.name} data-spoke>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={on ? "var(--signal)" : "var(--ash)"}
                    strokeWidth={on ? 1.3 : 1}
                    strokeDasharray={on ? undefined : "3 4"}
                    style={{ transition: "stroke 200ms" }}
                  />
                  <circle data-pulse data-angle={angle} r="2.6" fill="var(--signal)" cx={x2} cy={y2} opacity="0" />
                </g>
              );
            })}

            {/* The reservation itself. */}
            <polygon
              data-radar
              points={RADAR_POINTS}
              fill="url(#mark-radar-fill)"
              stroke="var(--signal)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {WEDGES.map((w) => {
              const [x, y] = polar(60 * w.index - 90, w.vramMb === null ? SCALE_FLOOR : gbRadius(w.vramMb));
              const on = active === w.index;
              return (
                <circle
                  key={w.name}
                  data-vertex
                  cx={x}
                  cy={y}
                  r={on ? 5.5 : 3.6}
                  fill={w.vramMb === null ? "var(--metric)" : "var(--signal)"}
                  stroke="var(--canvas)"
                  strokeWidth="2"
                  style={{ transition: "r 200ms" }}
                />
              );
            })}

            {WEDGES.map((w) => (
              <CapabilityCard
                key={w.name}
                wedge={w}
                active={active === w.index}
                onEnter={() => setActive(w.index)}
                onLeave={() => setActive(null)}
              />
            ))}
          </svg>

          <div data-mark className="absolute left-1/2 top-1/2" style={{ transform: "translate(-50%, -50%)" }}>
            <AstraMark size={196} interactive />
          </div>

          {STATS.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>

        {/* Legend: what the two kinds of mark on the chart mean. */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 font-mono"
          style={{ fontSize: 11, color: "var(--granite)", marginTop: 2, marginBottom: 18 }}
        >
          <span className="inline-flex items-center gap-2">
            <span style={{ width: 16, height: 0, borderTop: "1.5px solid var(--signal)" }} />
            declared GPU reservation · rings are 1 GB apart
          </span>
          <span className="inline-flex items-center gap-2">
            <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--metric)" }} />
            classifier · runs on the same Ollama, nothing reserved
          </span>
        </div>

        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            border: "1px solid var(--carbon)",
            background: "var(--carbon)",
          }}
        >
          {READOUT.map((row) => (
            <div key={row.k} data-readout style={{ background: "var(--canvas)", padding: "14px 16px" }}>
              <span className="block font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--graphite)" }}>
                {row.k}
              </span>
              <span className="block font-mono" style={{ marginTop: 6, fontSize: 13, color: "var(--bone)" }}>
                {row.v}
              </span>
            </div>
          ))}
        </div>

        <p
          className="mx-auto text-center"
          style={{ maxWidth: "64ch", marginTop: 26, fontSize: 15.5, lineHeight: 1.6, color: "var(--granite)" }}
        >
          Reasoning, code, maths, documents and vision each resolve to a local model through one
          config file. The sixth wedge is the embedding model that decides between them: it reads
          each task and picks the nearest capability. All six run on your own hardware, behind a
          core with no outbound route — and every figure on this plate is checked against the
          config it came from.
        </p>
      </div>
    </section>
  );
}

export default MarkSection;
