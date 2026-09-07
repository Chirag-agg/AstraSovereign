import { useEffect, useState } from "react";
import { ArrowDown, Plus, CheckCircle2, Circle } from "lucide-react";
import { getAdminModels } from "@/lib/api";
import type { AdminModelRow } from "@/lib/types";
import { AuditFeed } from "../common/AuditFeed";
import type { AuditEntry, Turn } from "../../lib/types";

const CAP_LABEL: Record<string, string> = {
  reasoning: "Reasoning",
  coding: "Coding",
  vision: "Images & drawings",
  ocr: "Scanned documents",
  embedding: "Search index",
  reranking: "Search ranking",
  general: "General",
};

function capabilityLabel(cap: string): string {
  return CAP_LABEL[cap.toLowerCase()] ?? cap;
}

function TraceStep({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--bg-sunken)", color: "var(--text-tertiary)" }}>
          <Circle size={8} fill="currentColor" />
        </span>
        {!last && <span className="mt-1 w-px flex-1" style={{ background: "var(--border-subtle)" }} />}
      </div>
      <div className="min-w-0 flex-1 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>{label}</p>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  );
}

export function ModelRouting({ turns, auditLog }: { turns: Turn[]; auditLog: AuditEntry[] }) {
  const [showExtend, setShowExtend] = useState(false);
  const [models, setModels] = useState<AdminModelRow[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAdminModels()
      .then((rows) => alive && setModels(rows))
      .catch((err) => alive && setModelsError(err instanceof Error ? err.message : "Could not load the registry."));
    return () => {
      alive = false;
    };
  }, []);

  const activeTurn = turns[turns.length - 1];
  const routedName = activeTurn?.scenario.routedModelName;
  const requirements = activeTurn ? (activeTurn.scenario.categoryLabel || "General reasoning").split("·").map((s) => s.trim()).filter(Boolean) : [];
  const routingActivity = auditLog.filter((e) => e.category === "routing").slice(-12);
  const candidates = models.filter((m) => m.enabled !== false);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Model routing</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            How a request moved through classification to a model, and every open-weight model available to route to.
          </p>
        </div>

        <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>How it moved</p>
        <div className="mb-8 rounded-lg border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          {!activeTurn ? (
            <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              No task has run yet this session. Send a request from Agent Chat to see its routing trace here.
            </p>
          ) : (
            <div>
              <TraceStep label="1 · Request received">
                <p className="text-[13.5px]" style={{ color: "var(--text-primary)" }}>{activeTurn.scenario.label}</p>
              </TraceStep>
              <TraceStep label="2 · Classified">
                <div className="flex flex-wrap gap-1.5">
                  {requirements.length > 0 ? (
                    requirements.map((r) => (
                      <span key={r} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                        {r}
                      </span>
                    ))
                  ) : (
                    <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>task type {activeTurn.scenario.label ? "classified by the worker" : ""}</span>
                  )}
                </div>
              </TraceStep>
              <TraceStep label="3 · Candidates checked">
                <div className="flex flex-col gap-1.5">
                  {candidates.length === 0 ? (
                    <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                      {modelsError ? modelsError : "Loading model registry…"}
                    </span>
                  ) : (
                    candidates.map((m) => {
                      const chosen = m.model === routedName;
                      return (
                        <div key={m.model} className="flex items-center gap-2 text-[12.5px]">
                          <CheckCircle2 size={13} style={{ color: chosen ? "var(--safe-600)" : "var(--text-tertiary)" }} />
                          <span style={{ color: chosen ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: chosen ? 600 : 400 }}>
                            {m.model}
                          </span>
                          <span className="truncate" style={{ color: "var(--text-tertiary)" }}>
                            {chosen ? `matched task type ${m.task_type}` : `bound to ${m.task_type}${m.available ? "" : " · unavailable"}`}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </TraceStep>
              <TraceStep label="4 · Routed to" last>
                <div
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{ borderColor: "var(--accent-strong)", background: "var(--bg-selected)" }}
                >
                  <span className="text-[13.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{routedName ?? "a local model"}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>executed fully on this machine</span>
                </div>
              </TraceStep>
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Model registry</p>
          <ArrowDown size={12} style={{ color: "var(--text-tertiary)" }} />
        </div>
        {modelsError && !models.length ? (
          <p className="rounded-lg border p-4 text-[12.5px]" style={{ borderColor: "var(--alert-100)", background: "var(--alert-100)", color: "var(--alert-600)" }} role="alert">
            {modelsError}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {models.map((m) => {
              const active = m.model === routedName;
              const online = m.available && m.enabled !== false;
              return (
                <div
                  key={m.model}
                  className="rounded-lg border p-4 transition-colors duration-300"
                  style={{
                    borderColor: active ? "var(--accent-strong)" : "var(--border-subtle)",
                    background: active ? "var(--bg-selected)" : "var(--bg-surface)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="break-words text-[13px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>{m.model}</p>
                    <span className="flex shrink-0 items-center gap-1 text-[10.5px]" style={{ color: online ? "var(--safe-600)" : "var(--text-tertiary)" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: online ? "var(--safe-500)" : "var(--text-tertiary)" }} />
                      {online ? "online" : m.available ? "disabled" : "unavailable"}
                    </span>
                  </div>
                  <p className="text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>{m.provider} · routes {m.task_type}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(m.capabilities ?? []).length > 0 ? (
                      m.capabilities.map((c) => (
                        <span key={c} className="rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)" }}>
                          {capabilityLabel(c)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>no capabilities listed</span>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => setShowExtend((v) => !v)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center transition-colors"
              style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
            >
              <Plus size={16} />
              <span className="text-[12.5px] font-medium">Register a new model</span>
            </button>
          </div>
        )}
        {showExtend && (
          <p className="mt-2.5 rounded-md border p-3 text-[12px] leading-relaxed" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-sunken)", color: "var(--text-secondary)" }}>
            New open-weight models plug into the registry by capability profile, no redesign or code changes required.
            Registration is performed by the platform administrator in the operations console.
          </p>
        )}

        <p className="mb-3 mt-8 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Recent routing decisions</p>
        <div className="flex flex-col rounded-lg border" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <AuditFeed
            entries={routingActivity}
            dense={false}
            className="px-4 py-1 max-h-64"
            emptyMessage="No routing decisions yet. Run a sample prompt from Agent Chat."
          />
        </div>
      </div>
    </div>
  );
}
