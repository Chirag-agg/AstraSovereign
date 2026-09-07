import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { downloadArtifact, listArtifacts } from "@/lib/api";
import type { ArtifactSummary } from "@/lib/types";
import { DeliverableCard } from "../chat/DeliverableCard";
import type { Deliverable } from "../../lib/types";

function activeUserId(): string {
  try {
    return window.localStorage.getItem("sovereign.active-user") || "user-001";
  } catch {
    return "user-001";
  }
}

function typeFromName(name: string): Deliverable["type"] {
  const n = name.toLowerCase();
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "xlsx";
  if (n.endsWith(".pptx") || n.endsWith(".ppt")) return "pptx";
  if (n.endsWith(".py") || n.endsWith(".js") || n.endsWith(".ts") || n.endsWith(".sh")) return "code";
  return "docx";
}

function dateLabel(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function Vault() {
  const userId = activeUserId();
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setArtifacts(await listArtifacts(userId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the vault.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const download = async (artifact: ArtifactSummary) => {
    const { blob } = await downloadArtifact(userId, artifact.job_id, artifact.artifact_id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const sorted = [...artifacts].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const completed = sorted.filter((a) => a.status !== "failed");

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Vault</h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Every deliverable the agent generated for you, kept on this machine.
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            title="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
            style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--alert-100)", background: "var(--alert-100)", color: "var(--alert-600)" }} role="alert">
            {error}
          </div>
        ) : null}

        <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          Generated deliverables · {completed.length}
        </p>
        {loading && completed.length === 0 ? (
          <p className="rounded-lg border p-4 text-[12.5px]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-tertiary)" }}>
            Loading…
          </p>
        ) : completed.length === 0 ? (
          <p className="rounded-lg border p-4 text-[12.5px]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-tertiary)" }}>
            Nothing produced yet. Ask the agent in Agent Chat to draft a document or run code, and the generated files will appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {completed.map((a) => {
              const deliverable: Deliverable = {
                type: typeFromName(a.filename),
                name: a.filename,
                summary: `Generated ${dateLabel(a.created_at)} · ${(a.size_bytes / 1024).toFixed(1)} KB · ${a.job_id.slice(0, 10)}`,
              };
              return (
                <DeliverableCard
                  key={a.artifact_id}
                  deliverable={deliverable}
                  locked={a.status === "creating"}
                  onDownload={() => download(a)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
