"use client";

import React from "react";
import { gsap } from "gsap";
import { AstraMark, AstraWordmark } from "@/components/brand/AstraMark";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
import { ResponsiveThresholdChart } from "@/components/ui/threshold-chart";
import { CrowdCanvas } from "@/components/ui/crowd-canvas";
import { InputBar, ComposerPill } from "@/components/ui/input-bar";
import {
  MagneticDock,
  DockIconDesk,
  DockIconDocuments,
  DockIconRouter,
  DockIconSandbox,
  DockIconVision,
  DockIconDeliverables,
  DockIconAudit,
  DockIconShield,
  type DockItemData,
} from "@/components/ui/magnetic-dock";
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
  SYSTEM_METRICS,
  BENCHMARKS,
  MODEL_ROSTER,
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
  // A 2x2 grid rather than a wrapping row: four facts in a half-width column
  // will always break somewhere, and a deliberate break reads better than an
  // accidental one with a hole on the right.
  return (
    <div
      className="grid grid-cols-2"
      style={{ border: "1px solid var(--carbon)", borderRadius: 3, marginTop: 36, maxWidth: 520 }}
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
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;
    // Everything below the headline follows it in, once, on load — the page
    // should arrive assembled rather than assemble itself while you read it.
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
    <header ref={ref} style={{ position: "relative", paddingTop: 80, overflow: "hidden" }}>
      <Parallax speed={0.3} style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <div className="astra-grid" />
      </Parallax>

      <div className={PAGE} style={{ position: "relative", zIndex: 1 }}>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
          <div>
            <div data-hero-step>
              <Eyebrow>SIH 26117 / MRPL</Eyebrow>
            </div>

            <h1 className="display-xl" style={{ margin: "24px 0 0", color: "var(--bone)" }}>
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
              <LiquidCarveButton variant="ghost" size="lg" href="#proof">
                Read the proof
              </LiquidCarveButton>
            </div>

            <div data-hero-step>
              <SovereigntyStrip />
            </div>
          </div>

          <Parallax speed={-0.16} className="flex items-center justify-center lg:justify-end">
            <AstraMark size={420} interactive className="max-w-full" />
          </Parallax>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, marginTop: 72, borderTop: "1px solid var(--carbon)", borderBottom: "1px solid var(--carbon)", padding: "14px 0" }}>
        <Marquee items={[...TOOL_SURFACE, "llama3.1", "qwen2.5-coder", "qwen2.5-math", "llava", "nomic-embed-text"]} />
      </div>
    </header>
  );
}

/* -------------------------------------------------------- dashboard frame */

