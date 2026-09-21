"use client";

import * as React from "react";
import { gsap } from "gsap";
import { AstraMark } from "@/components/brand/AstraMark";
import { useGsap, prefersReducedMotion } from "@/lib/motion";
import { PAGE, Eyebrow } from "@/components/landing/atoms";

/**
 * The mark, given its own room.
 *
 * The growth field owns the hero; putting the logo there too would set two
 * focal objects fighting over the same glance. Here the mark gets a band of
 * its own: concentric hexagons radiating out of it on the same geometry as
 * the mark's own six wedges, over vertical scanlines, with the four verified
 * headline numbers pinned at the corners.
 *
 * The rings are drawn from one polygon scaled up — same shape, same angles —
 * so the field reads as the mark propagating outward rather than as
 * decoration placed behind it.
 */

const RINGS = 9;

/** Hexagon points for a given radius, flat-top to match AstraMark. */
function hexPoints(radius: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      return `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`;
    })
    .join(" ");
}

interface CornerStat {
  label: string;
  value: string;
  corner: "tl" | "tr" | "bl" | "br";
}

const STATS: CornerStat[] = [
  { label: "Cloud egress", value: "0 bytes", corner: "tl" },
  { label: "Local models", value: "5", corner: "tr" },
  { label: "Agent tools", value: "11", corner: "bl" },
  { label: "Backend tests", value: "552", corner: "br" },
];

const CORNER_STYLE: Record<CornerStat["corner"], React.CSSProperties> = {
  tl: { left: 0, top: "12%" },
  tr: { right: 0, top: "12%" },
  bl: { left: 0, bottom: "12%" },
  br: { right: 0, bottom: "12%" },
};

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
        {stat.value}
      </div>
    </div>
  );
}

export function MarkSection() {
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;

    const rings = element.querySelectorAll<SVGPolygonElement>("[data-ring]");
    const cards = element.querySelectorAll<HTMLElement>("[data-mark-card]");
    const mark = element.querySelector<HTMLElement>("[data-mark]");

    gsap.set(rings, { scale: 0.2, opacity: 0, transformOrigin: "center" });
    gsap.set(cards, { opacity: 0, x: (i, el) => (el.dataset.from === "left" ? -28 : 28) });
    if (mark) gsap.set(mark, { scale: 0.86, opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: { trigger: element, start: "top 74%", once: true },
    });
    if (mark) tl.to(mark, { scale: 1, opacity: 1, duration: 0.7, ease: "power3.out" });
    // Rings propagate outward from the mark, one after another.
    tl.to(rings, { scale: 1, opacity: 1, duration: 0.9, stagger: 0.07, ease: "power2.out" }, 0.18);
    tl.to(cards, { opacity: 1, x: 0, duration: 0.55, stagger: 0.09, ease: "power3.out" }, 0.5);

    // A slow counter-rotation keeps the field alive without asking for
    // attention — one degree every few seconds, transform only.
    gsap.to(element.querySelector("[data-ring-group]"), {
      rotation: 360,
      duration: 260,
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
          <Eyebrow>One root, six capabilities</Eyebrow>
          <h2 className="display-m" style={{ margin: "18px 0 0", color: "var(--bone)", maxWidth: "18ch" }}>
            Everything reports to the same core.
          </h2>
        </div>

        <div style={{ position: "relative", height: 520, marginTop: 40 }}>
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

        <p
          className="mx-auto text-center"
          style={{ maxWidth: "58ch", marginTop: 8, fontSize: 15.5, lineHeight: 1.55, color: "var(--granite)" }}
        >
          Reasoning, code, maths, documents, vision and embeddings each resolve to a local
          model through one config file. The core they report to is a sealed process on your
          own hardware — it has no outbound route, and the numbers above are measured, not claimed.
        </p>
      </div>
    </section>
  );
}

export default MarkSection;
