"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Database,
  Layers,
  Eye,
  X,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { getHealth } from "@/lib/api";
import type { DocumentMeta } from "@/lib/types";

interface KnowledgeBaseViewProps {
  documents: DocumentMeta[] | null;
  onUploadDocument: (file: File) => void;
  onDeleteDocument: (id: string) => void;
  uploading: boolean;
}

export default function KnowledgeBaseView({
  documents,
  onUploadDocument,
  onDeleteDocument,
  uploading,
}: KnowledgeBaseViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chunks, setChunks] = useState<number | null>(null);
  const [embedding, setEmbedding] = useState<string>("");
  const [vectorStore, setVectorStore] = useState<string>("");
  const [previewDoc, setPreviewDoc] = useState<DocumentMeta | null>(null);

  useEffect(() => {
    let alive = true;
    getHealth()
      .then((h) => {
        if (!alive) return;
        setChunks(h.knowledge_base.chunks);
        const emb = h.knowledge_base.embedding;
        setEmbedding(typeof emb?.model === "string" ? emb.model : "");
        setVectorStore(h.knowledge_base.vector_store);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadDocument(e.target.files[0]);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Air-gap vector index and document knowledge base for semantic retrieval and tool augmentation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-[#7047eb] hover:bg-[#5a35d4] text-white rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{uploading ? "Uploading..." : "+ Upload Document"}</span>
            </button>
          </div>
        </div>

        {/* Index stats (real /health) */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600 shadow-2xs font-medium">
            <Database className="w-4 h-4 text-[#7047eb]" />
            Documents: <span className="font-bold text-slate-900">{documents?.length ?? 0}</span>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600 shadow-2xs font-medium">
            <Layers className="w-4 h-4 text-[#7047eb]" />
            Chunks embedded: <span className="font-bold text-slate-900">{chunks ?? "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600 shadow-2xs font-medium">
            Embedding: <span className="font-mono text-slate-900 font-bold">{embedding || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600 shadow-2xs font-medium">
            Vector store: <span className="font-mono text-slate-900 font-bold">{vectorStore || "local"}</span>
          </div>
        </div>

        {/* Documents Table / Empty State */}
        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {!documents || documents.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-2">
              <Database className="w-12 h-12 text-slate-300 mb-2" />
              <h3 className="text-base font-bold text-slate-800">No documents yet</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Upload PDFs, Word docs, or text files to build your semantic knowledge base. All documents are processed 100% locally.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3.5 px-5">Filename &amp; ID</th>
                    <th className="py-3.5 px-5">Indexing Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.document_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#7047eb] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block text-xs truncate max-w-xs sm:max-w-md">
                              {doc.filename}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block truncate">
                              ID: {doc.document_id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            doc.status === "ready"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                              : doc.status === "failed"
                              ? "bg-rose-50 text-rose-700 border-rose-200/60"
                              : "bg-amber-50 text-amber-700 border-amber-200/60"
                          }`}
                        >
                          {doc.status || "available"}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteDocument(doc.document_id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center text-[#7047eb] shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-sm">
                    {previewDoc.filename}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {previewDoc.document_id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Index Status
                  </span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {previewDoc.status || "available"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Ingestion Engine
                  </span>
                  <span className="font-semibold text-slate-800">
                    Local Air-Gap Ingestion
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Knowledge Base Index Information</h4>
                <p className="text-slate-600 leading-relaxed text-[11.5px]">
                  This document is indexed in the local JSON vector store under your user namespace. The AI Assistant searches across all embedded chunks during task execution via the <code>document_search</code> tool.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
