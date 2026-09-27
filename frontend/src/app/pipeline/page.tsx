"use client";

import React from "react";
import Link from "next/link";
import { gsap } from "gsap";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { PAGE, Eyebrow, Section } from "@/components/landing/atoms";
import { Reveal, ScrollProgress, useGsap, prefersReducedMotion } from "@/lib/motion";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
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
import { MODEL_ROSTER, TOOL_SURFACE } from "@/lib/metrics";

const PIPELINE = [
  {
    node: "extract",
    capability: "document",
    model: "qwen3-vl:latest",
    body: "Reads the attachment end to end — text layer, OCR for scans, vision on the embedded figures only. Exits by calling submit_findings with a typed object, or it degrades. It is not allowed to answer in prose.",
    tools: ["read_document", "document_vision", "document_exact_search", "submit_findings"],
  },
  {
    node: "retrieve",
    capability: "document",
    model: "qwen3-vl:latest",
    body: "Grounds the findings in your own SOPs and correspondence. Ranking is supersession-aware: a superseded revision can never outrank the current one on an equal match.",
    tools: ["document_search", "document_exact_search"],
  },
  {
    node: "compute",
    capability: "coding",
    model: "devstral:24b",
    body: "Writes the calculation and runs it in a Docker container with no network. A number is only accepted if a real sandbox run succeeded — the node re-reads its own trace to prove it, so a confident model cannot talk its way past the gate.",
    tools: ["code_execution"],
  },
  {
    node: "draft",
    capability: "general",
    model: "gpt-oss:20b",
    body: "Renders the deliverables. When an assessment exists it calls the generators directly from Python — no model turn — so the Word, Excel and PowerPoint files cannot disagree with each other.",
    tools: ["document_generation", "presentation_generation"],
  },
];

