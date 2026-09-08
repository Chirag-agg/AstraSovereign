"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Database,
  Layers,
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
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Upload and manage documents for AI-assisted search and analysis
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
              className="flex items-center gap-2 bg-[#7047eb] hover:bg-[#5a35d4] text-white rounded-xl px-4 py-2 font-semibold transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{uploading ? "Uploading..." : "Upload Document"}</span>
            </button>
          </div>
        </div>

        {/* Index stats (real /health) */}
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600">
            <Database className="w-4 h-4 text-[#7047eb]" />
            Documents: <span className="font-semibold text-slate-900">{documents?.length ?? 0}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600">
            <Layers className="w-4 h-4 text-[#7047eb]" />
            Chunks embedded: <span className="font-semibold text-slate-900">{chunks ?? "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600">
            Embedding: <span className="font-mono text-slate-900">{embedding || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 text-slate-600">
            Vector store: <span className="font-mono text-slate-900">{vectorStore || "local"}</span>
          </div>
        </div>

        {/* Documents Table / Empty State */}
        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {(!documents || documents.length === 0) ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <Database className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-base font-bold text-slate-800">No documents yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Upload documents to build your knowledge base. These documents will be available for semantic search and AI analysis.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3 px-5">Filename</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.document_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-700">{doc.filename}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          doc.status === "ready" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" 
                            : doc.status === "failed"
                            ? "bg-rose-50 text-rose-700 border-rose-200/60"
                            : "bg-amber-50 text-amber-700 border-amber-200/60"
                        }`}>
                          {doc.status || "available"}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => onDeleteDocument(doc.document_id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
