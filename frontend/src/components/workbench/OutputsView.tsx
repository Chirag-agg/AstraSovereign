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
  Maximize2,
  Minimize2,
  Copy,
  Check,
  WrapText,
  FileSearch,
} from "lucide-react";
import type { ArtifactSummary } from "@/lib/types";
import { downloadArtifact, getArtifactPreview } from "@/lib/api";

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"text" | "pdf" | "image" | "docx" | "binary">("text");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  const handleOpenPreview = async (artifact: ArtifactSummary) => {
    setPreviewArtifact(artifact);
    setPreviewText(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setLoadingPreview(true);
    setCopied(false);

    const ext = artifact.filename.split(".").pop()?.toLowerCase() || "";
    const isPdf = ext === "pdf";
    const isImage = ["png", "jpg", "jpeg", "svg", "webp", "gif"].includes(ext);
    const isDocx = ext === "docx";

    try {
      if (isPdf) {
        setPreviewType("pdf");
        const { blob } = await downloadArtifact(activeUserId(), artifact.job_id, artifact.artifact_id);
        const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setPreviewUrl(url);
      } else if (isImage) {
        setPreviewType("image");
        const { blob } = await downloadArtifact(activeUserId(), artifact.job_id, artifact.artifact_id);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else if (isDocx) {
        setPreviewType("docx");
        const res = await getArtifactPreview(activeUserId(), artifact.job_id, artifact.artifact_id);
        setPreviewText(res.text);
      } else {
        setPreviewType("text");
        try {
          const res = await getArtifactPreview(activeUserId(), artifact.job_id, artifact.artifact_id);
          if (res.text) {
            setPreviewText(res.text);
          } else {
            const { blob } = await downloadArtifact(activeUserId(), artifact.job_id, artifact.artifact_id);
            const text = await blob.text();
            setPreviewText(text);
          }
        } catch {
          const { blob } = await downloadArtifact(activeUserId(), artifact.job_id, artifact.artifact_id);
          const text = await blob.text();
          setPreviewText(text);
        }
      }
    } catch {
      setPreviewText("Could not load full preview content for this file.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewArtifact(null);
    setPreviewText(null);
    setIsFullscreen(false);
  };

  const handleCopy = () => {
    if (previewText) {
      navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
                          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563eb] shrink-0">
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
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#2563eb] border border-blue-200/60 uppercase">
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
                            className="border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#2563eb] rounded-xl px-3 py-1.5 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
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

      {/* Enterprise Full-File Preview Modal */}
      {previewArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div
            className={`bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${
              isFullscreen
                ? "fixed inset-2 rounded-2xl z-50"
                : "rounded-3xl w-[95vw] max-w-6xl h-[88vh]"
            }`}
          >
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 flex items-center justify-center text-[#2563eb] shrink-0 shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-sm sm:max-w-md md:max-w-lg" title={previewArtifact.filename}>
                      {previewArtifact.filename}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563eb] border border-blue-200 uppercase tracking-wide shrink-0">
                      {previewType}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block truncate">
                    Job: {previewArtifact.job_id} · ID: {previewArtifact.artifact_id}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {previewText && (
                  <>
                    <button
                      type="button"
                      onClick={() => setWordWrap(!wordWrap)}
                      className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        wordWrap
                          ? "bg-blue-50 border-blue-200 text-[#2563eb]"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      title="Toggle Word Wrap"
                    >
                      <WrapText className="w-3.5 h-3.5" />
                      <span>Wrap</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      title="Copy full file text"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadArtifact(previewArtifact)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors ml-1"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body: Displays the whole file */}
            <div className="flex-1 min-h-0 overflow-hidden relative bg-slate-50 flex flex-col">
              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
                  <span>Loading full file content...</span>
                </div>
              ) : previewType === "pdf" && previewUrl ? (
                <div className="w-full h-full flex flex-col p-2">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0 rounded-2xl shadow-inner bg-white"
                    title={previewArtifact.filename}
                  />
                </div>
              ) : previewType === "image" && previewUrl ? (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-slate-900/5">
                  <img
                    src={previewUrl}
                    alt={previewArtifact.filename}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-slate-200"
                  />
                </div>
              ) : previewText !== null ? (
                <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                  {/* File Metadata Bar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-100/70 text-[11px] font-mono text-slate-600 shrink-0">
                    <span className="font-semibold text-slate-700">
                      {previewType === "docx" ? "Word Document Content" : "Full File Source"} · {previewText.split("\n").length} lines · {previewText.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                    <span className="text-slate-400">Complete File Preview</span>
                  </div>

                  {/* Complete Text with Line Numbers */}
                  <div className="flex-1 overflow-auto flex min-h-0 p-4 font-mono text-xs bg-slate-950 text-slate-100">
                    {/* Line numbers */}
                    <div className="select-none pr-4 text-right text-slate-600 font-mono text-xs border-r border-slate-800 shrink-0 leading-relaxed">
                      {previewText.split("\n").map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>

                    {/* Source content */}
                    <pre
                      className={`pl-4 font-mono text-xs text-slate-200 leading-relaxed select-text flex-1 overflow-x-auto ${
                        wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
                      }`}
                    >
                      {previewText}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-20 px-6 text-center space-y-3 m-auto">
                  <FileCode className="w-12 h-12 text-[#2563eb] mx-auto opacity-70" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Air-Gapped Binary Deliverable ({previewArtifact.type || "Document"})
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    This file is compiled in a binary format. You can download the complete deliverable below to view it with your local desktop application.
                  </p>
                  <button
                    type="button"
                    onClick={() => onDownloadArtifact(previewArtifact)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white shrink-0">
              <span className="text-xs text-slate-400 font-medium">
                Verified sovereign on-premise deliverable
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
