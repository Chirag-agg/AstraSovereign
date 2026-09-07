import { useCallback, useEffect, useState } from "react";
import { List, GitBranch, Lock, RefreshCw, Upload, Trash2, FileText, FileImage, FileSpreadsheet, ScanLine } from "lucide-react";
import { deleteDocument, listDocuments, uploadDocument, getHealth } from "@/lib/api";
import type { DocumentMeta } from "@/lib/types";

function activeUserId(): string {
  try {
    return window.localStorage.getItem("sovereign.active-user") || "user-001";
  } catch {
    return "user-001";
  }
}

function kindIcon(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return ScanLine;
  if (n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp") || n.endsWith(".tif") || n.endsWith(".tiff")) return FileImage;
  if (n.endsWith(".xlsx") || n.endsWith(".csv")) return FileSpreadsheet;
  return FileText;
}

function dateLabel(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  completed: { bg: "var(--safe-100)", fg: "var(--safe-600)", label: "indexed" },
  ready: { bg: "var(--safe-100)", fg: "var(--safe-600)", label: "ready" },
  processing: { bg: "var(--amber-100)", fg: "var(--amber-600)", label: "processing" },
  failed: { bg: "var(--alert-100)", fg: "var(--alert-600)", label: "failed" },
};

export function KnowledgeBase() {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [index, setIndex] = useState<{ documents: number; chunks: number } | null>(null);

  const userId = activeUserId();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, health] = await Promise.all([listDocuments(userId), getHealth()]);
      setDocs(list);
      setIndex({
        documents: health.knowledge_base.documents,
        chunks: health.knowledge_base.chunks,
      });
      setSelectedId((prev) => prev ?? list[0]?.document_id ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the knowledge base.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(userId, file);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteDocument(userId, id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const selected = docs.find((d) => d.document_id === selectedId) ?? null;
  const sorted = [...docs].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="flex w-80 shrink-0 flex-col border-r" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Knowledge base</p>
            <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              {docs.length} document{docs.length === 1 ? "" : "s"} · permission aware
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void refresh()}
              title="Refresh"
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <label
              className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-white transition-colors"
              style={{ background: "var(--accent-solid)" }}
            >
              {uploading ? "Ingesting…" : "Add"}
              <Upload size={11} />
              <input type="file" multiple className="hidden" onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {error ? (
          <div className="border-b px-4 py-2 text-[12px]" style={{ borderColor: "var(--border-subtle)", color: "var(--alert-600)" }} role="alert">
            {error}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto p-2">
          {loading && docs.length === 0 ? (
            <p className="px-2 py-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="px-2 py-3 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              No documents yet. Upload a PDF, scan, spreadsheet or image — it is chunked and embedded locally, never sent off this machine.
            </p>
          ) : (
            sorted.map((doc) => {
              const Icon = kindIcon(doc.filename);
              const active = doc.document_id === selectedId;
              const st = STATUS_STYLE[doc.status] ?? { bg: "var(--bg-sunken)", fg: "var(--text-tertiary)", label: doc.status };
              return (
                <button
                  key={doc.document_id}
                  onClick={() => setSelectedId(doc.document_id)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors"
                  style={{ background: active ? "var(--bg-selected)" : "transparent" }}
                >
                  <Icon size={14} className="mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] leading-snug" style={{ color: active ? "var(--accent-strong)" : "var(--text-primary)" }}>
                      {doc.filename}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
                      {doc.chunk_count > 0 ? `${doc.chunk_count} chunks` : doc.document_type}
                      <span className="rounded-full px-1.5 py-px text-[9px] font-semibold uppercase" style={{ background: st.bg, color: st.fg }}>
                        {st.label}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          {!selected ? (
            <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>Select a document to inspect its indexing state.</p>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{selected.document_type}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: (STATUS_STYLE[selected.status]?.bg ?? "var(--bg-sunken)"), color: (STATUS_STYLE[selected.status]?.fg ?? "var(--text-tertiary)") }}
                  >
                    {STATUS_STYLE[selected.status]?.label ?? selected.status}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold break-words" style={{ color: "var(--text-primary)" }}>{selected.filename}</h2>
                {selected.error ? (
                  <p className="mt-2 text-[13px]" style={{ color: "var(--alert-600)" }}>{selected.error}</p>
                ) : (
                  <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Stored locally and permission-scoped to you. Chunks are embedded on this machine and indexed into the local vector database for retrieval by the agent.
                  </p>
                )}

                <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Uploaded</dt>
                    <dd className="mt-0.5 text-[13px]" style={{ color: "var(--text-primary)" }}>{dateLabel(selected.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Chunks</dt>
                    <dd className="mt-0.5 text-[13px]" style={{ color: "var(--text-primary)" }}>{selected.chunk_count}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Status</dt>
                    <dd className="mt-0.5 text-[13px]" style={{ color: "var(--text-primary)" }}>{selected.status}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Access</dt>
                    <dd className="mt-0.5 flex items-center gap-1 text-[13px]" style={{ color: "var(--text-primary)" }}>
                      <Lock size={11} /> Role and user scoped
                    </dd>
                  </div>
                </dl>

                <button
                  onClick={() => void onDelete(selected.document_id)}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
                  style={{ borderColor: "var(--border-default)", color: "var(--alert-600)" }}
                >
                  <Trash2 size={12} />
                  Remove document
                </button>
              </div>

              <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-sunken)" }}>
                <p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Index status</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {index ? `${index.documents} document${index.documents === 1 ? "" : "s"} · ${index.chunks} chunks in the local vector database.` : "Loading index…"}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                  <List size={11} /> Retrieval is grounded and every query against this index is written to the audit trail.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
