import React, { useEffect, useState } from "react";
import { RefreshCw, ServerCog } from "lucide-react";
import { FigurePanel, StatSlab, NumberedList } from "@/components/ui/instrument";
import { getAdminModels, getHealth } from "@/lib/api";
import type { AdminModelRow, Health } from "@/lib/types";

export default function ModelsView() {
  const [rows, setRows] = useState<AdminModelRow[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [ollama, setOllama] = useState<string>("unknown");
  const [resolved, setResolved] = useState<NonNullable<Health["models_resolved"]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [models, health] = await Promise.all([getAdminModels(), getHealth()]);
      setRows(models);
      setDefaultModel(health.default_model);
      setOllama(health.ollama.reachable ? "reachable" : "unreachable");
      setResolved(health.models_resolved ?? {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load model registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missing = rows.filter((r) => r.enabled && !r.available);
  const activeFallbacks = Object.entries(resolved).filter(([, v]) => v.fallback_active);

  const ready = rows.filter((r) => r.enabled && r.available).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Registry</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>Model routing &amp; registry</h1>
            <p style={{ margin: "8px 0 0" }}>
              Task type → local model, read from <code className="font-mono" style={{ color: "var(--bone)" }}>config/models.yaml</code>.
              Each type resolves to exactly one enabled local model; the backend never auto-pulls.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center gap-2 font-mono uppercase"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.1em",
                padding: "6px 10px",
                borderRadius: 2,
                border: `1px solid ${ollama === "reachable" ? "var(--metric)" : "var(--ochre)"}`,
                color: ollama === "reachable" ? "var(--metric)" : "var(--ochre)",
              }}
            >
              <span className="astra-pulse" style={{ width: 5, height: 5, background: "currentColor" }} />
              Ollama {ollama}
            </span>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 font-mono uppercase"
              style={{ fontSize: 10.5, letterSpacing: "0.08em", padding: "7px 11px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div role="alert" style={{ borderLeft: "2px solid var(--alert)", padding: "10px 14px", background: "var(--alert-surface)", borderRadius: 2, fontSize: 13, color: "var(--alert-ink)" }}>
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab value={String(ready)} label="Models ready" tone={ready > 0 ? "signal" : "neutral"} />
            <FigurePanel figure="1" title="Resolution order" caption="how a node gets a model">
              <NumberedList
                index={1}
                items={[
                  { title: "Node asks for a capability", detail: "extract and retrieve ask for document, compute for coding, draft for general." },
                  { title: "Router reads the registry", detail: "the configured model for that capability, if it is enabled." },
                  { title: "Declared fallback, or the floor", detail: "a bounded chain of at most two hops, else general. Every substitution is recorded." },
                ]}
              />
            </FigurePanel>
          </div>

          <div className="flex flex-col gap-4">
            {(activeFallbacks.length > 0 || missing.length > 0) && (
              <FigurePanel figure="2" title="Preflight" caption="run this before a demo">
                {activeFallbacks.length > 0 && (
                  <div style={{ marginBottom: missing.length > 0 ? 14 : 0 }}>
                    <span className="mono-label" style={{ color: "var(--ochre)" }}>
                      {activeFallbacks.length} active fallback(s)
                    </span>
                    <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                      {activeFallbacks.map(([task, v]) => (
                        <li key={task} className="font-mono" style={{ fontSize: 12, padding: "5px 0", color: "var(--granite)" }}>
                          <span style={{ color: "var(--bone)" }}>{task}</span> · {v.configured} missing → {v.effective}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {missing.length > 0 && (
                  <div>
                    <span className="mono-label" style={{ color: "var(--ochre)" }}>
                      {missing.length} enabled model(s) not pulled
                    </span>
                    <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                      {missing.map((m) => (
                        <li key={m.task_type} className="font-mono" style={{ fontSize: 12, padding: "5px 0", color: "var(--granite)" }}>
                          <span style={{ color: "var(--bone)" }}>{m.task_type}</span> needs {m.model} —{" "}
                          <span style={{ color: "var(--signal)" }}>ollama pull {m.model}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </FigurePanel>
            )}

            <FigurePanel
              figure="3"
              title="Capability map"
              caption={defaultModel ? `fallback default · ${defaultModel}` : undefined}
              flush
            >
              <table>
                <thead>
                  <tr>
                    <th>Task type</th>
                    <th>Model</th>
                    <th>Provider</th>
                    <th>Capabilities</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="font-mono" style={{ color: "var(--graphite)" }}>Loading registry…</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="font-mono" style={{ color: "var(--graphite)" }}>No models configured.</td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const state = r.enabled ? (r.available ? "ready" : "not pulled") : "disabled";
                      const tone = state === "ready" ? "var(--metric)" : state === "not pulled" ? "var(--ochre)" : "var(--alert)";
                      return (
                        <tr key={r.task_type}>
                          <td>{r.task_type}</td>
                          <td className="font-mono" style={{ color: "var(--signal)" }}>
                            {r.model}
                            {resolved[r.task_type]?.fallback_active ? (
                              <span style={{ color: "var(--ochre)" }}> → {resolved[r.task_type]?.effective}</span>
                            ) : null}
                          </td>
                          <td className="font-mono">{r.provider}</td>
                          <td>
                            <span className="flex flex-wrap gap-1">
                              {(r.capabilities ?? []).map((c) => (
                                <span
                                  key={c}
                                  className="font-mono"
                                  style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 2, border: "1px solid var(--carbon)", color: "var(--granite)" }}
                                >
                                  {c}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: tone }}>
                              <span style={{ width: 5, height: 5, borderRadius: 99, background: tone }} />
                              {state}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </FigurePanel>
          </div>
        </div>

        <p className="flex items-center gap-1.5 font-mono" style={{ fontSize: 11, color: "var(--graphite)" }}>
          <ServerCog size={12} /> Adding a model is a config change, not a redesign.
        </p>
      </div>
    </div>
  );
}
