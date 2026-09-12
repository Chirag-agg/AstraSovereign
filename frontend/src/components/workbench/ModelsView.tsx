import React, { useEffect, useState } from "react";
import { RefreshCw, ServerCog } from "lucide-react";
import { getAdminModels, getHealth } from "@/lib/api";
import type { AdminModelRow } from "@/lib/types";

export default function ModelsView() {
  const [rows, setRows] = useState<AdminModelRow[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [ollama, setOllama] = useState<string>("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [models, health] = await Promise.all([getAdminModels(), getHealth()]);
      setRows(models);
      setDefaultModel(health.default_model);
      setOllama(health.ollama.reachable ? "reachable" : "unreachable");
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

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Model routing & registry</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Real task-type → local model mapping from <code className="text-slate-700">config/models.yaml</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ollama === "reachable" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              Ollama {ollama}
            </span>
            <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {defaultModel ? (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Fallback default model: <span className="font-mono font-semibold text-slate-900">{defaultModel}</span>
          </p>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
            {error}
          </div>
        ) : null}

        {missing.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            <p className="font-semibold">Preflight: {missing.length} enabled model(s) are not pulled locally</p>
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => (
                <li key={m.task_type}>
                  <span className="font-medium">{m.task_type}</span> needs{" "}
                  <code className="font-mono">{m.model}</code> - run{" "}
                  <code className="font-mono">ollama pull {m.model}</code> or edit{" "}
                  <code className="font-mono">config/models.yaml</code>. The backend never auto-pulls.
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Task type</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">Capabilities</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={5}>Loading registry…</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.task_type} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.task_type}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{r.model}</td>
                    <td className="px-4 py-3 text-slate-500">{r.provider}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.capabilities ?? []).map((c) => (
                          <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${r.enabled && r.available ? "text-emerald-600" : r.enabled ? "text-amber-600" : "text-red-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${r.enabled && r.available ? "bg-emerald-500" : r.enabled ? "bg-amber-400" : "bg-red-400"}`} />
                        {r.enabled ? (r.available ? "ready" : "not pulled") : "disabled"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <ServerCog size={13} /> Routing is config-driven; each task type resolves to exactly one enabled local model.
        </p>
      </div>
    </div>
  );
}
