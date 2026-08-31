"use client";

import type { Health } from "@/lib/types";
import StatusBadge from "./StatusBadge";

/** Per-task-type model availability from /health. */
export default function ModelStatus({ health }: { health: Health | null }) {
  const models = health?.models;
  if (!models) {
    return (
      <div className="model-status">
        <div className="field-label">Local models</div>
        <p className="muted">Unknown.</p>
      </div>
    );
  }
  const entries = Object.entries(models);
  return (
    <div className="model-status">
      <div className="field-label">Local models (task → model)</div>
      <table className="mini-table">
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">Model</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([task, info]) => (
            <tr key={task}>
              <td>{task}</td>
              <td>{info.configured}</td>
              <td>
                {info.enabled ? (
                  <StatusBadge value={info.available ? "available" : "not_required"} label={info.available ? "available" : "not pulled"} />
                ) : (
                  <StatusBadge value="released" label="disabled" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
