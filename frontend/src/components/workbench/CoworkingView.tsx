"use client";

import React, { useEffect, useState, useCallback, type FormEvent } from "react";
import {
  FolderOpen,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { listProjects, createProject } from "@/lib/api";
import type { ProjectMeta } from "@/lib/api";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

function formatUpdated(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

interface CoworkingViewProps {
  onOpenAgentWorkspace?: (taskPrompt?: string) => void;
}

export default function CoworkingView({}: CoworkingViewProps) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listProjects(activeUserId());
      setProjects(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;
      setCreating(true);
      setError(null);
      try {
        await createProject(activeUserId(), trimmed);
        setName("");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project");
      } finally {
        setCreating(false);
      }
    },
    [name, load],
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Cowork
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Your persistent project AI-IDE
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex items-start gap-4">
          <div className="p-2.5 bg-[#7047eb]/10 text-[#7047eb] rounded-xl shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Cowork is the persistent project AI-IDE
            </h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed max-w-3xl">
              Each project keeps a real workspace of files plus an ongoing agent
              session with history and decisions. Open a project below to continue
              building it — your files, traces and artifacts stay with the project.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-4 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name…"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#7047eb]/40"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="inline-flex items-center justify-center gap-2 bg-[#7047eb] hover:bg-[#5a35d4] text-white rounded-xl px-4 py-2 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{creating ? "Creating..." : "New project"}</span>
          </button>
        </form>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16 bg-white border border-slate-200/80 rounded-2xl">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl py-16 flex flex-col items-center justify-center text-center px-6">
            <FolderOpen className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No projects yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Create your first Cowork project to start building persistent, agent-managed workspaces.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div
                key={p.project_id}
                className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[#7047eb]/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-[#7047eb]/10 text-[#7047eb] rounded-xl shrink-0">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-800 truncate">{p.name}</h3>
                    <p className="text-[11px] font-mono text-slate-400 truncate">{p.project_id}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Updated {formatUpdated(p.updated_at)}</span>
                </div>
                <a
                  href="/cowork"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#7047eb]/40 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors group"
                >
                  Open in IDE
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#7047eb] transition-colors" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
