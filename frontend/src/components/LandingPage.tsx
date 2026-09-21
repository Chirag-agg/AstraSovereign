"use client";

import React from "react";
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

/* ------------------------------------------------------------------ atoms */

const PAGE = "mx-auto w-full max-w-[1200px] px-6 md:px-10";

function Eyebrow({ children, dot = true }: { children: React.ReactNode; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 12, letterSpacing: "-0.02em", color: "var(--stone)" }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--signal)", display: "inline-block" }} />}
      {children}
    </span>
  );
}

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ paddingTop: 96, paddingBottom: 0 }}>
      <div className={PAGE}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="display-m" style={{ margin: "18px 0 0", color: "var(--bone)", maxWidth: "20ch" }}>
          {title}
        </h2>
        {lede && (
          <p style={{ margin: "16px 0 0", maxWidth: "62ch", fontSize: 16, lineHeight: 1.5, color: "var(--granite)" }}>{lede}</p>
        )}
        <div style={{ marginTop: 40 }}>{children}</div>
      </div>
    </section>
  );
}

/** Hairline card — the card is implied by the border, not by a fill. */
function HairlineCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, padding: 20, ...style }}>{children}</div>
  );
}

function MetricTile({
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
  return (
    <div style={{ padding: "20px 20px 22px", borderTop: "1px solid var(--carbon)" }}>
      <div className="mono-label" style={{ color: "var(--pale-stone, #b8b3b0)" }}>{label}</div>
      <div className="tnum" style={{ marginTop: 14, fontSize: 36, lineHeight: 1, letterSpacing: "-1.12px", color: accent }}>
        {value}
        {unit && (
          <span className="font-mono" style={{ fontSize: 12, letterSpacing: "-0.02em", color: "var(--granite)", marginLeft: 8 }}>
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

/* ------------------------------------------------------------------- hero */

function SovereigntyStrip() {
  const facts: [string, string, string?][] = [
    ["EGRESS", "0 B", "metric"],
    ["POLICY", "LOCAL_ONLY"],
    ["SANDBOX NET", "--network none"],
    ["AUDIT", "HASH-CHAINED", "metric"],
    ["MODELS", "5 LOCAL"],
  ];
  return (
    <div
      className="flex flex-wrap items-center"
      style={{ border: "1px solid var(--carbon)", borderRadius: 3, marginTop: 40 }}
    >
      {facts.map(([k, v, tone], i) => (
        <span
          key={k}
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: "-0.02em",
            padding: "11px 16px",
            borderLeft: i === 0 ? "none" : "1px solid var(--carbon)",
            color: "var(--granite)",
            whiteSpace: "nowrap",
          }}
        >
          {k}{" "}
          <span style={{ color: tone === "metric" ? "var(--metric)" : "var(--bone)" }}>{v}</span>
        </span>
      ))}
    </div>
  );
}

function Hero({ onEnter }: { onEnter: () => void }) {
  return (
    <header style={{ paddingTop: 72, paddingBottom: 0 }}>
      <div className={PAGE}>
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div>
            <Eyebrow>SIH 26117 &nbsp;·&nbsp; MRPL</Eyebrow>
            <h1
              className="display-xl"
              style={{ margin: "26px 0 0", color: "var(--bone)" }}
            >
              The work stays
              <br />
              on the premises.
            </h1>
            <p style={{ margin: "26px 0 0", maxWidth: "52ch", fontSize: 17, lineHeight: 1.5, color: "var(--granite)" }}>
              An agentic AI workbench for confidential industrial work. It reads your scanned
              inspection reports, checks the arithmetic in a sealed container, and hands back an
              approval note as a Word file — on one GPU server, with no route to the internet.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <LiquidCarveButton variant="bone" size="lg" arrow onClick={onEnter}>
                Enter the workbench
              </LiquidCarveButton>
              <LiquidCarveButton variant="ghost" size="lg" href="#proof">
                Read the proof
              </LiquidCarveButton>
            </div>

            <SovereigntyStrip />
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <AstraMark size={400} interactive className="max-w-full" />
          </div>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------- dashboard frame */

function DashboardFrame() {
  return (
    <div className={PAGE} style={{ marginTop: 88 }}>
      <div style={{ background: "#0d0d0d", border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
        <div
          className="flex items-center gap-3 px-4"
          style={{ height: 40, background: "#141210", borderBottom: "1px solid var(--carbon)" }}
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
            <i style={{ width: 6, height: 6, borderRadius: 99, background: "var(--signal)", display: "block" }} />
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
                    : c.status === "REFER_TO_ENGINEERING"
                      ? "var(--ochre)"
                      : c.status === "ALERT"
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
      <p className="font-mono" style={{ marginTop: 14, fontSize: 11, color: "var(--graphite)" }}>
        Source: tests/hard_scenario_01/constants.py on {MEASURED_REF}. The scoring script reads the
        same file, so this chart cannot drift from the test suite.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- what it is */

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
  return (
    <div className="grid gap-px" style={{ background: "var(--carbon)", border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
      {PIPELINE.map((stage, index) => (
        <div key={stage.node} className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)_240px]" style={{ background: "var(--canvas)", padding: 24 }}>
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono tnum" style={{ fontSize: 11, color: "var(--graphite)" }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 20, letterSpacing: "-0.025em", color: "var(--bone)" }}>{stage.node}</span>
            </div>
            <div className="mono-label" style={{ marginTop: 8 }}>{stage.capability}</div>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--granite)" }}>{stage.body}</p>
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
  );
}

/* -------------------------------------------------------------- the proof */

function Proof() {
  const rules = [
    ["ALLOW", "127.0.0.1 / ::1 loopback", "metric"],
    ["ALLOW", "the configured Ollama host", "metric"],
    ["BLOCK", "every other host — recorded, not silent", "alert"],
    ["BLOCK", "the sandbox has no interface at all", "alert"],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, padding: 24 }}>
        <div className="mono-label">NetworkGuard — classification</div>
        <ul style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}>
          {rules.map(([verb, text, tone]) => (
            <li key={text} className="flex items-baseline gap-4" style={{ padding: "12px 0", borderBottom: "1px solid var(--carbon)" }}>
              <span
                className="font-mono"
                style={{ fontSize: 11, letterSpacing: "0.06em", color: tone === "metric" ? "var(--metric)" : "var(--alert)", width: 48 }}
              >
                {verb}
              </span>
              <span style={{ fontSize: 14, color: "var(--stone)" }}>{text}</span>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.5, color: "var(--granite)" }}>
          Every Ollama, embedding and vision client goes through a guarded transport. A blocked
          attempt raises <span className="font-mono" style={{ color: "var(--bone)" }}>ExternalNetworkBlocked</span> and is
          counted. The status reads <span className="font-mono" style={{ color: "var(--bone)" }}>UNKNOWN</span> until traffic
          has actually been observed — it never claims a verification it has not made.
        </p>
      </div>

      <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, padding: 24 }}>
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ deliverables */

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
    <main style={{ background: "var(--canvas)", color: "var(--bone)", minHeight: "100vh" }}>
      {/* ------------------------------------------------------------ nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "color-mix(in srgb, var(--canvas) 88%, transparent)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--carbon)" }}>
        <div className={PAGE}>
          <div className="flex items-center gap-8" style={{ height: 64 }}>
            <AstraWordmark />
            <div className="ml-auto hidden items-center gap-7 md:flex">
              {[
                ["Pipeline", "#pipeline"],
                ["Proof", "#proof"],
                ["Benchmarks", "#benchmarks"],
                ["Deliverables", "#deliverables"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  style={{ fontSize: 14, color: "var(--stone)", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bone)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--stone)")}
                >
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

      {/* ------------------------------------------------------- the problem */}
      <Section
        eyebrow="Why this exists"
        title="The data cannot leave. The work still has to get done."
        lede="Refineries, PSUs and defence-linked units generate a constant stream of routine knowledge work on confidential material — P&IDs, inspection reports, vendor negotiations, unreleased designs. Policy keeps it on site, so people either do it by hand or quietly paste it into a public tool anyway. This is the third option."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Nothing is uploaded", "Inference, OCR, embeddings, retrieval and file generation all execute on your own hardware. There is no API key to configure because there is no API to call."],
            ["Not locked to one model", "Five capabilities route to local open-weight models declared in a YAML file. Adding a model is a config change, not a redesign — new open weights land every month."],
            ["It produces files, not chat", "The output of a task is a Word approval note, an Excel workbook with live formulas, a deck, or verified code — the thing the job actually needed."],
          ].map(([title, body]) => (
            <HairlineCard key={title}>
              <h3 style={{ margin: 0, fontSize: 18, letterSpacing: "-0.02em", color: "var(--bone)" }}>{title}</h3>
              <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--granite)" }}>{body}</p>
            </HairlineCard>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------- pipeline */}
      <Section
        id="pipeline"
        eyebrow="How a task runs"
        title="Four typed stages. Each one picks its own model."
        lede="There is no single prompt and no single model. A job moves through a fixed node sequence, and every node resolves its own capability through the router, holding the GPU reservation across consecutive nodes that share a model so nothing thrashes in and out of VRAM."
      >
        <Pipeline />
      </Section>

      {/* ------------------------------------------------------------ router */}
      <Section
        eyebrow="Model auto-selection"
        title="Routing is config, not code."
        lede="config/models.yaml maps each capability to a local model with declared resources and an optional bounded fallback chain. Chains are validated at load — every target must satisfy the capability and support tool calling, with no cycles — and an invalid chain refuses startup rather than degrading quietly at runtime."
      >
        <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          <div className="grid font-mono uppercase md:grid-cols-[160px_minmax(0,1fr)_140px_120px]" style={{ fontSize: 11, letterSpacing: "-0.02em", color: "var(--graphite)", padding: "12px 20px", borderBottom: "1px solid var(--carbon)" }}>
            <span>Capability</span>
            <span>Local model</span>
            <span>Declared VRAM</span>
            <span>Provider</span>
          </div>
          {MODEL_ROSTER.map((entry) => (
            <div
              key={entry.capability}
              className="grid items-baseline md:grid-cols-[160px_minmax(0,1fr)_140px_120px]"
              style={{ padding: "16px 20px", borderBottom: "1px solid var(--carbon)" }}
            >
              <span style={{ fontSize: 15, color: "var(--bone)" }}>{entry.capability}</span>
              <span className="font-mono" style={{ fontSize: 13, color: "var(--signal)" }}>{entry.model}</span>
              <span className="font-mono tnum" style={{ fontSize: 13, color: "var(--stone)" }}>{entry.vram_mb} MB</span>
              <span className="font-mono" style={{ fontSize: 13, color: "var(--granite)" }}>ollama</span>
            </div>
          ))}
          <div style={{ padding: "16px 20px", fontSize: 13.5, lineHeight: 1.5, color: "var(--granite)" }}>
            Embeddings run on <span className="font-mono" style={{ color: "var(--bone)" }}>nomic-embed-text</span>, also local.
            Model residency is read back from Ollama&rsquo;s own <span className="font-mono" style={{ color: "var(--bone)" }}>/api/ps</span>,
            so the console can show what the scheduler believes and what is actually in VRAM side by side — the gap between
            those two numbers is the honest signal.
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------- tools */}
      <Section
        eyebrow="Tool surface"
        title="Eleven tools. All of them local."
        lede="The agent cannot reach anything that is not in this list, and a node cannot see a tool outside its own set — a constraint enforced in the registry rather than in prompt wording, because prompt wording is not a security boundary."
      >
        <div className="flex flex-wrap gap-2">
          {TOOL_SURFACE.map((tool) => (
            <span
              key={tool}
              className="font-mono"
              style={{ fontSize: 13, padding: "9px 14px", border: "1px solid var(--carbon)", borderRadius: 3, color: "var(--stone)" }}
            >
              {tool}
            </span>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <MagneticDock items={dockItems} />
        </div>
      </Section>

      {/* ------------------------------------------------------------- proof */}
      <Section
        id="proof"
        eyebrow="The sovereign claim"
        title="Proof, stated with its limits."
        lede="A sovereignty claim is only worth what its evidence is worth, so here is the mechanism and here is where it stops."
      >
        <Proof />
      </Section>

      {/* ------------------------------------------------------- deliverables */}
      <Section
        id="deliverables"
        eyebrow="What comes out"
        title="Real files, rendered from one findings object."
        lede="The generators all read the same structured assessment. No generator restates a verdict, because the first hand-built pass authored three separate payloads and they disagreed — the same reading was Monitor in the Word file, FAIL in the spreadsheet and missing from the deck. A verifier test now asserts the three agree."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {DELIVERABLES.map((item) => (
            <HairlineCard key={item.ext}>
              <span className="font-mono" style={{ fontSize: 12, color: "var(--signal)" }}>{item.ext}</span>
              <h3 style={{ margin: "12px 0 0", fontSize: 18, letterSpacing: "-0.02em", color: "var(--bone)" }}>{item.title}</h3>
              <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--granite)" }}>{item.body}</p>
            </HairlineCard>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------- composer */}
      <Section
        eyebrow="The desk"
        title="One field, and the context it actually used."
        lede="Attachments are explicit. The job records which documents entered its context and shows them back on the sent message, so nobody has to trust that retrieval did the right thing — they can see what the model was given."
      >
        <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, padding: "28px 20px" }}>
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
      </Section>

      {/* -------------------------------------------------------- benchmarks */}
      <Section
        id="benchmarks"
        eyebrow="Engineering log"
        title="The numbers, including the one that is not good yet."
        lede="A panel that finds one figure you hid stops believing the rest of them. So this is the whole board, measured on this branch."
      >
        <div className="grid gap-px" style={{ background: "var(--carbon)", border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          {BENCHMARKS.map((bench) => (
            <div key={bench.name} className="grid gap-6 md:grid-cols-[240px_160px_minmax(0,1fr)]" style={{ background: "var(--canvas)", padding: 22 }}>
              <span style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--bone)" }}>{bench.name}</span>
              <span
                className="tnum"
                style={{ fontSize: 26, lineHeight: 1, letterSpacing: "-0.8px", color: bench.tone === "positive" ? "var(--metric)" : "var(--ochre)" }}
              >
                {bench.value}
              </span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--granite)" }}>{bench.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid md:grid-cols-3" style={{ border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
          {SYSTEM_METRICS.map((m, i) => (
            <div key={m.label} style={{ borderLeft: i % 3 === 0 ? "none" : "1px solid var(--carbon)", borderTop: i > 2 ? "1px solid var(--carbon)" : "none" }}>
              <MetricTile {...m} />
            </div>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------------- cta */}
      <section style={{ paddingTop: 96 }}>
        <div className={PAGE}>
          <div
            className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]"
            style={{ background: "var(--bone)", borderRadius: 10, padding: 32 }}
          >
            <div>
              <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 12, letterSpacing: "-0.02em", color: "#101010" }}>
                <i style={{ width: 6, height: 6, borderRadius: 99, background: "var(--signal)", display: "inline-block" }} />
                Ready when you are
              </span>
              <h2 style={{ margin: "16px 0 0", fontSize: 36, lineHeight: 1.1, letterSpacing: "-1.12px", color: "#101010", maxWidth: "22ch" }}>
                Sign in with your department credentials.
              </h2>
              <p style={{ margin: "14px 0 0", maxWidth: "52ch", fontSize: 15, lineHeight: 1.5, color: "#4d4947" }}>
                Local accounts, PBKDF2-hashed, signed session cookies. The first admin password is
                written once to disk on first start and never travels.
              </p>
            </div>
            <LiquidCarveButton variant="solid" size="lg" arrow onClick={onEnter} style={{ background: "#101010", borderColor: "#101010", color: "var(--bone)" }}>
              Enter the workbench
            </LiquidCarveButton>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ crowd */}
      <section style={{ position: "relative", height: "62vh", minHeight: 380, marginTop: 96, overflow: "hidden" }}>
        <div className="absolute left-1/2 top-10 z-10 -translate-x-1/2 text-center">
          <span className="font-mono uppercase" style={{ fontSize: 12, letterSpacing: "0.04em", color: "var(--graphite)" }}>
            Built for the people who do the work
          </span>
        </div>
        <CrowdCanvas src="/images/peeps/all-peeps.png" rows={15} cols={7} className="absolute bottom-0 h-full w-full" />
        {/* Fade at the top only — the crowd has to keep its feet on the floor,
            and a bottom fade was cutting everyone off at the knees. */}
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: 180, background: "linear-gradient(to bottom, var(--canvas), transparent)" }} />
      </section>

      {/* ----------------------------------------------------------- footer */}
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
