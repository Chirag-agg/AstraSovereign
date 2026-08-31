"use client";

import type { Health } from "@/lib/types";
import ModelStatus from "./ModelStatus";
import StatusBadge from "./StatusBadge";

/** System/resource status panel built from the /health payload. */
export default function ResourcePanel({ health }: { health: Health | null }) {
  if (!health) {
    return (
      <section className="panel" aria-label="System status">
        <div className="panel-title">System status</div>
        <p className="muted">Waiting for backend…</p>
      </section>
    );
  }

  const gpus = Object.entries(health.scheduler.allocated.gpu);

  return (
    <section className="panel" aria-label="System status">
      <div className="panel-title">System status</div>

      <dl className="fact-list">
        <div>
          <dt>Ollama</dt>
          <dd>
            <StatusBadge
              value={health.ollama.reachable ? "reachable" : "error"}
              label={health.ollama.reachable ? "reachable" : "unreachable"}
            />
          </dd>
        </div>
        <div>
          <dt>Worker</dt>
          <dd>{health.worker.state}</dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>{health.queue_size} waiting</dd>
        </div>
        <div>
          <dt>Jobs</dt>
          <dd>
            {health.jobs.running} running · {health.jobs.queued} queued ·{" "}
            {health.jobs.completed} done
          </dd>
        </div>
        <div>
          <dt>CPU / RAM</dt>
          <dd>
            {health.scheduler.allocated.cpu_cores} cores ·{" "}
            {health.scheduler.allocated.memory_mb} MB
          </dd>
        </div>
      </dl>

      {gpus.length > 0 ? (
        <>
          <div className="field-label">GPU (allocated / capacity)</div>
          <table className="mini-table">
            <thead>
              <tr>
                <th scope="col">GPU</th>
                <th scope="col">VRAM</th>
              </tr>
            </thead>
            <tbody>
              {gpus.map(([gpuId, gpu]) => (
                <tr key={gpuId}>
                  <td>{gpuId}</td>
                  <td>
                    {gpu.allocated_vram_mb} / {gpu.capacity_vram_mb} MB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="muted">No GPU in capacity.</p>
      )}

      <ModelStatus health={health} />

      <div className="field-label">Knowledge base</div>
      <p className="fact-line">
        {health.knowledge_base.documents} documents · {health.knowledge_base.chunks}{" "}
        chunks · {health.knowledge_base.vector_store} store
      </p>

      <div className="field-label">Multimodal (OCR + vision)</div>
      <p className="fact-line">
        OCR {health.multimodal.ocr.enabled ? "enabled" : "disabled"} · vision{" "}
        {health.multimodal.vision.model ?? "not configured"} (
        {health.multimodal.vision.available ? "available" : "unavailable"})
      </p>

      <div className="field-label">Document generation</div>
      <p className="fact-line">
        Word {health.document_generation.available ? "available" : "unavailable"} ·{" "}
        {health.document_generation.artifacts.artifacts} artifact(s) registered
      </p>
    </section>
  );
}
