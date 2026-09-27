"use client";

import React from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { AstraMark } from "@/components/brand/AstraMark";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
import { ResponsiveThresholdChart } from "@/components/ui/threshold-chart";
import { CrowdCanvas } from "@/components/ui/crowd-canvas";
import { DitherTree } from "@/components/ui/dither-tree";
import LandingNav from "@/components/landing/LandingNav";
import { MarkSection } from "@/components/landing/MarkSection";
import LandingFooter from "@/components/landing/LandingFooter";
import {
  PAGE,
  Eyebrow,
  PulseDot,
  Section,
  HairlineCard,
  MetricTile,
  Marquee,
} from "@/components/landing/atoms";
import { Parallax, Reveal, RiseLines, ScrollProgress, useGsap, prefersReducedMotion } from "@/lib/motion";
import {
  HEADLINE_METRICS,
  TOOL_SURFACE,
  TANK_204_COURSES,
  MEASURED_AT,
  MEASURED_REF,
} from "@/lib/metrics";

interface LandingPageProps {
  onEnter: () => void;
}

/* ------------------------------------------------------------------- hero */

function SovereigntyStrip() {
  const facts: { k: string; v: string; tone?: "metric" }[] = [
    { k: "EGRESS", v: "0 B", tone: "metric" },
    { k: "POLICY", v: "LOCAL_ONLY" },
    { k: "SANDBOX NET", v: "--network none" },
    { k: "AUDIT", v: "HASH-CHAINED", tone: "metric" },
  ];
  return (
    <div
      className="grid grid-cols-2"
      style={{ border: "1px solid var(--carbon)", borderRadius: 4, marginTop: 36, maxWidth: 520, background: "var(--surface-sunken)" }}
    >
      {facts.map((fact, i) => (
        <span
          key={fact.k}
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: "-0.02em",
            padding: "12px 16px",
            borderLeft: i % 2 === 1 ? "1px solid var(--carbon)" : "none",
            borderTop: i > 1 ? "1px solid var(--carbon)" : "none",
            color: "var(--granite)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {fact.k} <span style={{ color: fact.tone === "metric" ? "var(--metric)" : "var(--bone)" }}>{fact.v}</span>
        </span>
      ))}
    </div>
  );
}

