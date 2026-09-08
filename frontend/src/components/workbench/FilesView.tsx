"use client";

import React, { useState } from "react";
import {
  FolderOpen,
  FileText,
  Download,
  CheckCircle2,
  HardDrive,
  Clock,
  Search,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Lock,
} from "lucide-react";
import type { ArtifactSummary, DocumentMeta } from "@/lib/types";

interface FilesViewProps {
  user?: string;
  artifacts?: ArtifactSummary[] | null;
  documents?: DocumentMeta[] | null;
  onDownloadArtifact?: (artifact: ArtifactSummary) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function FilesView({
  user = "user-001",
  artifacts,
  documents,
  onDownloadArtifact,
}: FilesViewProps) {
  const [tab, setTab] = useState<"all" | "deliverables" | "documents">("all");
  const [search, setSearch] = useState("");

  const deliverables = artifacts || [];
  const docs = documents || [];

  const filteredDeliverables = deliverables.filter((a) =>
    a.filename.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDocs = docs.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Workspace Files & Assets
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                Phase 4 & 9 Isolated
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Browse generated Word deliverables, uploaded source documents, and per-job workspace assets for {user}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-xs flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Scope: <strong>data/workspaces/{user}</strong></span>
            </span>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                tab === "all"
                  ? "bg-[#7047eb] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Files ({deliverables.length + docs.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("deliverables")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                tab === "deliverables"
                  ? "bg-[#7047eb] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Generated Deliverables ({deliverables.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("documents")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                tab === "documents"
                  ? "bg-[#7047eb] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Knowledge Documents ({docs.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {/* 1. Deliverables Section */}
        {(tab === "all" || tab === "deliverables") && (
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-[#7047eb]" />
                <h2 className="text-sm font-bold text-slate-900">Generated Office Deliverables</h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {filteredDeliverables.length} files
              </span>
            </div>

            {filteredDeliverables.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No deliverable files generated yet. Ask the AI Assistant to generate a Word document or report!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDeliverables.map((artifact) => (
                  <div
                    key={artifact.artifact_id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-purple-200 bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-purple-50 text-[#7047eb] rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate" title={artifact.filename}>
                          {artifact.filename}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatBytes(artifact.size_bytes)} • job: {artifact.job_id.slice(0, 8)}
                        </div>
                      </div>
                    </div>

                    {onDownloadArtifact && (
                      <button
                        type="button"
                        onClick={() => onDownloadArtifact(artifact)}
                        className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors shrink-0"
                        title="Download deliverable"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Knowledge Documents Section */}
        {(tab === "all" || tab === "documents") && (
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Knowledge Base Source Documents</h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">{filteredDocs.length} files</span>
            </div>

            {filteredDocs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No documents uploaded yet. Upload inspection manuals, text PDFs, or images in Documents!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-emerald-200 bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                        {doc.document_type.includes("image") ? (
                          <ImageIcon className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate" title={doc.filename}>
                          {doc.filename}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {doc.chunk_count} chunks • {doc.status}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        doc.status === "ready"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