function DashboardFrame() {
  return (
    <div className={PAGE} style={{ marginTop: 96 }}>
      <Reveal y={34}>
        <div style={{ background: "#0d0d0d", border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          <div className="flex items-center gap-3 px-4" style={{ height: 42, background: "#141210", borderBottom: "1px solid var(--carbon)" }}>
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
                      <span className="tnum" style={{ color: "var(--bone)" }}>{c.current_mm.toFixed(2)} mm</span>
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
        Source: tests/hard_scenario_01/constants.py on {MEASURED_REF}. The scoring script reads the
        same file, so this chart cannot drift from the test suite.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- pipeline */

const PIPELINE = [
  {
    node: "extract",
    capability: "document",
    model: "llama3.1:latest",
    body: "Reads the attachment end to end — text layer, OCR for scans, vision on the embedded figures only. Exits by calling submit_findings with a typed object, or it degrades. It is not allowed to answer in prose.",
    tools: ["read_document", "document_vision", "document_exact_search", "submit_findings"],
  },
  {
    node: "retrieve",
    capability: "document",
    model: "llama3.1:latest",
    body: "Grounds the findings in your own SOPs and correspondence. Ranking is supersession-aware: a superseded revision can never outrank the current one on an equal match.",
    tools: ["document_search", "document_exact_search"],
  },
  {
    node: "compute",
    capability: "coding",
    model: "qwen2.5-coder:7b",
    body: "Writes the calculation and runs it in a Docker container with no network. A number is only accepted if a real sandbox run succeeded — the node re-reads its own trace to prove it, so a confident model cannot talk its way past the gate.",
    tools: ["code_execution"],
  },
  {
    node: "draft",
    capability: "general",
    model: "llama3.1:latest",
    body: "Renders the deliverables. When an assessment exists it calls the generators directly from Python — no model turn — so the Word, Excel and PowerPoint files cannot disagree with each other.",
    tools: ["document_generation", "presentation_generation"],
  },
];

function Pipeline() {
  // The rail fills as the section scrolls: the four stages are sequential, and
  // a progress line is the one piece of decoration that says so honestly.
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;
    const fill = element.querySelector<HTMLElement>("[data-rail-fill]");
    const rows = element.querySelectorAll<HTMLElement>("[data-stage]");
    if (fill) {
      gsap.fromTo(
        fill,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          transformOrigin: "top",
          scrollTrigger: { trigger: element, start: "top 74%", end: "bottom 62%", scrub: 0.4 },
        },
      );
    }
    gsap.from(rows, {
      opacity: 0,
      x: -14,
      duration: 0.6,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: { trigger: element, start: "top 80%", once: true },
    });
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 1, background: "var(--carbon)" }} aria-hidden="true">
        <div data-rail-fill style={{ position: "absolute", inset: 0, background: "var(--signal)" }} />
      </div>

      <div className="grid gap-px" style={{ marginLeft: 1 }}>
        {PIPELINE.map((stage, index) => (
          <div
            key={stage.node}
            data-stage
            className="astra-card grid gap-6 md:grid-cols-[190px_minmax(0,1fr)_240px]"
            style={{ borderBottom: "1px solid var(--carbon)", padding: "26px 0 26px 26px" }}
          >
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono tnum" style={{ fontSize: 11, color: "var(--signal)" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span style={{ fontFamily: "var(--display)", fontVariationSettings: "'wdth' 86", fontWeight: 500, fontSize: 25, letterSpacing: "-0.03em", color: "var(--bone)" }}>
                  {stage.node}
                </span>
              </div>
              <div className="mono-label" style={{ marginTop: 8 }}>{stage.capability}</div>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--granite)" }}>{stage.body}</p>
            <div>
              <div className="font-mono" style={{ fontSize: 11, color: "var(--signal)" }}>{stage.model}</div>
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                {stage.tools.map((tool) => (
                  <li key={tool} className="font-mono" style={{ fontSize: 11, lineHeight: 1.8, color: "var(--graphite)" }}>
                    {tool}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ proof */

function Proof() {
  const rules: [string, string, "metric" | "alert"][] = [
    ["ALLOW", "127.0.0.1 / ::1 loopback", "metric"],
    ["ALLOW", "the configured Ollama host", "metric"],
    ["BLOCK", "every other host — recorded, not silent", "alert"],
    ["BLOCK", "the sandbox has no interface at all", "alert"],
  ];
  return (
    <Reveal stagger={0.12} className="grid gap-6 lg:grid-cols-2">
      <HairlineCard style={{ padding: 26 }}>
        <div className="mono-label">NetworkGuard — classification</div>
        <ul style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}>
          {rules.map(([verb, text, tone]) => (
            <li key={text} className="flex items-baseline gap-4" style={{ padding: "12px 0", borderBottom: "1px solid var(--carbon)" }}>
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.06em", color: tone === "metric" ? "var(--metric)" : "var(--alert)", width: 48 }}>
                {verb}
              </span>
              <span style={{ fontSize: 14.5, color: "var(--stone)" }}>{text}</span>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.5, color: "var(--granite)" }}>
          Every Ollama, embedding and vision client goes through a guarded transport. A blocked
          attempt raises <span className="font-mono" style={{ color: "var(--bone)" }}>ExternalNetworkBlocked</span> and is
          counted. The status reads <span className="font-mono" style={{ color: "var(--bone)" }}>UNKNOWN</span> until traffic
          has actually been observed — it never claims a verification it has not made.
        </p>
      </HairlineCard>

      <HairlineCard style={{ padding: 26 }}>
        <div className="mono-label">What this does not prove</div>
        <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.55, color: "var(--granite)" }}>
          The guard is application-layer. It sees every request the Python process makes and stops
          the ones leaving the box — it is not a packet capture, and it does not claim to be. For a
          deployment audit, run it behind an interface-level monitor and compare. We would rather
          state the boundary of the claim than have someone find it.
        </p>
        <div className="mt-6 font-mono" style={{ fontSize: 11, lineHeight: 1.9, color: "var(--graphite)" }}>
          <div>backend/app/services/network_guard.py</div>
          <div>GET /api/sovereignty</div>
          <div>GET /api/audit/verify → chain status</div>
        </div>
      </HairlineCard>
    </Reveal>
  );
}

const DELIVERABLES = [
  {
    ext: ".docx",
    title: "Approval notes",
    body: "Reference, originator, department, background, recommendation and a signature block — A4, with live page fields. The Name and Date cells render blank on purpose: a model has no way to know who signs, so it is structurally prevented from inventing one.",
  },
  {
    ext: ".xlsx",
    title: "Workbooks",
    body: "One sheet per section table, real = formulas rather than baked values, leading-zero identifiers preserved as text, frozen header, deterministic timestamps so two runs diff cleanly.",
  },
  {
    ext: ".pptx",
    title: "Review decks",
    body: "Rendered by a vendored PptxGenJS, pinned at 4.0.1, with its whole dependency closure committed. A fresh air-gapped checkout renders a deck with no npm registry.",
  },
];

/* ------------------------------------------------------------------- page */

export default function LandingPage({ onEnter }: LandingPageProps) {
  const dockItems: DockItemData[] = [
    { id: "desk", label: "The desk", icon: <DockIconDesk />, meta: "task-first", isActive: true, onClick: onEnter },
    { id: "docs", label: "Documents", icon: <DockIconDocuments />, meta: "local RAG", onClick: onEnter },
    { id: "router", label: "Router", icon: <DockIconRouter />, meta: "5 capabilities", onClick: onEnter },
    { id: "sandbox", label: "Sandbox", icon: <DockIconSandbox />, meta: "--network none", onClick: onEnter },
    { id: "vision", label: "Vision + OCR", icon: <DockIconVision />, meta: "RapidOCR · llava", onClick: onEnter },
    { id: "deliverables", label: "Deliverables", icon: <DockIconDeliverables />, meta: "docx · xlsx · pptx", onClick: onEnter },
    { id: "audit", label: "Audit", icon: <DockIconAudit />, meta: "25 event types", onClick: onEnter },
    { id: "sovereignty", label: "Sovereignty", icon: <DockIconShield />, meta: "egress 0 B", onClick: onEnter },
  ];

  return (
    <main style={{ background: "var(--canvas)", color: "var(--bone)", minHeight: "100vh", overflowX: "clip" }}>
      <ScrollProgress />
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "color-mix(in srgb, var(--canvas) 86%, transparent)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--carbon)",
        }}
      >
        <div className={PAGE}>
          <div className="flex items-center gap-8" style={{ height: 64 }}>
            <AstraWordmark />
            <div className="ml-auto hidden items-center gap-8 md:flex">
              {[
                ["Pipeline", "#pipeline"],
                ["Proof", "#proof"],
                ["Benchmarks", "#benchmarks"],
                ["Deliverables", "#deliverables"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="astra-navlink">
                  {label}
                </a>
              ))}
            </div>
            <LiquidCarveButton variant="bone" size="sm" onClick={onEnter} className="ml-auto md:ml-0">
              Log in
            </LiquidCarveButton>
          </div>
        </div>
      </nav>

      <Hero onEnter={onEnter} />
      <DashboardFrame />

      <Section
        eyebrow="Why this exists"
        title="The data cannot leave. The work still has to get done."
        lede="Refineries, PSUs and defence-linked units generate a constant stream of routine knowledge work on confidential material — P&IDs, inspection reports, vendor negotiations, unreleased designs. Policy keeps it on site, so people either do it by hand or quietly paste it into a public tool anyway. This is the third option."
      >
        <Reveal stagger={0.1} className="grid gap-6 md:grid-cols-3">
          {[
            ["Nothing is uploaded", "Inference, OCR, embeddings, retrieval and file generation all execute on your own hardware. There is no API key to configure because there is no API to call."],
            ["Not locked to one model", "Five capabilities route to local open-weight models declared in a YAML file. Adding a model is a config change, not a redesign — new open weights land every month."],
            ["It produces files, not chat", "The output of a task is a Word approval note, an Excel workbook with live formulas, a deck, or verified code — the thing the job actually needed."],
          ].map(([title, body]) => (
            <HairlineCard key={title}>
              <h3 style={{ margin: 0, fontFamily: "var(--display)", fontVariationSettings: "'wdth' 88", fontWeight: 500, fontSize: 21, letterSpacing: "-0.025em", color: "var(--bone)" }}>
                {title}
              </h3>
              <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--granite)" }}>{body}</p>
            </HairlineCard>
          ))}
        </Reveal>
      </Section>

      <Section
        id="pipeline"
        eyebrow="How a task runs"
        title="Four typed stages. Each one picks its own model."
        lede="There is no single prompt and no single model. A job moves through a fixed node sequence, and every node resolves its own capability through the router, holding the GPU reservation across consecutive nodes that share a model so nothing thrashes in and out of VRAM."
      >
        <Pipeline />
      </Section>

      <Section
        eyebrow="Model auto-selection"
        title="Routing is config, not code."
        lede="config/models.yaml maps each capability to a local model with declared resources and an optional bounded fallback chain. Chains are validated at load — every target must satisfy the capability and support tool calling, with no cycles — and an invalid chain refuses startup rather than degrading quietly at runtime."
      >
        <Reveal y={22}>
          <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
            <div className="grid font-mono uppercase md:grid-cols-[170px_minmax(0,1fr)_150px_120px]" style={{ fontSize: 11, letterSpacing: "-0.02em", color: "var(--graphite)", padding: "13px 22px", borderBottom: "1px solid var(--carbon)" }}>
              <span>Capability</span>
              <span>Local model</span>
              <span>Declared VRAM</span>
              <span>Provider</span>
            </div>
            {MODEL_ROSTER.map((entry) => (
              <div
                key={entry.capability}
                className="astra-card grid items-baseline md:grid-cols-[170px_minmax(0,1fr)_150px_120px]"
                style={{ padding: "16px 22px", borderBottom: "1px solid var(--carbon)" }}
              >
                <span style={{ fontSize: 15, color: "var(--bone)" }}>{entry.capability}</span>
                <span className="font-mono" style={{ fontSize: 13, color: "var(--signal)" }}>{entry.model}</span>
                <span className="font-mono tnum" style={{ fontSize: 13, color: "var(--stone)" }}>{entry.vram_mb} MB</span>
                <span className="font-mono" style={{ fontSize: 13, color: "var(--granite)" }}>ollama</span>
              </div>
            ))}
            <div style={{ padding: "16px 22px", fontSize: 13.5, lineHeight: 1.55, color: "var(--granite)" }}>
              Embeddings run on <span className="font-mono" style={{ color: "var(--bone)" }}>nomic-embed-text</span>, also local.
              Model residency is read back from Ollama&rsquo;s own <span className="font-mono" style={{ color: "var(--bone)" }}>/api/ps</span>,
              so the console can show what the scheduler believes and what is actually in VRAM side by side — the gap between
              those two numbers is the honest signal.
            </div>
          </div>
        </Reveal>
      </Section>

      <Section
        eyebrow="Tool surface"
        title="Eleven tools. All of them local."
        lede="The agent cannot reach anything that is not in this list, and a node cannot see a tool outside its own set — a constraint enforced in the registry rather than in prompt wording, because prompt wording is not a security boundary."
      >
        <Reveal stagger={0.035} className="flex flex-wrap gap-2">
          {TOOL_SURFACE.map((tool) => (
            <span
              key={tool}
              className="astra-chip font-mono"
              style={{ fontSize: 13, padding: "10px 15px", border: "1px solid var(--carbon)", borderRadius: 3, color: "var(--stone)", position: "relative", zIndex: 0 }}
            >
              {tool}
            </span>
          ))}
        </Reveal>
        <div className="mt-12 flex justify-center">
          <MagneticDock items={dockItems} />
        </div>
      </Section>

      <Section
        id="proof"
        eyebrow="The sovereign claim"
        title="Proof, stated with its limits."
        lede="A sovereignty claim is only worth what its evidence is worth, so here is the mechanism and here is where it stops."
      >
        <Proof />
      </Section>

      <Section
        id="deliverables"
        eyebrow="What comes out"
        title="Real files, rendered from one findings object."
        lede="The generators all read the same structured assessment. No generator restates a verdict, because the first hand-built pass authored three separate payloads and they disagreed — the same reading was Monitor in the Word file, FAIL in the spreadsheet and missing from the deck. A verifier test now asserts the three agree."
      >
        <Reveal stagger={0.1} className="grid gap-6 md:grid-cols-3">
          {DELIVERABLES.map((item) => (
            <HairlineCard key={item.ext}>
              <span className="font-mono" style={{ fontSize: 12, color: "var(--signal)" }}>{item.ext}</span>
              <h3 style={{ margin: "12px 0 0", fontFamily: "var(--display)", fontVariationSettings: "'wdth' 88", fontWeight: 500, fontSize: 21, letterSpacing: "-0.025em", color: "var(--bone)" }}>
                {item.title}
              </h3>
              <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--granite)" }}>{item.body}</p>
            </HairlineCard>
          ))}
        </Reveal>
      </Section>

      <Section
        eyebrow="The desk"
        title="One field, and the context it actually used."
        lede="Attachments are explicit. The job records which documents entered its context and shows them back on the sent message, so nobody has to trust that retrieval did the right thing — they can see what the model was given."
      >
        <Reveal y={22}>
          <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, padding: "30px 20px" }}>
            <InputBar
              status="ready"
              placeholder="Review the inspection report against SOP-09 and draft an approval note…"
              onAttach={onEnter}
              onSend={onEnter}
              attachedFiles={[
                { id: "1", filename: "inspection_report_2026.pdf", size: 2_411_000 },
                { id: "2", filename: "SOP-09_Rev3.pdf", size: 486_000 },
              ]}
              leftActions={
                <>
                  <ComposerPill ariaLabel="Use all documents">Use all documents</ComposerPill>
                  <ComposerPill ariaLabel="Active capability" active>
                    document
                  </ComposerPill>
                </>
              }
              footnote={
                <>
                  <span>Enter to send · Shift+Enter for a new line</span>
                  <span style={{ color: "var(--metric)" }}>local inference · egress 0 B</span>
                </>
              }
            />
          </div>
        </Reveal>
      </Section>

      <Section
        id="benchmarks"
        eyebrow="Engineering log"
        title="The numbers, including the one that is not good yet."
        lede="A panel that finds one figure you hid stops believing the rest of them. So this is the whole board, measured on this branch."
      >
        <Reveal stagger={0.08} className="grid gap-px" style={{ background: "var(--carbon)", border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          {BENCHMARKS.map((bench) => (
            <div key={bench.name} className="astra-card grid gap-6 md:grid-cols-[250px_170px_minmax(0,1fr)]" style={{ background: "var(--canvas)", padding: 24 }}>
              <span style={{ fontSize: 16.5, letterSpacing: "-0.02em", color: "var(--bone)" }}>{bench.name}</span>
              <span
                className="tnum"
                style={{ fontFamily: "var(--display)", fontVariationSettings: "'wdth' 84", fontWeight: 500, fontSize: 30, lineHeight: 1, letterSpacing: "-0.03em", color: bench.tone === "positive" ? "var(--metric)" : "var(--ochre)" }}
              >
                {bench.value}
              </span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--granite)" }}>{bench.detail}</p>
            </div>
          ))}
        </Reveal>

        <div className="mt-6 grid md:grid-cols-3" style={{ border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          {SYSTEM_METRICS.map((m, i) => (
            <div key={m.label} style={{ borderLeft: i % 3 === 0 ? "none" : "1px solid var(--carbon)", borderTop: i > 2 ? "1px solid var(--carbon)" : "none" }}>
              <MetricTile {...m} />
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------- statement CTA */}
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

      {/* ---------------------------------------------------------- crowd */}
      <section style={{ position: "relative", height: "64vh", minHeight: 400, marginTop: 112, overflow: "hidden" }}>
        <div className="absolute left-1/2 top-10 z-10 -translate-x-1/2 text-center">
          <span className="font-mono uppercase" style={{ fontSize: 12, letterSpacing: "0.04em", color: "var(--graphite)" }}>
            Built for the people who do the work
          </span>
        </div>
        <CrowdCanvas src="/images/peeps/all-peeps.png" rows={15} cols={7} className="absolute bottom-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: 180, background: "linear-gradient(to bottom, var(--canvas), transparent)" }} />
      </section>

      <footer style={{ borderTop: "1px solid var(--carbon)", paddingTop: 56, paddingBottom: 56 }}>
        <div className={PAGE}>
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <AstraWordmark />
              <p style={{ margin: "16px 0 0", maxWidth: "36ch", fontSize: 14, lineHeight: 1.5, color: "var(--granite)" }}>
                Sovereign on-premise agentic AI workbench for confidential industrial work.
                Smart India Hackathon problem statement 26117 — Mangalore Refinery and
                Petrochemicals Limited.
              </p>
            </div>
            {[
              ["System", ["Pipeline", "Model routing", "Tool surface", "Sandbox"]],
              ["Evidence", ["Sovereignty status", "Audit chain", "Benchmarks", "Vulnerability analysis"]],
              ["Deployment", ["Offline bundle", "Docker sandbox image", "Local accounts", "Cleanup"]],
            ].map(([heading, links]) => (
              <div key={heading as string}>
                <div className="mono-label" style={{ color: "var(--bone)" }}>{heading as string}</div>
                <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
                  {(links as string[]).map((link) => (
                    <li key={link} style={{ padding: "5px 0", fontSize: 14, color: "var(--granite)" }}>
                      {link}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 font-mono" style={{ fontSize: 11, color: "var(--graphite)" }}>
            <span>Every figure on this page was measured on {MEASURED_REF} at {MEASURED_AT}.</span>
            <span>Crowd illustrations: Open Peeps (CC0) · canvas after Skiper UI / @gurvinder-singh02</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
