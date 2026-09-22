"use client";

import * as React from "react";
import { gsap } from "gsap";
import { AstraMark } from "@/components/brand/AstraMark";
import { useGsap, prefersReducedMotion } from "@/lib/motion";
import { PAGE, Eyebrow } from "@/components/landing/atoms";
import { CountUp } from "@/lib/motion";
import { MODEL_ROSTER } from "@/lib/metrics";

/**
 * The mark, given its own room.
 *
 * The growth field owns the hero; putting the logo there too would set two
 * focal objects fighting over the same glance. Here the mark gets a band of
 * its own, built as a technical plate rather than a logo presentation:
 * concentric hexagons on the mark's own geometry, a counter-rotating tick
 * ring, five labelled spokes for the five capabilities the router can
 * actually resolve, and the four verified numbers pinned at the corners on
 * leader lines.
 *
 * On the capability count: config/models.yaml declares five — general,
 * coding, math, document and vision. The mark has six wedges, so one vertex
 * carries no label. That is not a drafting error and it is not padded to
 * make the geometry tidy: the sixth slot is empty because adding a
 * capability is a config change, and the page says the true number.
 */

const RINGS = 9;
const TICKS = 72;

/** Hexagon points for a given radius, flat-top to match AstraMark. */
function hexPoints(radius: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      return `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`;
    })
    .join(" ");
}

function polar(angleDeg: number, radius: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}

interface Spoke {
  /** Vertex index, 0 = top, clockwise. */
  index: number;
  label: string;
  model: string;
  vramMb: number;
}

/**
 * The five capabilities, read straight out of metrics.ts so this plate cannot
 * drift from config/models.yaml. The vertex assignment is the only thing
 * chosen here; the names, models and VRAM figures are the measured ones.
 */
const VERTEX_OF: Record<string, number> = {
  document: 0,
  vision: 1,
  coding: 2,
  math: 3,
  general: 4,
};

const SPOKES: Spoke[] = MODEL_ROSTER.map((entry) => ({
  index: VERTEX_OF[entry.capability] ?? 0,
  label: entry.capability,
  model: entry.model.replace(/:latest$/, ""),
  vramMb: entry.vram_mb,
})).sort((a, b) => a.index - b.index);

const MAX_VRAM = Math.max(...SPOKES.map((s) => s.vramMb));
const TOTAL_VRAM_GB = SPOKES.reduce((sum, s) => sum + s.vramMb, 0) / 1024;

/** Radar radius for a VRAM figure: the polygon *is* the footprint. */
const RADAR_BASE = 138;
const RADAR_SPAN = 72;
function radarRadius(vramMb: number): number {
  return RADAR_BASE + (vramMb / MAX_VRAM) * RADAR_SPAN;
}

/** The radar polygon over all six vertices; the empty slot sits at the base. */
const RADAR_POINTS = Array.from({ length: 6 }, (_, i) => {
  const spoke = SPOKES.find((s) => s.index === i);
  const r = spoke ? radarRadius(spoke.vramMb) : RADAR_BASE;
  const [x, y] = polar(60 * i - 90, r);
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}).join(" ");

const EMPTY_SLOT = 5;

interface CornerStat {
  label: string;
  value: string;
  corner: "tl" | "tr" | "bl" | "br";
  /** Numeric stats count up on entry; "0 bytes" has nowhere to count from. */
  count?: number;
}

const STATS: CornerStat[] = [
  { label: "Cloud egress", value: "0 bytes", corner: "tl" },
  { label: "Local models", value: "5", corner: "tr", count: 5 },
  { label: "Agent tools", value: "11", corner: "bl", count: 11 },
  { label: "Backend tests", value: "552", corner: "br", count: 552 },
];

const CORNER_STYLE: Record<CornerStat["corner"], React.CSSProperties> = {
  tl: { left: 0, top: "10%" },
  tr: { right: 0, top: "10%" },
  bl: { left: 0, bottom: "10%" },
  br: { right: 0, bottom: "10%" },
};