function Hero({ onEnter }: { onEnter: () => void }) {
  const [kbOpen, setKbOpen] = React.useState(true);
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;
    gsap.from(element.querySelectorAll("[data-hero-step]"), {
      opacity: 0,
      y: 18,
      duration: 0.7,
      delay: 0.42,
      stagger: 0.09,
      ease: "power3.out",
    });
  }, []);

  return (
    <header ref={ref} style={{ position: "relative", paddingTop: 80, minHeight: "92vh", overflow: "hidden" }}>
      <Parallax speed={0.3} style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <div className="astra-grid" />
      </Parallax>

      {/* The growth field. Full-bleed and anchored to the floor, masked back
          on the left so the headline keeps its contrast. Click it to regrow. */}
      <div
        style={{
          position: "absolute",
          left: "37%",
          right: "2%",
          bottom: 96,
          height: "68%",
          zIndex: 0,
          maskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 14%, #000 32%), linear-gradient(to top, #000 78%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 14%, #000 32%), linear-gradient(to top, #000 78%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <DitherTree grid={7} duration={3.6} />
      </div>

      <div className={PAGE} style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
          <div style={{ pointerEvents: "auto" }}>
            <h1 className="display-xl" style={{ margin: "0 0 0", color: "var(--bone)" }}>
              <RiseLines lines={["The work stays", "on the premises."]} delay={0.12} />
            </h1>

            <p
              data-hero-step
              style={{ margin: "26px 0 0", maxWidth: "50ch", fontSize: 17, lineHeight: 1.5, color: "var(--granite)" }}
            >
              An agentic AI workbench for confidential industrial work. It reads your scanned
              inspection reports, checks the arithmetic in a sealed container, and hands back an
              approval note as a Word file — on one GPU server, with no route to the internet.
            </p>

            <div data-hero-step className="mt-9 flex flex-wrap items-center gap-3">
              <LiquidCarveButton variant="bone" size="lg" arrow onClick={onEnter}>
                Enter the workbench
              </LiquidCarveButton>
              <LiquidCarveButton variant="ghost" size="lg" href="/proof">
                Read the proof
              </LiquidCarveButton>
            </div>

            <div data-hero-step>
              <SovereigntyStrip />
            </div>
          </div>

          {/*
            The card is a legend for the growth field behind it, so it has to
            sit *on* the field rather than in it: at 92% canvas the canopy came
            through the panel and turned the copy to mush. It is opaque now,
            and it closes — a legend you cannot dismiss is furniture.
          */}
          <Parallax speed={-0.1} className="hidden lg:flex justify-end" style={{ pointerEvents: "auto" }}>
            {kbOpen ? (
              <div style={{ width: 268, border: "1px solid var(--ash)", borderRadius: 10, background: "var(--canvas)", padding: 18, boxShadow: "0 18px 50px -20px rgba(0,0,0,0.9)" }}>
                <div className="flex items-center gap-2.5" style={{ paddingBottom: 14, borderBottom: "1px solid var(--carbon)" }}>
                  <AstraMark size={26} handles={false} />
                  <span className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--stone)" }}>
                    Knowledge base
                  </span>
                  <button
                    type="button"
                    onClick={() => setKbOpen(false)}
                    aria-label="Close the knowledge base note"
                    className="ml-auto shrink-0"
                    style={{ background: "transparent", border: "none", color: "var(--graphite)", cursor: "pointer", padding: 2, lineHeight: 0 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </svg>
                  </button>
                </div>
                <p style={{ margin: "14px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "var(--granite)" }}>
                  Every document you ingest branches from one local root. It grows on your
                  hardware, it is searched on your hardware, and it has nowhere else to go.
                </p>
                <div className="font-mono" style={{ marginTop: 14, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--graphite)" }}>
                  CLICK THE GROWTH TO RESEED
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setKbOpen(true)}
                className="font-mono uppercase self-start"
                style={{ fontSize: 10, letterSpacing: "0.14em", padding: "7px 11px", borderRadius: 2, border: "1px solid var(--carbon)", background: "var(--canvas)", color: "var(--graphite)", cursor: "pointer" }}
              >
                What is this?
              </button>
            )}
          </Parallax>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          marginTop: 72,
          borderTop: "1px solid var(--carbon)",
          borderBottom: "1px solid var(--carbon)",
          padding: "14px 0",
        }}
      >
        <Marquee items={[...TOOL_SURFACE, "gpt-oss", "qwen3-vl", "devstral", "deepseek-r1", "nomic-embed-text"]} />
      </div>
    </header>
  );
}

/* -------------------------------------------------------- dashboard frame */

function DashboardFrame() {
  return (
    <div className={PAGE} style={{ marginTop: 96 }}>
      <Reveal y={34}>
        <div style={{ background: "var(--surface-sunken)", border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          <div
            className="flex items-center gap-3 px-4"
            style={{ height: 42, background: "#141210", borderBottom: "1px solid var(--carbon)" }}
          >
            <span style={{ display: "inline-flex", gap: 6 }}>
              <i style={{ width: 9, height: 9, borderRadius: 99, background: "#3d3a39", display: "block" }} />
              <i style={{ width: 9, height: 9, borderRadius: 99, background: "#3d3a39", display: "block" }} />
              <i style={{ width: 9, height: 9, borderRadius: 99, background: "#3d3a39", display: "block" }} />
            </span>
            <span className="font-mono uppercase" style={{ fontSize: 12, letterSpacing: "-0.02em", color: "var(--stone)" }}>
              astra://workbench — verified metrics
            </span>
            <span className="ml-auto inline-flex items-center gap-2 font-mono" style={{ fontSize: 11, color: "var(--granite)" }}>
              <PulseDot />
              measured {MEASURED_AT}
            </span>
          </div>

          <div className="grid md:grid-cols-4" style={{ borderBottom: "1px solid var(--carbon)" }}>
            {HEADLINE_METRICS.map((m, i) => (
              <div key={m.label} style={{ borderLeft: i === 0 ? "none" : "1px solid var(--carbon)" }}>
                <MetricTile {...m} />
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div style={{ padding: "22px 20px 8px" }}>
              <div className="mono-label">Tank 204 — shell thickness vs SOP-09 Rev 3 limit</div>
              <ResponsiveThresholdChart height={288} />
            </div>
            <div style={{ padding: "22px 20px", borderLeft: "1px solid var(--carbon)" }}>
              <div className="mono-label">Course status</div>
              <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
                {TANK_204_COURSES.map((c) => {
                  const tone =
                    c.status === "REPAIR_REQUIRED"
                      ? "var(--alert)"
                      : c.status === "REFER_TO_ENGINEERING" || c.status === "ALERT"
                        ? "var(--ochre)"
                        : "var(--metric)";
                  return (
                    <li
                      key={c.course}
                      className="flex items-baseline justify-between gap-3 font-mono"
                      style={{ fontSize: 12, padding: "9px 0", borderBottom: "1px solid var(--carbon)" }}
                    >
                      <span style={{ color: "var(--stone)" }}>Course {c.course}</span>
                      <span className="tnum" style={{ color: "var(--bone)" }}>
                        {c.current_mm.toFixed(2)} mm
                      </span>
                      <span style={{ color: tone, fontSize: 11, textAlign: "right", minWidth: 96 }}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 flex items-center justify-between">
                <Link
                  href="/proof"
                  className="font-mono text-[12px] text-[var(--signal)] hover:underline flex items-center gap-1"
                >
                  Inspect full proof & limits →
                </Link>
                <Link
                  href="/benchmarks"
                  className="font-mono text-[12px] text-[var(--stone)] hover:text-[var(--bone)] flex items-center gap-1"
                >
                  View all benchmarks →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
      <p className="font-mono" style={{ marginTop: 14, fontSize: 11, color: "var(--graphite)" }}>
        Source: tests/hard_scenario_01/constants.py on {MEASURED_REF}. The scoring script reads the
        same file, so this chart cannot drift from the test suite.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function LandingPage({ onEnter }: LandingPageProps) {
  const sections = [
    {
      title: "Pipeline",
      href: "/pipeline",
      badge: "01-04 Stages",
      lede: "Four sequential typed stages (extract, retrieve, compute, draft). Each stage binds its own model and toolset with zero VRAM thrashing.",
    },
    {
      title: "Sovereignty Proof",
      href: "/proof",
      badge: "0 B Egress",
      lede: "Application-layer NetworkGuard, sealed Docker containers with --network none, and an immutable hash-chained audit verification.",
    },
    {
      title: "Benchmarks",
      href: "/benchmarks",
      badge: "819 Tests",
      lede: "Complete engineering board: air-gapped test coverage, model execution speeds, hardware residency, and system resource metrics.",
    },
    {
      title: "Deliverables",
      href: "/deliverables",
      badge: "Native Office",
      lede: "Deterministic generation of Word approval notes (.docx), Excel calculation workbooks (.xlsx), and PowerPoint review decks (.pptx).",
    },
  ];

  return (
    <main style={{ background: "var(--canvas)", color: "var(--bone)", minHeight: "100vh", overflowX: "clip" }}>
      <ScrollProgress />
      <LandingNav currentPath="/" onEnter={onEnter} />

      <Hero onEnter={onEnter} />
      <DashboardFrame />

      {/* Why this exists */}
      <Section
        eyebrow="Why this exists"
        title="The data cannot leave. The work still has to get done."
        lede="Refineries, PSUs and defence-linked units generate a constant stream of routine knowledge work on confidential material — P&IDs, inspection reports, vendor negotiations, unreleased designs. Policy keeps it on site, so people either do it by hand or quietly paste it into a public tool anyway. This is the third option."
      >
        <Reveal stagger={0.1} className="grid gap-6 md:grid-cols-3">
          {[
            [
              "Nothing is uploaded",
              "Inference, OCR, embeddings, retrieval and file generation all execute on your own hardware. There is no API key to configure because there is no API to call.",
            ],
            [
              "Not locked to one model",
              "Five capabilities route to local open-weight models declared in a YAML file. Adding a model is a config change, not a redesign — new open weights land every month.",
            ],
            [
              "It produces files, not chat",
              "The output of a task is a Word approval note, an Excel workbook with live formulas, a deck, or verified code — the thing the job actually needed.",
            ],
          ].map(([title, body]) => (
            <HairlineCard key={title}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--display)",
                  fontVariationSettings: "'wdth' 88",
                  fontWeight: 500,
                  fontSize: 21,
                  letterSpacing: "-0.025em",
                  color: "var(--bone)",
                }}
              >
                {title}
              </h3>
              <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--granite)" }}>{body}</p>
            </HairlineCard>
          ))}
        </Reveal>
      </Section>

      <MarkSection />

      {/* Explore Dedicated Sections Hub */}
      <Section
        eyebrow="System Architecture"
        title="Explore each dimension of the sovereign workbench."
        lede="Instead of reading everything in one giant page, each architectural layer is documented on its own dedicated page with live evidence."
      >
        <Reveal stagger={0.08} className="grid gap-6 md:grid-cols-2">
          {sections.map((sec) => (
            <Link
              key={sec.href}
              href={sec.href}
              style={{ textDecoration: "none" }}
              className="group block"
            >
              <div
                className="astra-card h-full transition-all duration-300 group-hover:border-[var(--signal)]"
                style={{
                  background: "var(--canvas)",
                  border: "1px solid var(--carbon)",
                  borderRadius: 10,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono" style={{ fontSize: 11, color: "var(--signal)" }}>
                      {sec.badge}
                    </span>
                    <span
                      className="font-mono text-[13px] text-[var(--granite)] group-hover:text-[var(--bone)] transition-colors"
                    >
                      {sec.href} ↗
                    </span>
                  </div>
                  <h3
                    style={{
                      margin: "14px 0 0",
                      fontFamily: "var(--display)",
                      fontVariationSettings: "'wdth' 88",
                      fontWeight: 500,
                      fontSize: 24,
                      letterSpacing: "-0.025em",
                      color: "var(--bone)",
                    }}
                  >
                    {sec.title}
                  </h3>
                  <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--granite)" }}>
                    {sec.lede}
                  </p>
                </div>
                <div
                  className="mt-6 flex items-center gap-2 font-mono text-[12px] text-[var(--signal)] group-hover:translate-x-1 transition-transform"
                >
                  <span>Open {sec.title}</span>
                  <span>→</span>
                </div>
              </div>
            </Link>
          ))}
        </Reveal>
      </Section>

      {/* Ready when you are CTA */}
      <section style={{ paddingTop: 128 }}>
        <div className={PAGE}>
          <Reveal y={30}>
            <div className="flex flex-col items-center gap-7 text-center">
              <Eyebrow>Ready when you are</Eyebrow>
              <p style={{ margin: 0, maxWidth: "46ch", fontSize: 16.5, lineHeight: 1.5, color: "var(--granite)" }}>
                Local accounts, PBKDF2-hashed, signed session cookies. The first admin password is
                written once to disk on first start and never travels.
              </p>
              <LiquidCarveButton variant="carve" size="xl" onClick={onEnter} className="w-full max-w-[880px]">
                Enter the workbench
              </LiquidCarveButton>
              <span className="font-mono" style={{ fontSize: 11, color: "var(--graphite)" }}>
                Move the pointer across it.
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Crowd illustration */}
      <section style={{ position: "relative", height: "64vh", minHeight: 400, marginTop: 112, overflow: "hidden" }}>
        <div className="absolute left-1/2 top-10 z-10 -translate-x-1/2 text-center">
          <span className="font-mono uppercase" style={{ fontSize: 12, letterSpacing: "0.04em", color: "var(--graphite)" }}>
            Built for the people who do the work
          </span>
        </div>
        <CrowdCanvas src="/images/peeps/all-peeps.png" rows={15} cols={7} className="absolute bottom-0 h-full w-full" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: 180, background: "linear-gradient(to bottom, var(--canvas), transparent)" }}
        />
      </section>

      <LandingFooter />
    </main>
  );
}
