"use client";

import React from "react";
import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { PAGE, Eyebrow, HairlineCard, MetricTile, PulseDot } from "@/components/landing/atoms";
import { Reveal, ScrollProgress } from "@/lib/motion";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
import { ResponsiveThresholdChart } from "@/components/ui/threshold-chart";
import { HEADLINE_METRICS, TANK_204_COURSES, MEASURED_AT, MEASURED_REF } from "@/lib/metrics";

function SovereigntyStrip() {
  const facts: { k: string; v: string; tone?: "metric" }[] = [
    { k: "EGRESS", v: "0 B", tone: "metric" },
    { k: "POLICY", v: "LOCAL_ONLY" },
    { k: "SANDBOX NET", v: "--network none" },
    { k: "AUDIT", v: "HASH-CHAINED", tone: "metric" },
  ];
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4"
      style={{ border: "1px solid var(--carbon)", borderRadius: 6, maxWidth: 840, background: "var(--surface-sunken)" }}
    >
      {facts.map((fact, i) => (
        <span
          key={fact.k}
          className="font-mono"
          style={{
            fontSize: 12,
            letterSpacing: "-0.02em",
            padding: "16px 20px",
            borderLeft: i > 0 ? "1px solid var(--carbon)" : "none",
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

function ProofCards() {
  const rules: [string, string, "metric" | "alert"][] = [
    ["ALLOW", "127.0.0.1 / ::1 loopback", "metric"],
    ["ALLOW", "the configured Ollama host", "metric"],
    ["BLOCK", "every other host — recorded, not silent", "alert"],
    ["BLOCK", "the sandbox has no interface at all", "alert"],
  ];
  return (
    <Reveal stagger={0.12} className="grid gap-6 lg:grid-cols-2">
      <HairlineCard style={{ padding: 28 }}>
        <div className="mono-label">NetworkGuard — classification</div>
        <ul style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}>
          {rules.map(([verb, text, tone]) => (
            <li
              key={text}
              className="flex items-baseline gap-4"
              style={{ padding: "12px 0", borderBottom: "1px solid var(--carbon)" }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: tone === "metric" ? "var(--metric)" : "var(--alert)",
                  width: 48,
                }}
              >
                {verb}
              </span>
              <span style={{ fontSize: 14.5, color: "var(--stone)" }}>{text}</span>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.55, color: "var(--granite)" }}>
          Every Ollama, embedding and vision client goes through a guarded transport. A blocked
          attempt raises <span className="font-mono" style={{ color: "var(--bone)" }}>ExternalNetworkBlocked</span> and
          is counted. The status reads <span className="font-mono" style={{ color: "var(--bone)" }}>UNKNOWN</span> until
          traffic has actually been observed — it never claims a verification it has not made.
        </p>
      </HairlineCard>

      <HairlineCard style={{ padding: 28 }}>
        <div className="mono-label">What this does not prove</div>
        <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.6, color: "var(--granite)" }}>
          The guard is application-layer. It sees every request the Python process makes and stops
          the ones leaving the box — it is not a packet capture, and it does not claim to be. For a
          deployment audit, run it behind an interface-level monitor and compare. We would rather
          state the boundary of the claim than have someone find it.
        </p>
        <div
          className="mt-6 font-mono code-plate"
          style={{
            fontSize: 11,
            lineHeight: 2,
            color: "var(--graphite)",
            padding: "16px 20px",
            borderRadius: 6,
            border: "1px solid var(--carbon)",
          }}
        >
          <div>// Implementation & Verification Endpoints</div>
          <div style={{ color: "var(--bone)" }}>backend/app/services/network_guard.py</div>
          <div style={{ color: "var(--signal)" }}>GET /api/sovereignty</div>
          <div style={{ color: "var(--metric)" }}>GET /api/audit/verify → chain status</div>
        </div>
      </HairlineCard>
    </Reveal>
  );
}

function DashboardFrame() {
  return (
    <div style={{ marginTop: 32 }}>
      <Reveal y={34}>
        <div style={{ background: "var(--surface-sunken)", border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          <div
            className="flex items-center gap-3 px-4"
            style={{ height: 44, background: "#141210", borderBottom: "1px solid var(--carbon)" }}
          >
            <span style={{ display: "inline-flex", gap: 6 }}>
              <i style={{ width: 9, height: 9, borderRadius: 99, background: "#3d3a39", display: "block" }} />
              <i style={{ width: 9, height: 9, borderRadius: 99, background: "#3d3a39", display: "block" }} />
              <i style={{ width: 9, height: 9, borderRadius: 99, background: "#3d3a39", display: "block" }} />
            </span>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 12, letterSpacing: "-0.02em", color: "var(--stone)" }}
            >
              astra://workbench — verified metrics
            </span>
            <span
              className="ml-auto inline-flex items-center gap-2 font-mono"
              style={{ fontSize: 11, color: "var(--granite)" }}
            >
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
            <div style={{ padding: "24px 20px 12px" }}>
              <div className="mono-label">Tank 204 — shell thickness vs SOP-09 Rev 3 limit</div>
              <ResponsiveThresholdChart height={290} />
            </div>
            <div style={{ padding: "24px 20px", borderLeft: "1px solid var(--carbon)" }}>
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
              <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.5, color: "var(--granite)" }}>
                Course 5 carries a struck printed value and a handwritten correction. The assessment
                refers it rather than picking one — an ambiguous reading is not a number.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
      <p className="font-mono" style={{ marginTop: 14, fontSize: 11, color: "var(--graphite)" }}>
        Source: SOP-09 Rev 3 evaluation standards on {MEASURED_REF}.
      </p>
    </div>
  );
}

export default function ProofPage() {
  return (
    <main style={{ background: "var(--canvas)", color: "var(--bone)", minHeight: "100vh", overflowX: "clip" }}>
      <ScrollProgress />
      <LandingNav currentPath="/proof" />

      {/* Hero Header */}
      <section style={{ paddingTop: 80, paddingBottom: 40 }}>
        <div className={PAGE}>
          <Reveal y={20}>
            <Eyebrow>The sovereign claim</Eyebrow>
            <h1 className="display-xl" style={{ margin: "20px 0 0", color: "var(--bone)", maxWidth: "20ch" }}>
              Proof, stated with its limits.
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
              A sovereignty claim is only worth what its evidence is worth, so here is the mechanism
              and here is where it stops. Zero egress is enforced at runtime and verified cryptographically.
            </p>
            <div style={{ marginTop: 36 }}>
              <SovereigntyStrip />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Proof Cards */}
      <section style={{ paddingTop: 32, paddingBottom: 48 }}>
        <div className={PAGE}>
          <ProofCards />
        </div>
      </section>

      {/* Verified Metrics Dashboard Frame */}
      <section style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div className={PAGE}>
          <div className="mb-4">
            <span className="mono-label" style={{ color: "var(--stone)" }}>
              Live Telemetry & Golden Scenario Verification
            </span>
          </div>
          <DashboardFrame />
        </div>
      </section>

      {/* Next Section Banner */}
      <section style={{ paddingTop: 64, paddingBottom: 120 }}>
        <div className={PAGE}>
          <div
            style={{
              border: "1px solid var(--carbon)",
              borderRadius: 12,
              padding: "40px 32px",
              background: "var(--surface-sunken)",
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
              Engineering log & verified benchmarks
            </h3>
            <p style={{ maxWidth: "48ch", margin: 0, color: "var(--granite)", fontSize: 15.5, lineHeight: 1.5 }}>
              Check the full benchmark board, test suite coverage, Docker sandbox execution latency, and system metric tiles.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LiquidCarveButton variant="bone" size="lg" arrow href="/benchmarks">
                View benchmarks
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