/** Mono readout under the plate — the routing contract, and what it costs. */
const READOUT: { k: string; v: string }[] = [
  { k: "Router", v: "config/models.yaml" },
  { k: "Resident if all five load", v: `${TOTAL_VRAM_GB.toFixed(0)} GB VRAM` },
  { k: "Fallback", v: "bounded · 2 hops" },
  { k: "Substitutions", v: "recorded, never silent" },
];

function StatCard({ stat }: { stat: CornerStat }) {
  const fromLeft = stat.corner === "tl" || stat.corner === "bl";
  return (
    <div
      data-mark-card
      data-from={fromLeft ? "left" : "right"}
      className="absolute hidden md:block"
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
          color: "#101010",
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
      {/* Leader line into the field, the way a callout is drawn on a plate. */}
      <span
        data-leader
        aria-hidden="true"
        className="absolute"
        style={{
          top: "calc(100% + 1px)",
          [fromLeft ? "left" : "right"]: 12,
          width: 1,
          height: 44,
          background: "linear-gradient(to bottom, var(--ash), transparent)",
        }}
      />
    </div>
  );
}

export function MarkSection() {
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;

    const rings = element.querySelectorAll<SVGPolygonElement>("[data-ring]");
    const cards = element.querySelectorAll<HTMLElement>("[data-mark-card]");
    const spokes = element.querySelectorAll<SVGGElement>("[data-spoke]");
    const radar = element.querySelector<SVGPolygonElement>("[data-radar]");
    const pulses = element.querySelectorAll<SVGCircleElement>("[data-pulse]");
    const readout = element.querySelectorAll<HTMLElement>("[data-readout]");
    const mark = element.querySelector<HTMLElement>("[data-mark]");

    gsap.set(rings, { scale: 0.2, opacity: 0, transformOrigin: "center" });
    gsap.set(cards, { opacity: 0, x: (i, el) => (el.dataset.from === "left" ? -28 : 28) });
    gsap.set(spokes, { opacity: 0 });
    if (radar) gsap.set(radar, { scale: 0.55, opacity: 0, transformOrigin: "center" });
    gsap.set(pulses, { opacity: 0 });
    gsap.set(readout, { opacity: 0, y: 10 });
    if (mark) gsap.set(mark, { scale: 0.86, opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: { trigger: element, start: "top 74%", once: true },
    });
    if (mark) tl.to(mark, { scale: 1, opacity: 1, duration: 0.7, ease: "power3.out" });
    // Rings propagate outward from the mark, one after another.
    tl.to(rings, { scale: 1, opacity: 1, duration: 0.9, stagger: 0.07, ease: "power2.out" }, 0.18);
    // Then the spokes fire, clockwise from the top.
    tl.to(spokes, { opacity: 1, duration: 0.4, stagger: 0.08, ease: "power2.out" }, 0.62);
    tl.to(cards, { opacity: 1, x: 0, duration: 0.55, stagger: 0.09, ease: "power3.out" }, 0.5);
    tl.to(readout, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power3.out" }, 0.9);
    // The radar settles into shape last, so the footprint reads as a result
    // rather than as another piece of the scaffolding.
    if (radar) tl.to(radar, { scale: 1, opacity: 1, duration: 0.85, ease: "power3.out" }, 0.72);

    // Each pulse runs from its capability down its own spoke into the core,
    // then repeats on its own offset so the five never march in step.
    pulses.forEach((pulse, i) => {
      const angle = Number(pulse.dataset.angle ?? 0);
      const rad = (angle * Math.PI) / 180;
      const from = { x: Math.cos(rad) * 202, y: Math.sin(rad) * 202 };
      const to = { x: Math.cos(rad) * 132, y: Math.sin(rad) * 132 };
      gsap.fromTo(
        pulse,
        { attr: { cx: from.x, cy: from.y }, opacity: 0 },
        {
          attr: { cx: to.x, cy: to.y },
          opacity: 1,
          duration: 1.5,
          ease: "power1.in",
          repeat: -1,
          repeatDelay: 2.6,
          delay: 1.4 + i * 0.44,
          yoyo: false,
          onRepeat: () => gsap.set(pulse, { opacity: 0 }),
        },
      );
      // Fade out as it arrives, so it reads as absorbed rather than stopping.
      gsap.to(pulse, {
        opacity: 0,
        duration: 0.32,
        repeat: -1,
        repeatDelay: 3.78,
        delay: 1.4 + i * 0.44 + 1.18,
      });
    });

    // Two slow rotations in opposite directions. Neither asks for attention;
    // together they keep the plate from reading as a static image.
    gsap.to(element.querySelector("[data-ring-group]"), {
      rotation: 360,
      duration: 260,
      repeat: -1,
      ease: "none",
      transformOrigin: "center",
    });
    gsap.to(element.querySelector("[data-tick-group]"), {
      rotation: -360,
      duration: 180,
      repeat: -1,
      ease: "none",
      transformOrigin: "center",
    });

    // The sweep is the one fast thing here: eight seconds a revolution, which
    // is slow for a scope and still the quickest element on the plate.
    gsap.to(element.querySelector("[data-sweep]"), {
      rotation: 360,
      duration: 8,
      repeat: -1,
      ease: "none",
      transformOrigin: "center",
    });
  }, []);

  return (
    <section ref={ref} style={{ position: "relative", paddingTop: 128, overflow: "hidden" }}>
      {/* Vertical scanlines — the band's own texture, one gradient. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(90deg, color-mix(in srgb, var(--signal) 16%, transparent) 0 1px, transparent 1px 34px)",
          maskImage: "radial-gradient(70% 58% at 50% 50%, #000 12%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(70% 58% at 50% 50%, #000 12%, transparent 76%)",
          opacity: 0.6,
        }}
      />

      <div className={PAGE} style={{ position: "relative" }}>
        <div className="flex flex-col items-center text-center">
          <Eyebrow>One root, five capabilities</Eyebrow>
          <h2 className="display-m" style={{ margin: "18px 0 0", color: "var(--bone)", maxWidth: "18ch" }}>
            Everything reports to the same core.
          </h2>
        </div>

        <div style={{ position: "relative", height: 560, marginTop: 36 }}>
          <svg
            viewBox="-320 -320 640 640"
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
          >
            <g data-ring-group>
              {Array.from({ length: RINGS }).map((_, i) => (
                <polygon
                  key={i}
                  data-ring
                  points={hexPoints(70 + i * 27)}
                  fill="none"
                  stroke="var(--signal)"
                  strokeWidth={i === 0 ? 1.4 : 1}
                  strokeOpacity={0.42 - i * 0.036}
                />
              ))}
            </g>

            {/* Tick ring: a degree scale, every sixth tick long. */}
            <g data-tick-group>
              {Array.from({ length: TICKS }).map((_, i) => {
                const angle = (360 / TICKS) * i - 90;
                const major = i % 6 === 0;
                const [x1, y1] = polar(angle, 262);
                const [x2, y2] = polar(angle, major ? 278 : 270);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--bone)"
                    strokeWidth={major ? 1.2 : 0.7}
                    strokeOpacity={major ? 0.5 : 0.24}
                  />
                );
              })}
            </g>

            {/*
              The VRAM radar. Each vertex is pushed out by that capability's
              resident footprint, so the polygon is the footprint rather than a
              decoration of it — and the collapse toward the unfilled sixth
              vertex is the empty slot, drawn.
            */}
            <defs>
              <linearGradient id="radar-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="sweep-fade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.13" />
                <stop offset="55%" stopColor="var(--signal)" stopOpacity="0.04" />
                <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Scope sweep: one wedge, rotating. The oldest instrument idiom
                there is, and the only thing on the plate that moves quickly. */}
            <g data-sweep>
              <path
                d={`M 0 0 L ${(Math.cos(-Math.PI / 2) * 252).toFixed(2)} ${(Math.sin(-Math.PI / 2) * 252).toFixed(2)} A 252 252 0 0 1 ${(Math.cos(-Math.PI / 2 + 0.44) * 252).toFixed(2)} ${(Math.sin(-Math.PI / 2 + 0.44) * 252).toFixed(2)} Z`}
                fill="url(#sweep-fade)"
              />
            </g>

            <polygon
              data-radar
              points={RADAR_POINTS}
              fill="url(#radar-fill)"
              stroke="var(--signal)"
              strokeWidth="1.4"
              strokeOpacity="0.75"
            />

            {/* Five capability spokes, plus the empty sixth slot. */}
            <g>
              {SPOKES.map((spoke) => {
                const angle = 60 * spoke.index - 90;
                const right = Math.cos((angle * Math.PI) / 180) > 0.1;
                const left = Math.cos((angle * Math.PI) / 180) < -0.1;
                const anchor = right ? "start" : left ? "end" : "middle";
                // A vertical spoke stacks its two lines straight down the
                // spoke, so it needs the extra clearance the side ones do not.
                const vertical = !right && !left;
                const [x1, y1] = polar(angle, 132);
                const [x2, y2] = polar(angle, 202);
                const [lx, ly] = polar(angle, vertical ? 240 : 216);
                return (
                  <g key={spoke.label} data-spoke>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--signal)" strokeWidth="1" strokeOpacity="0.5" />
                    {/* Everything reports to the core, so the pulse runs
                        inward — from the capability to the centre. */}
                    <circle data-pulse data-angle={angle} r="2.4" fill="var(--signal)" cx={x2} cy={y2} />
                    <rect x={x2 - 3.5} y={y2 - 3.5} width="7" height="7" fill="var(--canvas)" stroke="var(--signal)" strokeWidth="1.1" />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      fill="var(--bone)"
                      style={{ fontFamily: "var(--mono)", fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}
                    >
                      {spoke.label}
                    </text>
                    <text
                      x={lx}
                      y={ly + 16}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      fill="var(--graphite)"
                      style={{ fontFamily: "var(--mono)", fontSize: 11 }}
                    >
                      {spoke.model}
                    </text>
                    <text
                      x={lx}
                      y={ly + 30}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      fill="var(--signal)"
                      style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}
                    >
                      {(spoke.vramMb / 1024).toFixed(0)} GB VRAM
                    </text>
                  </g>
                );
              })}

              {/* The unfilled sixth wedge: a node, no label, no invented name. */}
              {(() => {
                const angle = 60 * EMPTY_SLOT - 90;
                const [x1, y1] = polar(angle, 132);
                const [x2, y2] = polar(angle, 202);
                const [lx, ly] = polar(angle, 216);
                return (
                  <g data-spoke>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="var(--ash)"
                      strokeWidth="1"
                      strokeDasharray="3 5"
                    />
                    <rect x={x2 - 3.5} y={y2 - 3.5} width="7" height="7" fill="var(--canvas)" stroke="var(--ash)" strokeWidth="1.1" />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="var(--graphite)"
                      style={{ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}
                    >
                      slot free
                    </text>
                    <text
                      x={lx}
                      y={ly + 15}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="var(--graphite)"
                      style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}
                    >
                      add in models.yaml
                    </text>
                  </g>
                );
              })()}
            </g>
          </svg>

          <div
            data-mark
            className="absolute left-1/2 top-1/2"
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <AstraMark size={190} interactive />
          </div>

          {STATS.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>

        {/* Readout strip: the routing contract, stated rather than implied. */}
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            border: "1px solid var(--carbon)",
            background: "var(--carbon)",
            marginTop: 8,
          }}
        >
          {READOUT.map((row) => (
            <div key={row.k} data-readout style={{ background: "var(--canvas)", padding: "13px 16px" }}>
              <span className="block font-mono uppercase" style={{ fontSize: 9.5, letterSpacing: "0.16em", color: "var(--graphite)" }}>
                {row.k}
              </span>
              <span className="block font-mono" style={{ marginTop: 6, fontSize: 12.5, color: "var(--bone)" }}>
                {row.v}
              </span>
            </div>
          ))}
        </div>

        <p
          className="mx-auto text-center"
          style={{ maxWidth: "62ch", marginTop: 26, fontSize: 15.5, lineHeight: 1.55, color: "var(--granite)" }}
        >
          Reasoning, code, maths, documents and vision each resolve to a local model through
          one config file — five capabilities, and a sixth wedge left empty because adding one
          is a config change, not a rebuild. The core they report to is a sealed process on
          your own hardware: it has no outbound route, and the numbers above are measured, not
          claimed.
        </p>
      </div>
    </section>
  );
}

export default MarkSection;