function PipelineRail() {
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
          duration: 1.2,
        },
      );
    }
    gsap.from(rows, {
      opacity: 0,
      x: -14,
      duration: 0.6,
      stagger: 0.12,
      ease: "power3.out",
    });
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--carbon)" }}
        aria-hidden="true"
      >
        <div data-rail-fill style={{ position: "absolute", inset: 0, background: "var(--signal)" }} />
      </div>

      <div className="grid gap-px" style={{ marginLeft: 2 }}>
        {PIPELINE.map((stage, index) => (
          <div
            key={stage.node}
            data-stage
            className="astra-card grid gap-6 md:grid-cols-[200px_minmax(0,1fr)_240px]"
            style={{ borderBottom: "1px solid var(--carbon)", padding: "28px 0 28px 28px" }}
          >
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono tnum" style={{ fontSize: 12, color: "var(--signal)" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontFamily: "var(--display)",
                    fontVariationSettings: "'wdth' 86",
                    fontWeight: 500,
                    fontSize: 26,
                    letterSpacing: "-0.03em",
                    color: "var(--bone)",
                  }}
                >
                  {stage.node}
                </span>
              </div>
              <div className="mono-label" style={{ marginTop: 8 }}>
                {stage.capability}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--granite)" }}>
              {stage.body}
            </p>
            <div>
              <div className="font-mono" style={{ fontSize: 12, color: "var(--signal)" }}>
                {stage.model}
              </div>
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                {stage.tools.map((tool) => (
                  <li
                    key={tool}
                    className="font-mono"
                    style={{ fontSize: 11, lineHeight: 1.85, color: "var(--graphite)" }}
                  >
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

export default function PipelinePage() {
  const dockItems: DockItemData[] = [
    { id: "desk", label: "The desk", icon: <DockIconDesk />, meta: "task-first" },
    { id: "docs", label: "Documents", icon: <DockIconDocuments />, meta: "local RAG" },
    { id: "router", label: "Router", icon: <DockIconRouter />, meta: "5 capabilities" },
    { id: "sandbox", label: "Sandbox", icon: <DockIconSandbox />, meta: "--network none" },
    { id: "vision", label: "Vision + OCR", icon: <DockIconVision />, meta: "RapidOCR · qwen3-vl" },
    { id: "deliverables", label: "Deliverables", icon: <DockIconDeliverables />, meta: "docx · xlsx · pptx" },
    { id: "audit", label: "Audit", icon: <DockIconAudit />, meta: "25 event types" },
    { id: "sovereignty", label: "Sovereignty", icon: <DockIconShield />, meta: "egress 0 B" },
  ];

  return (
    <main style={{ background: "var(--canvas)", color: "var(--bone)", minHeight: "100vh", overflowX: "clip" }}>
      <ScrollProgress />
      <LandingNav currentPath="/pipeline" />

      {/* Hero Header */}
      <section style={{ paddingTop: 80, paddingBottom: 32 }}>
        <div className={PAGE}>
          <Reveal y={20}>
            <Eyebrow>How a task runs</Eyebrow>
            <h1 className="display-xl" style={{ margin: "20px 0 0", color: "var(--bone)", maxWidth: "20ch" }}>
              Four typed stages. Each one picks its own model.
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
              There is no single prompt and no single model. A job moves through a fixed node sequence, and every node
              resolves its own capability through the router, holding the GPU reservation across consecutive nodes that
              share a model so nothing thrashes in and out of VRAM.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Stages Section */}
      <section style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div className={PAGE}>
          <PipelineRail />
        </div>
      </section>

      {/* Model Auto-selection Section */}
      <Section
        id="routing"
        eyebrow="Model auto-selection"
        title="Routing is config, not code."
        lede="config/models.yaml maps each capability to a local model with declared resources and an optional bounded fallback chain. Chains are validated at load — every target must satisfy the capability and support tool calling, with no cycles — and an invalid chain refuses startup rather than degrading quietly at runtime."
      >
        <Reveal y={22}>
          <div style={{ border: "1px solid var(--carbon)", borderRadius: 10, overflow: "hidden" }}>
            <div
              className="grid font-mono uppercase md:grid-cols-[170px_minmax(0,1fr)_150px_120px]"
              style={{
                fontSize: 11,
                letterSpacing: "-0.02em",
                color: "var(--graphite)",
                padding: "13px 22px",
                borderBottom: "1px solid var(--carbon)",
              }}
            >
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
                <span className="font-mono" style={{ fontSize: 13, color: "var(--signal)" }}>
                  {entry.model}
                </span>
                <span className="font-mono tnum" style={{ fontSize: 13, color: "var(--stone)" }}>
                  {entry.vram_mb} MB
                </span>
                <span className="font-mono" style={{ fontSize: 13, color: "var(--granite)" }}>
                  ollama
                </span>
              </div>
            ))}
            <div style={{ padding: "16px 22px", fontSize: 13.5, lineHeight: 1.55, color: "var(--granite)" }}>
              Embeddings run on <span className="font-mono" style={{ color: "var(--bone)" }}>nomic-embed-text</span>,
              also local. Model residency is read back from Ollama&rsquo;s own{" "}
              <span className="font-mono" style={{ color: "var(--bone)" }}>/api/ps</span>, so the console can show what
              the scheduler believes and what is actually in VRAM side by side — the gap between those two numbers is the
              honest signal.
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Tool Surface Section */}
      <Section
        id="tools"
        eyebrow="Tool surface"
        title="Eleven tools. All of them local."
        lede="The agent cannot reach anything that is not in this list, and a node cannot see a tool outside its own set — a constraint enforced in the registry rather than in prompt wording, because prompt wording is not a security boundary."
      >
        <Reveal stagger={0.035} className="flex flex-wrap gap-2">
          {TOOL_SURFACE.map((tool) => (
            <span
              key={tool}
              className="astra-chip font-mono"
              style={{
                fontSize: 13,
                padding: "10px 15px",
                border: "1px solid var(--carbon)",
                borderRadius: 3,
                color: "var(--stone)",
                position: "relative",
                zIndex: 0,
              }}
            >
              {tool}
            </span>
          ))}
        </Reveal>
        <div className="mt-12 flex justify-center">
          <MagneticDock items={dockItems} />
        </div>
      </Section>

      {/* Next Section Banner */}
      <section style={{ paddingTop: 96, paddingBottom: 120 }}>
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
              The sovereign claim & air-gapped proof
            </h3>
            <p style={{ maxWidth: "48ch", margin: 0, color: "var(--granite)", fontSize: 15.5, lineHeight: 1.5 }}>
              Review the sealed Docker sandbox network isolation, NetworkGuard transport rules, and hash-chained audit verification.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LiquidCarveButton variant="bone" size="lg" arrow href="/proof">
                Read the proof
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
