"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Instrument primitives.
 *
 * Devices reverse-engineered from the reference set and put on this system's
 * palette and type. They exist so the operational views stop being grids of
 * identical rounded boxes: a panel that names itself FIG.n, a number that is
 * allowed to be large, a list that numbers its own sub-points, a tier row
 * that shows where something actually lives.
 *
 * All of them are markup and CSS. Nothing here animates on its own.
 */

/* ------------------------------------------------------------ FigurePanel */

export interface FigurePanelProps {
  /** Corner label, rendered as FIG.<figure>. Omit for no label. */
  figure?: string | number;
  title?: React.ReactNode;
  /** Right-hand slot in the header — a toggle, a refresh, a status. */
  actions?: React.ReactNode;
  /** Mono caption under the title. */
  caption?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Removes the body padding for full-bleed content like tables. */
  flush?: boolean;
}

export function FigurePanel({
  figure,
  title,
  actions,
  caption,
  children,
  className,
  style,
  flush = false,
}: FigurePanelProps) {
  return (
    <section
      className={cn("relative", className)}
      style={{ border: "1px solid var(--carbon)", borderRadius: 6, background: "#0c0b0a", ...style }}
    >
      {figure !== undefined && (
        <span
          className="absolute font-mono uppercase"
          style={{ top: 10, left: 12, fontSize: 9.5, letterSpacing: "0.14em", color: "var(--graphite)" }}
        >
          FIG.{figure}
        </span>
      )}

      {(title || actions || caption) && (
        <header
          className="flex items-start justify-between gap-4"
          style={{ padding: figure !== undefined ? "28px 18px 14px" : "16px 18px 14px", borderBottom: "1px solid var(--carbon)" }}
        >
          <div className="min-w-0">
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--display)",
                  fontVariationSettings: "'wdth' 88",
                  fontWeight: 500,
                  fontSize: 17,
                  letterSpacing: "-0.02em",
                  color: "var(--bone)",
                }}
              >
                {title}
              </h3>
            )}
            {caption && (
              <p className="font-mono" style={{ margin: "5px 0 0", fontSize: 11, color: "var(--graphite)" }}>
                {caption}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}

      <div style={{ padding: flush ? 0 : 18 }}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------- NumberedList */

export interface NumberedItem {
  title: React.ReactNode;
  detail?: React.ReactNode;
}

/**
 * 1.1 / 1.2 / 1.3 sub-points. The number is the quiet part and the claim is
 * the loud part, which is the opposite of how a bulleted list reads.
 */
export function NumberedList({ index, items }: { index: number; items: NumberedItem[] }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item, i) => (
        <li
          key={i}
          className="grid gap-3"
          style={{ gridTemplateColumns: "34px minmax(0,1fr)", padding: "11px 0", borderBottom: i < items.length - 1 ? "1px solid var(--carbon)" : "none" }}
        >
          <span className="font-mono tnum" style={{ fontSize: 11, color: "var(--graphite)", paddingTop: 2 }}>
            {index}.{i + 1}
          </span>
          <span>
            <span className="block" style={{ fontSize: 14, color: "var(--bone)" }}>
              {item.title}
            </span>
            {item.detail && (
              <span className="block" style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.5, color: "var(--granite)" }}>
                {item.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------- StatSlab */

/**
 * The one number a panel is actually about, on a striped accent field.
 * Used sparingly — a page with three of these has none.
 */
export function StatSlab({
  value,
  label,
  tone = "signal",
}: {
  value: string;
  label: string;
  tone?: "signal" | "metric" | "neutral";
}) {
  const background =
    tone === "signal"
      ? "repeating-linear-gradient(90deg, #ee6018 0 26px, #f2712f 26px 52px)"
      : tone === "metric"
        ? "repeating-linear-gradient(90deg, #7fae6f 0 26px, #8fbd7d 26px 52px)"
        : "repeating-linear-gradient(90deg, #1d1a18 0 26px, #221f1d 26px 52px)";
  const ink = tone === "neutral" ? "var(--bone)" : "#101010";
  return (
    <div className="flex flex-col items-center justify-center" style={{ background, padding: "30px 18px", borderRadius: 3 }}>
      <span
        className="tnum"
        style={{ fontFamily: "var(--display)", fontVariationSettings: "'wdth' 84", fontWeight: 500, fontSize: 44, lineHeight: 1, letterSpacing: "-0.035em", color: ink }}
      >
        {value}
      </span>
      <span className="font-mono uppercase" style={{ marginTop: 8, fontSize: 10.5, letterSpacing: "0.12em", color: ink, opacity: 0.78 }}>
        {label}
      </span>
    </div>
  );
}

/* --------------------------------------------------------- SegmentedToggle */

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex" style={{ border: "1px solid var(--carbon)", borderRadius: 3, padding: 2 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className="font-mono uppercase"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.08em",
              padding: "6px 12px",
              borderRadius: 2,
              border: 0,
              cursor: "pointer",
              background: active ? "var(--carbon)" : "transparent",
              color: active ? "var(--bone)" : "var(--granite)",
              transition: "background-color 160ms cubic-bezier(0.4,0,0.2,1), color 160ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- TierRow */

export interface Tier {
  name: string;
  detail: string;
  /** 0 = hottest. Drives how much accent the box carries. */
  heat: number;
}

/** Hot → warm → cold, with the accent draining as it goes. */
export function TierRow({ tiers }: { tiers: Tier[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {tiers.map((tier, i) => (
        <React.Fragment key={tier.name}>
          <div
            className="flex-1"
            style={{
              minWidth: 150,
              padding: "12px 14px",
              borderRadius: 3,
              border: `1px solid ${i === 0 ? "var(--signal)" : "var(--carbon)"}`,
              background: `color-mix(in srgb, var(--signal) ${Math.max(0, 14 - tier.heat * 6)}%, #0c0b0a)`,
            }}
          >
            <span className="block" style={{ fontSize: 13.5, color: "var(--bone)" }}>
              {tier.name}
            </span>
            <span className="block font-mono" style={{ marginTop: 3, fontSize: 11, color: i === 0 ? "var(--signal)" : "var(--granite)" }}>
              {tier.detail}
            </span>
          </div>
          {i < tiers.length - 1 && (
            <span aria-hidden="true" className="self-center font-mono" style={{ color: "var(--graphite)", fontSize: 13 }}>
              →
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Gantt */

export interface GanttRow {
  label: string;
  /** 0..1 of the track width. */
  start: number;
  /** 0..1 of the track width. */
  width: number;
  tone?: "signal" | "metric" | "ochre" | "bone";
  value?: string;
}

const TONE: Record<NonNullable<GanttRow["tone"]>, string> = {
  signal: "var(--signal)",
  metric: "var(--metric)",
  ochre: "var(--ochre)",
  bone: "var(--bone)",
};

/**
 * Timeline bars on hairline tracks. Shows sequence and overlap, which a
 * stacked bar chart hides.
 */
export function Gantt({ rows }: { rows: GanttRow[] }) {
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {rows.map((row) => (
        <div key={row.label} className="grid items-center gap-3" style={{ gridTemplateColumns: "116px minmax(0,1fr) 62px" }}>
          <span className="font-mono truncate" style={{ fontSize: 11, color: "var(--granite)" }}>
            {row.label}
          </span>
          <span className="relative block" style={{ height: 1, background: "var(--carbon)" }}>
            <span
              style={{
                position: "absolute",
                top: -2,
                left: `${Math.max(0, Math.min(100, row.start * 100))}%`,
                width: `${Math.max(1, Math.min(100, row.width * 100))}%`,
                height: 5,
                background: TONE[row.tone ?? "signal"],
                borderRadius: 1,
              }}
            />
          </span>
          <span className="font-mono tnum text-right" style={{ fontSize: 11, color: "var(--stone)" }}>
            {row.value ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export default FigurePanel;
