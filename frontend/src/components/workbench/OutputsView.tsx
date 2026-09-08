"use client";

import React, { useState } from "react";
import {
  Archive,
  FileText,
  Download,
  Eye,
  X,
  FileCode,
  Calendar,
  Layers,
  CheckCircle2,
} from "lucide-react";
import type { ArtifactSummary } from "@/lib/types";
import { downloadArtifact } from "@/lib/api";

function activeUserId(): string {
  if (typeof window === "undefined") return "user-001";
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

interface OutputsViewProps {
  artifacts: ArtifactSummary[] | null;
  onDownloadArtifact: (artifact: ArtifactSummary) => void;
}

export default function OutputsView({
  artifacts,
  onDownloadArtifact,
}: OutputsViewProps) {
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactSummary | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleOpenPreview = async (artifact: ArtifactSummary) => {
    setPreviewArtifact(artifact);
    setPreviewText(null);
    setLoadingPreview(true);

    const isTextual =
      artifact.filename.endsWith(".txt") ||
      artifact.filename.endsWith(".md") ||
      artifact.filename.endsWith(".py") ||
      artifact.filename.endsWith(".json") ||
      artifact.filename.endsWith(".log") ||
      artifact.type === "code" ||
      artifact.type === "text";

    if (isTextual) {
      try {
        const { blob } = await downloadArtifact(activeUserId(), artifact.job_id, artifact.artifact_id);
        const text = await blob.text();
        setPreviewText(text);
      } catch {
        setPreviewText("Could not load preview text for this artifact.");
      } finally {
        setLoadingPreview(false);
      }
    } else {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Deliverables &amp; Artifacts
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Preview and download generated documents, analysis notes, code, and compliance reports.
            </p>
          </div>
        </div>

        {/* Deliverables List Table */}
        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {!artifacts || artifacts.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-2">
              <Archive className="w-12 h-12 text-slate-300 mb-2" />
              <h3 className="text-base font-bold text-slate-800">No deliverables yet</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Generated documents, reports, and code artifacts will appear here as AI tasks are completed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3.5 px-5">Filename</th>
                    <th className="py-3.5 px-5">Deliverable Type</th>
                    <th className="py-3.5 px-5">Origin Job</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {artifacts.map((artifact) => (
                    <tr key={artifact.artifact_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#7047eb] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block text-xs truncate max-w-xs sm:max-w-md">
                              {artifact.filename}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block truncate">
                              ID: {artifact.artifact_id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-[#7047eb] border border-purple-200/60 uppercase">
                          {artifact.type || "Document"}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className="text-xs font-mono text-slate-500 truncate block max-w-[140px]">
                          {artifact.job_id}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleOpenPreview(artifact)}
                            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDownloadArtifact(artifact)}
                            className="border border-purple-200 bg-purple-50 hover:bg-purple-100 text-[#7047eb] rounded-xl px-3 py-1.5 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
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

      {/* Enterprise File Preview Modal */}
      {previewArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center text-[#7047eb] shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                    {previewArtifact.filename}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Type: {previewArtifact.type || "Document"} · Job: {previewArtifact.job_id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewArtifact(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[160px]">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-20 text-xs text-slate-500">
                  Loading deliverable preview...
                </div>
              ) : previewText !== null ? (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    File Contents:
                  </span>
                  <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[400px]">
                    {previewText}
                  </pre>
                </div>
              ) : (
                <div className="py-12 px-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-3">
                  <FileCode className="w-10 h-10 text-[#7047eb] mx-auto opacity-70" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Binary / Formatted Deliverable ({previewArtifact.type || "Document"})
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      This deliverable is compiled in an air-gapped binary format (e.g. Word .docx or presentation file). You can download it directly below to open in your desktop office suite.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-xs text-slate-400">
                Verified on-premise deliverable
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewArtifact(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadArtifact(previewArtifact)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7047eb] hover:bg-[#5e38d6] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Deliverable</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
