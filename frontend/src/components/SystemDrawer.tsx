"use client";

import type { Health } from "@/lib/types";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

function Dot({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`status ${ok ? "t-ok" : "t-fail"}`}>
      <span className="dot" aria-hidden="true" />
      {text}
    </span>
  );
}

/**
 * User-facing "Local & privacy" panel. Deliberately minimal: only verified,
 * easy-to-understand local-processing facts. No model registry tables, GPU or
 * queue internals, or other infrastructure metrics.
 */
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

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Local and privacy">
        <div className="drawer-head">
          <h3>Local &amp; privacy</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            ×
          </button>
        </div>
        <div className="drawer-body">
          {error && !health ? (
            <div className="banner banner-error" role="alert">
              The local backend is unavailable — retrying… ({error})
            </div>
          ) : !health ? (
            <div className="loading-row">Loading…</div>
          ) : (
            <>
              <div className="kv-group">
                <div className="kv-group-title">Your work stays here</div>
                <p style={{ margin: "4px 0 8px", color: "var(--text-2)", fontSize: 13 }}>
                  Your requests, documents, and results are processed by local models
                  on this machine. Nothing is sent to the internet.
                </p>
                <Row k="Local processing" v={<Dot ok text="on this machine" />} />
                <Row
                  k="External network"
                  v={ext ? `${ext.status} · ${ext.count} external` : "UNKNOWN"}
                />
                <Row k="Audit logging" v={s?.audit_logging ? "ENABLED" : "DISABLED"} />
                <Row k="Sandbox isolation" v={s?.sandbox_network ?? "DISABLED"} />
              </div>

              <div className="kv-group">
                <div className="kv-group-title">Local services</div>
                <Row k="Models" v={health.ollama.reachable ? <Dot ok text="available" /> : <Dot ok={false} text="offline" />} />
                <Row
                  k="Your knowledge base"
                  v={`${health.knowledge_base?.documents ?? 0} document(s) indexed`}
                />
                <Row
                  k="OCR & vision"
                  v={
                    health.multimodal.ocr.enabled
                      ? "available locally"
                      : "not available"
                  }
                />
                <Row k="Local model calls" v={String(s?.local_model_calls ?? 0)} />
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
