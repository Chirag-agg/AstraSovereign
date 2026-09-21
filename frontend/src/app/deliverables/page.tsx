"use client";

import React from "react";
import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { PAGE, Eyebrow, HairlineCard } from "@/components/landing/atoms";
import { Reveal, ScrollProgress } from "@/lib/motion";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
import { InputBar, ComposerPill } from "@/components/ui/input-bar";

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

export default function DeliverablesPage() {
  const onEnter = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/?login=1";
    }
  };

  return (
    <main style={{ background: "var(--canvas)", color: "var(--bone)", minHeight: "100vh", overflowX: "clip" }}>
      <ScrollProgress />
      <LandingNav currentPath="/deliverables" />

      {/* Hero Header */}
      <section style={{ paddingTop: 80, paddingBottom: 40 }}>
        <div className={PAGE}>
          <Reveal y={20}>
            <Eyebrow>What comes out</Eyebrow>
            <h1 className="display-xl" style={{ margin: "20px 0 0", color: "var(--bone)", maxWidth: "22ch" }}>
              Real files, rendered from one findings object.
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
              The generators all read the same structured assessment. No generator restates a
              verdict, because the first hand-built pass authored three separate payloads and they
              disagreed. A verifier test now asserts the three agree.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Deliverables Cards */}
      <section style={{ paddingTop: 24, paddingBottom: 64 }}>
        <div className={PAGE}>
          <div className="mb-4">
            <span className="mono-label" style={{ color: "var(--stone)" }}>
              Industrial Document Formats
            </span>
          </div>

          <Reveal stagger={0.1} className="grid gap-6 md:grid-cols-3">
            {DELIVERABLES.map((item) => (
              <HairlineCard key={item.ext} style={{ padding: 26 }}>
                <span className="font-mono" style={{ fontSize: 13, color: "var(--signal)", fontWeight: 500 }}>
                  {item.ext}
                </span>
                <h3
                  style={{
                    margin: "14px 0 0",
                    fontFamily: "var(--display)",
                    fontVariationSettings: "'wdth' 88",
                    fontWeight: 500,
                    fontSize: 22,
                    letterSpacing: "-0.025em",
                    color: "var(--bone)",
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ margin: "14px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--granite)" }}>
                  {item.body}
                </p>
              </HairlineCard>
            ))}
          </Reveal>
        </div>
      </section>

      {/* The Desk Preview Section */}
      <section style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div className={PAGE}>
          <div className="mb-6">
            <Eyebrow>The desk</Eyebrow>
            <h2 className="display-m" style={{ margin: "16px 0 0", color: "var(--bone)", maxWidth: "24ch" }}>
              One field, and the context it actually used.
            </h2>
            <p style={{ margin: "16px 0 0", maxWidth: "60ch", fontSize: 16, lineHeight: 1.5, color: "var(--granite)" }}>
              Attachments are explicit. The job records which documents entered its context and shows
              them back on the sent message, so nobody has to trust that retrieval did the right
              thing — they can see what the model was given.
            </p>
          </div>

          <Reveal y={22}>
            <div style={{ border: "1px solid var(--carbon)", borderRadius: 12, padding: "32px 24px", background: "#0d0d0d" }}>
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
              Inspect the four-stage agent pipeline
            </h3>
            <p style={{ maxWidth: "48ch", margin: 0, color: "var(--granite)", fontSize: 15.5, lineHeight: 1.5 }}>
              See how OCR extraction, supersession-aware retrieval, sealed container calculation, and drafting integrate end-to-end.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LiquidCarveButton variant="bone" size="lg" arrow href="/pipeline">
                Explore pipeline
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
