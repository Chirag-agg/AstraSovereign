"use client";

import React from "react";
import Link from "next/link";
import { AstraWordmark } from "@/components/brand/AstraMark";
import { PAGE } from "@/components/landing/atoms";
import { MEASURED_AT, MEASURED_REF } from "@/lib/metrics";

export function LandingFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--carbon)", paddingTop: 56, paddingBottom: 56 }}>
      <div className={PAGE}>
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Link href="/" style={{ textDecoration: "none", display: "inline-block" }}>
              <AstraWordmark />
            </Link>
            <p style={{ margin: "16px 0 0", maxWidth: "36ch", fontSize: 14, lineHeight: 1.5, color: "var(--granite)" }}>
              Sovereign on-premise agentic AI workbench for confidential industrial work.
              Multi-model routing, local OCR and vision, a sealed code sandbox, and real Word, Excel and PowerPoint deliverables.
            </p>
          </div>
          {[
            [
              "System",
              [
                { label: "Pipeline", href: "/pipeline" },
                { label: "Model routing", href: "/pipeline#routing" },
                { label: "Tool surface", href: "/pipeline#tools" },
                { label: "Workbench", href: "/?login=1" },
              ],
            ],
            [
              "Evidence",
              [
                { label: "Sovereignty proof", href: "/proof" },
                { label: "Audit chain", href: "/proof#audit" },
                { label: "Benchmarks", href: "/benchmarks" },
                { label: "Deliverables", href: "/deliverables" },
              ],
            ],
            [
              "Deployment",
              [
                { label: "Offline bundle", href: "/proof" },
                { label: "Docker sandbox", href: "/pipeline" },
                { label: "Local accounts", href: "/?login=1" },
                { label: "System metrics", href: "/benchmarks" },
              ],
            ],
          ].map(([heading, links]) => (
            <div key={heading as string}>
              <div className="mono-label" style={{ color: "var(--bone)" }}>
                {heading as string}
              </div>
              <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
                {(links as { label: string; href: string }[]).map((link) => (
                  <li key={link.label} style={{ padding: "5px 0" }}>
                    <Link
                      href={link.href}
                      style={{ fontSize: 14, color: "var(--granite)", textDecoration: "none" }}
                      className="hover:text-[var(--bone)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="mt-12 flex flex-wrap items-center justify-between gap-4 font-mono"
          style={{ fontSize: 11, color: "var(--graphite)" }}
        >
          <span>Every figure on this page was measured on {MEASURED_REF} at {MEASURED_AT}.</span>
          <span>Zero cloud egress · Local weights only</span>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
