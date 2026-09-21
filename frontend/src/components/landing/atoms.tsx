"use client";

import * as React from "react";
import { gsap } from "gsap";
import { CountUp, Reveal, Scramble, useGsap, prefersReducedMotion } from "@/lib/motion";

export const PAGE = "mx-auto w-full max-w-[1200px] px-6 md:px-10";

/** Mono eyebrow with a live dot. Scrambles in when it reaches the viewport. */
export function Eyebrow({ children, dot = true }: { children: string; dot?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 font-mono uppercase"
      style={{ fontSize: 12, letterSpacing: "-0.02em", color: "var(--stone)" }}
    >
      {dot && <PulseDot />}
      <Scramble>{children}</Scramble>
    </span>
  );
}

/** The live-state dot. One animation, and it means something: this is on. */
export function PulseDot({ color = "var(--signal)", size = 6 }: { color?: string; size?: number }) {
  return (
    <span className="astra-pulse" style={{ width: size, height: size, background: color }} aria-hidden="true" />
  );
}

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ paddingTop: 128, scrollMarginTop: 80 }}>
      <div className={PAGE}>
        <Reveal stagger={0.08}>
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
          <h2 className="display-m" style={{ margin: "20px 0 0", color: "var(--bone)", maxWidth: "22ch" }}>
            {title}
          </h2>
          {lede && (
            <p style={{ margin: "18px 0 0", maxWidth: "62ch", fontSize: 16.5, lineHeight: 1.5, color: "var(--granite)" }}>
              {lede}
            </p>
          )}
        </Reveal>
        <div style={{ marginTop: 44 }}>{children}</div>
      </div>
    </section>
  );
}

/** Hairline card. The card is implied by the border, never by a fill. */
export function HairlineCard({
  children,
  style,
  hover = true,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  hover?: boolean;
}) {
  return (
    <div className={hover ? "astra-card" : undefined} style={{ border: "1px solid var(--carbon)", borderRadius: 10, padding: 22, ...style }}>
      {children}
    </div>
  );
}

/**
 * A metric tile. The number counts to its real value on entry and the last
 * frame is a hard set, so what settles on screen is exactly what was measured.
 */
export function MetricTile({
  label,
  value,
  unit,
  source,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  source: string;
  tone?: "neutral" | "positive" | "caution";
}) {
  const accent = tone === "positive" ? "var(--metric)" : tone === "caution" ? "var(--ochre)" : "var(--bone)";
  // Only pure numbers animate; "1–6 / 20" and "0.25 ms" stay as authored.
  const numeric = /^[\d,]+$/.test(value) ? Number(value.replace(/,/g, "")) : null;

  return (
    <div className="astra-tile" style={{ padding: "22px 20px 24px" }}>
      <div className="mono-label">{label}</div>
      <div
        className="tnum"
        style={{ marginTop: 14, fontFamily: "var(--display)", fontVariationSettings: "'wdth' 84", fontWeight: 500, fontSize: 40, lineHeight: 1, letterSpacing: "-0.035em", color: accent }}
      >
        {numeric !== null ? <CountUp value={numeric} /> : value}
        {unit && (
          <span className="font-mono" style={{ fontSize: 12, letterSpacing: "-0.02em", color: "var(--granite)", marginLeft: 8, fontVariationSettings: "normal" }}>
            {unit}
          </span>
        )}
      </div>
      <div className="font-mono" style={{ marginTop: 12, fontSize: 11, lineHeight: 1.45, color: "var(--graphite)" }}>
        {source}
      </div>
    </div>
  );
}

/**
 * Seamless marquee. Two copies of the track translate by exactly one copy's
 * width, so the loop has no seam and no measurement drift on resize.
 */
export function Marquee({
  items,
  speed = 42,
  className,
}: {
  items: readonly string[];
  speed?: number;
  className?: string;
}) {
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;
    const track = element.querySelector<HTMLElement>("[data-marquee-track]");
    if (!track) return;
    const width = track.scrollWidth / 2;
    gsap.to(track, { x: -width, duration: width / speed, ease: "none", repeat: -1 });
  }, [items.join("|"), speed]);

  const doubled = [...items, ...items];

  return (
    <div ref={ref} className={className} style={{ overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
      <div data-marquee-track style={{ display: "inline-flex", gap: 0, whiteSpace: "nowrap", willChange: "transform" }}>
        {doubled.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="font-mono"
            style={{ fontSize: 12, letterSpacing: "0.02em", color: "var(--graphite)", padding: "0 26px", display: "inline-flex", alignItems: "center", gap: 26 }}
          >
            {item}
            <i style={{ width: 3, height: 3, borderRadius: 99, background: "var(--ash)", display: "inline-block" }} />
          </span>
        ))}
      </div>
    </div>
  );
}
