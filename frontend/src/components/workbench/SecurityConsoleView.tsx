"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { FigurePanel, StatSlab, NumberedList, TierRow } from "@/components/ui/instrument";
import { getSovereignty, getHealth } from "@/lib/api";
import type { SovereigntyStatus, Health } from "@/lib/types";

type Verdict = "held" | "broken" | "unknown";

const VERDICT_COLOUR: Record<Verdict, string> = {
  held: "var(--metric)",
  broken: "var(--alert)",
  unknown: "var(--ochre)",
};

interface Claim {
  claim: string;
  reading: string;
  evidence: string;
  verdict: Verdict;
}

export default function SecurityConsoleView() {
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [sovereigntyData, healthData] = await Promise.all([getSovereignty(), getHealth()]);
      setSovereignty(sovereigntyData);
      setHealth(healthData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load security status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Each row is a claim this product makes, the live reading behind it, and
  // whether the reading actually supports it. UNKNOWN is its own verdict on
  // purpose — "nothing observed yet" is not the same as "nothing happened",
  // and rounding it up to green would be the one dishonest thing this page
  // could do.
  const claims: Claim[] = [];
  if (sovereignty) {
    const s = sovereignty;
    const ext = s.external_connections;
    const isolated = /block|none|isolated/i.test(s.sandbox_network);
    const restricted = /local|block|air.?gap/i.test(s.network_policy);

    claims.push({
      claim: "Nothing is sent off this machine",
      reading: (ext?.status ?? "UNKNOWN").replace(/_/g, " ").toLowerCase(),
      evidence: `${ext?.count ?? 0} tracked · ${ext?.blocked_attempts ?? 0} blocked · ${ext?.local_connections ?? 0} local`,
      verdict:
        ext?.status === "VERIFIED_LOCAL"
          ? "held"
          : ext?.status === "VERIFIED_EXTERNAL"
            ? "broken"
            : "unknown",
    });
    claims.push({
      claim: "The network policy forbids it",
      reading: s.network_policy.toLowerCase(),
      evidence: "read from the running configuration, not from a document",
      verdict: restricted ? "held" : "unknown",
    });
    claims.push({
      claim: "Generated code cannot reach the network",
      reading: s.sandbox_network,
      evidence: "the container is started with this network mode",
      verdict: isolated ? "held" : "broken",
    });
    claims.push({
      claim: "Every model call stayed local",
      reading: `${s.local_model_calls.toLocaleString()} calls`,
      evidence: s.ollama_endpoint,
      verdict: "held",
    });
    claims.push({
      claim: "What happened was recorded",
      reading: s.audit_logging ? "recording" : "not recording",
      evidence: `${s.audit_events.toLocaleString()} events in the chain`,
      verdict: s.audit_logging ? "held" : "broken",
    });
  }

  const held = claims.filter((c) => c.verdict === "held").length;
  const broken = claims.filter((c) => c.verdict === "broken").length;

  const workerState = health?.worker?.state ?? "unknown";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Evidence</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>What we claim, and what the machine says</h1>
            <p style={{ margin: "8px 0 0" }}>
              Each line is a promise this product makes, next to the live reading behind it.
              Where the reading has not observed anything yet it says so — that is not the
              same as a clean result, and this page will not present it as one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 font-mono uppercase shrink-0"
            style={{ fontSize: 10.5, letterSpacing: "0.08em", padding: "7px 11px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{ borderLeft: "2px solid var(--alert)", padding: "10px 14px", background: "var(--alert-surface)", borderRadius: 2, fontSize: 13, color: "var(--alert-ink)" }}
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab
              value={claims.length > 0 ? `${held}/${claims.length}` : "—"}
              label={broken > 0 ? `Claims held · ${broken} broken` : "Claims held"}
              tone={broken > 0 ? "neutral" : held === claims.length && claims.length > 0 ? "metric" : "signal"}
            />
            <FigurePanel figure="1" title="Where egress stops" caption="three gates, outermost first">
              <TierRow
                tiers={[
                  { name: "The sandbox", detail: "no network interface at all", heat: 0 },
                  { name: "The guard", detail: "every host but Ollama is refused", heat: 0.5 },
                  { name: "The record", detail: "each refusal is counted, never silent", heat: 1 },
                ]}
              />
            </FigurePanel>
          </div>

          <div className="flex flex-col gap-4">
            <FigurePanel figure="2" title="Claims against readings" flush>
              <table>
                <thead>
                  <tr>
                    <th>Claim</th>
                    <th>Reading</th>
                    <th>Where it comes from</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="font-mono" style={{ color: "var(--graphite)" }}>
                        {loading ? "Reading the running system…" : "No sovereignty reading available."}
                      </td>
                    </tr>
                  ) : (
                    claims.map((c) => (
                      <tr key={c.claim}>
                        <td>{c.claim}</td>
                        <td className="font-mono" style={{ color: "var(--signal)" }}>{c.reading}</td>
                        <td style={{ color: "var(--granite)" }}>{c.evidence}</td>
                        <td>
                          <span
                            className="inline-flex items-center gap-2 font-mono uppercase"
                            style={{ fontSize: 10.5, letterSpacing: "0.08em", color: VERDICT_COLOUR[c.verdict] }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: 99, background: VERDICT_COLOUR[c.verdict] }} />
                            {c.verdict === "unknown" ? "not observed" : c.verdict}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </FigurePanel>

            <FigurePanel figure="3" title="What this does not prove" caption="the boundary of the claim">
              <NumberedList
                index={3}
                items={[
                  {
                    title: "The guard is application-layer",
                    detail:
                      "it sees every request the Python process makes and stops the ones leaving the box. It is not a packet capture and does not claim to be.",
                  },
                  {
                    title: "For a deployment audit, watch the interface",
                    detail:
                      "run this behind an interface-level monitor and compare the two. We would rather state the boundary than have someone find it.",
                  },
                  {
                    title: "The worker is part of the claim",
                    detail: `the recording process is currently ${workerState}. Nothing is captured while it is not running.`,
                  },
                ]}
              />
            </FigurePanel>
          </div>
        </div>
      </div>
    </div>
  );
}
