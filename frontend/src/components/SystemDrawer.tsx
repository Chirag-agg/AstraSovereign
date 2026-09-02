"use client";

import type { Health } from "@/lib/types";

function BoolDot({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`status ${ok ? "t-ok" : "t-fail"}`}>
      <span className="dot" aria-hidden="true" />
      {text}
    </span>
  );
}

export default function SystemDrawer({
  open,
  onClose,
  health,
  error,
}: {
  open: boolean;
  onClose: () => void;
  health: Health | null;
  error: string | null;
}) {
  if (!open) {
    return null;
  }
  const s = health?.sovereignty;
  const ext = s?.external_connections;
  const models = health?.models ?? {};
  const availableModels = Object.values(models).filter((m) => m.available).length;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="System status">
        <div className="drawer-head">
          <h3>System</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close system panel">
            ×
          </button>
        </div>
        <div className="drawer-body">
          {error && !health ? (
            <div className="banner banner-error" role="alert">
              Backend unavailable — retrying… ({error})
            </div>
          ) : !health ? (
            <div className="loading-row">Loading…</div>
          ) : (
            <>
              <div className="kv-group">
                <div className="kv-group-title">Sovereignty</div>
                <div className="kv">
                  <span className="k">Network policy</span>
                  <span className="v">{s?.network_policy ?? "unknown"}</span>
                </div>
                <div className="kv">
                  <span className="k">External network</span>
                  <span className="v">
                    {ext
                      ? `${ext.status} · ${ext.count} external${
                          ext.blocked_attempts ? ` · ${ext.blocked_attempts} blocked` : ""
                        }`
                      : "UNKNOWN"}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Local model calls</span>
                  <span className="v">{s?.local_model_calls ?? 0}</span>
                </div>
                <div className="kv">
                  <span className="k">Audit logging</span>
                  <span className="v">{s?.audit_logging ? "ENABLED" : "DISABLED"}</span>
                </div>
                <div className="kv">
                  <span className="k">Audit events</span>
                  <span className="v">{s?.audit_events ?? 0}</span>
                </div>
                <div className="kv">
                  <span className="k">Sandbox network</span>
                  <span className="v">{s?.sandbox_network ?? "DISABLED"}</span>
                </div>
              </div>

              <div className="kv-group">
                <div className="kv-group-title">Services</div>
                <div className="kv">
                  <span className="k">Ollama</span>
                  <span className="v">
                    {health.ollama.reachable ? (
                      <BoolDot ok text="online" />
                    ) : (
                      <span className="status t-fail">
                        <span className="dot" aria-hidden="true" /> offline
                      </span>
                    )}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Models</span>
                  <span className="v">
                    {availableModels}/{Object.keys(models).length} available
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Worker</span>
                  <span className="v">{health.worker.state}</span>
                </div>
                <div className="kv">
                  <span className="k">Queue</span>
                  <span className="v">{health.queue_size} waiting</span>
                </div>
                <div className="kv">
                  <span className="k">Knowledge base</span>
                  <span className="v">
                    {health.knowledge_base.documents} docs · {health.knowledge_base.chunks} chunks
                  </span>
                </div>
                <div className="kv">
                  <span className="k">OCR</span>
                  <span className="v">
                    {health.multimodal.ocr.enabled ? (
                      <BoolDot ok text="ready" />
                    ) : (
                      <span className="status t-fail">
                        <span className="dot" aria-hidden="true" /> disabled
                      </span>
                    )}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Vision</span>
                  <span className="v">
                    {health.multimodal.vision.enabled ? (
                      health.multimodal.vision.available ? (
                        <BoolDot ok text="ready" />
                      ) : (
                        <span className="status t-warn">
                          <span className="dot" aria-hidden="true" /> not pulled
                        </span>
                      )
                    ) : (
                      <span className="status t-mut">
                        <span className="dot" aria-hidden="true" /> not configured
                      </span>
                    )}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Document generation</span>
                  <span className="v">{health.document_generation.word}</span>
                </div>
              </div>

              <div className="kv-group">
                <div className="kv-group-title">Resources</div>
                <div className="kv">
                  <span className="k">CPU / RAM</span>
                  <span className="v">
                    {health.scheduler.allocated.cpu_cores} cores ·{" "}
                    {health.scheduler.allocated.memory_mb} MB
                  </span>
                </div>
                {Object.entries(health.scheduler.allocated.gpu).map(([gpu, info]) => (
                  <div className="kv" key={gpu}>
                    <span className="k">GPU {gpu}</span>
                    <span className="v">
                      {info.allocated_vram_mb} / {info.capacity_vram_mb} MB
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
