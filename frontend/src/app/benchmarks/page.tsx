"use client";

import React from "react";
import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { PAGE, Eyebrow, MetricTile, HairlineCard } from "@/components/landing/atoms";
import { Reveal, ScrollProgress } from "@/lib/motion";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
import { BENCHMARKS, SYSTEM_METRICS, MEASURED_AT, MEASURED_REF } from "@/lib/metrics";

export default function BenchmarksPage() {
  return (
    <main style={{ background: "var(--canvas)", color: "var(--bone)", minHeight: "100vh", overflowX: "clip" }}>
      <ScrollProgress />
      <LandingNav currentPath="/benchmarks" />

      {/* Hero Header */}
      <section style={{ paddingTop: 80, paddingBottom: 40 }}>
        <div className={PAGE}>
          <Reveal y={20}>
            <Eyebrow>Engineering log</Eyebrow>
            <h1 className="display-xl" style={{ margin: "20px 0 0", color: "var(--bone)", maxWidth: "22ch" }}>
              The numbers, including the one that is not good yet.
            </h1>
            <p
              style={{
                margin: "24px 0 0",
                maxWidth: "60ch",
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--granite)",
              }}
            >
              A panel that finds one figure you hid stops believing the rest of them. So this is the
              whole board, measured on this branch with zero synthetic interpolation.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Benchmarks Board */}
      <section style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className={PAGE}>
          <div className="mb-4 flex items-center justify-between">
            <span className="mono-label" style={{ color: "var(--stone)" }}>
              Core Performance & Accuracy Matrix
            </span>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--graphite)" }}>
              {MEASURED_REF} · {MEASURED_AT}
            </span>
          </div>

          <Reveal
            stagger={0.08}
            className="grid gap-px"
            style={{
              background: "var(--carbon)",
              border: "1px solid var(--carbon)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {BENCHMARKS.map((bench) => (
              <div
                key={bench.name}
                className="astra-card grid gap-6 md:grid-cols-[250px_170px_minmax(0,1fr)]"
                style={{ background: "var(--canvas)", padding: 26 }}
              >
                <span style={{ fontSize: 16.5, letterSpacing: "-0.02em", color: "var(--bone)", fontWeight: 500 }}>
                  {bench.name}
                </span>
                <span
                  className="tnum"
                  style={{
                    fontFamily: "var(--display)",
                    fontVariationSettings: "'wdth' 84",
                    fontWeight: 500,
                    fontSize: 32,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color: bench.tone === "positive" ? "var(--metric)" : "var(--ochre)",
                  }}
                >
                  {bench.value}
                </span>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--granite)" }}>
                  {bench.detail}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* System Metrics Grid */}
      <section style={{ paddingTop: 24, paddingBottom: 64 }}>
        <div className={PAGE}>
          <div className="mb-4">
            <span className="mono-label" style={{ color: "var(--stone)" }}>
              System & Resource Utilization
            </span>
          </div>

          <div
            className="grid md:grid-cols-3"
            style={{ border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden", background: "#0d0d0d" }}
          >
            {SYSTEM_METRICS.map((m, i) => (
              <div
                key={m.label}
                style={{
                  borderLeft: i % 3 === 0 ? "none" : "1px solid var(--carbon)",
                  borderTop: i > 2 ? "1px solid var(--carbon)" : "none",
                }}
              >
                <MetricTile {...m} />
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <HairlineCard style={{ padding: 26 }}>
              <div className="mono-label" style={{ color: "var(--metric)" }}>
                Deterministic Scoring
              </div>
              <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.6, color: "var(--granite)" }}>
                All arithmetic evaluations execute within an ephemeral container with strictly zero egress.
                Numbers are compared directly against the engineering baseline declared in the golden test scenario.
              </p>
            </HairlineCard>

            <HairlineCard style={{ padding: 26 }}>
              <div className="mono-label" style={{ color: "var(--signal)" }}>
                Hardware Independence
              </div>
              <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.6, color: "var(--granite)" }}>
                Tested on a single consumer GPU workstation (NVIDIA RTX 4090 / 24GB VRAM) running local Ollama.
                No clusters, cloud endpoints, or external model APIs are involved.
              </p>
            </HairlineCard>
          </div>
        </div>
      </section>

      {/* Next Section Banner */}
      <section style={{ paddingTop: 48, paddingBottom: 120 }}>
        <div className={PAGE}>
          <div
            style={{
              border: "1px solid var(--carbon)",
              borderRadius: 12,
              padding: "40px 32px",
              background: "#0d0d0d",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 20,
            }}
          >
            <span className="mono-label" style={{ color: "var(--signal)" }}>
              Next Section
            </span>
            <h3 className="display-m" style={{ color: "var(--bone)", margin: 0 }}>
              Industrial deliverables & file outputs
            </h3>
            <p style={{ maxWidth: "48ch", margin: 0, color: "var(--granite)", fontSize: 15.5, lineHeight: 1.5 }}>
              Explore how real Word notes (.docx), Excel spreadsheets (.xlsx), and PowerPoint decks (.pptx) are rendered from a single verified findings object.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LiquidCarveButton variant="bone" size="lg" arrow href="/deliverables">
                Explore deliverables
              </LiquidCarveButton>
              <LiquidCarveButton variant="ghost" size="lg" href="/?login=1">
                Enter the workbench
              </LiquidCarveButton>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
