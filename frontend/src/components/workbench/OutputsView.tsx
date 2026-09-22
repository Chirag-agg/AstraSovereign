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
import { FigurePanel, StatSlab } from "@/components/ui/instrument";
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

  const list = artifacts ?? [];

  // Grouped by extension: "what came out of this machine" is more useful as a
  // shape than as a flat count.
  const byKind = list.reduce<Record<string, number>>((acc, a) => {
    const ext = a.filename.split(".").pop()?.toLowerCase() || "file";
    acc[ext] = (acc[ext] ?? 0) + 1;
    return acc;
  }, {});
  const kinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="pb-4 border-b border-[var(--carbon)]">
          <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Output</span>
          <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>Finished files</h1>
          <p style={{ margin: "8px 0 0" }}>
            Real files, not a preview of one: a Word document opens in Word. Everything here
            was written on this machine by a task you asked for, and each one is tied to the
            task that produced it.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab
              value={String(list.length)}
              label="Files produced"
              tone={list.length > 0 ? "signal" : "neutral"}
            />
            {kinds.length > 0 && (
              <FigurePanel figure="1" title="By kind">
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {kinds.map(([ext, n]) => (
                    <li
                      key={ext}
                      className="flex items-center justify-between gap-2"
                      style={{ padding: "7px 0", borderBottom: "1px solid var(--carbon)" }}
                    >
                      <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--signal)" }}>
                        {ext}
                      </span>
                      <span className="font-mono tnum" style={{ fontSize: 12, color: "var(--stone)" }}>{n}</span>
                    </li>
                  ))}
                </ul>
              </FigurePanel>
            )}
          </div>

          <FigurePanel figure="2" title="Everything produced" caption="newest tasks first" flush>
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Kind</th>
                  <th>From task</th>
                  <th style={{ textAlign: "right" }}>Open</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="font-mono" style={{ color: "var(--graphite)" }}>
                      Nothing produced yet. Finished tasks leave their files here.
                    </td>
                  </tr>
                ) : (
                  list.map((artifact) => (
                    <tr key={artifact.artifact_id}>
                      <td style={{ maxWidth: 420 }}>
                        <span className="block truncate" style={{ color: "var(--bone)" }}>{artifact.filename}</span>
                        <span className="block font-mono truncate" style={{ marginTop: 3, fontSize: 11, color: "var(--graphite)" }}>
                          {artifact.artifact_id}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--signal)" }}>
                          {artifact.type || artifact.filename.split(".").pop() || "file"}
                        </span>
                      </td>
                      <td className="font-mono" style={{ color: "var(--granite)" }}>
                        {artifact.job_id.substring(0, 8)}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => void handleOpenPreview(artifact)}
                          className="font-mono uppercase"
                          style={{ fontSize: 10, letterSpacing: "0.08em", padding: "5px 9px", marginRight: 6, borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
                        >
                          Look
                        </button>
                        <button
                          type="button"
                          onClick={() => onDownloadArtifact(artifact)}
                          className="font-mono uppercase"
                          style={{ fontSize: 10, letterSpacing: "0.08em", padding: "5px 9px", borderRadius: 2, border: "1px solid var(--signal)", background: "transparent", color: "var(--signal)", cursor: "pointer" }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </FigurePanel>
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
                <div className="w-9 h-9 rounded-2xl bg-purple-100 flex items-center justify-center text-[var(--accent)] shrink-0 shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-sm sm:max-w-md md:max-w-lg" title={previewArtifact.filename}>
                      {previewArtifact.filename}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[var(--accent)] border border-purple-200 uppercase tracking-wide shrink-0">
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
                          ? "bg-purple-50 border-purple-200 text-[var(--accent)]"
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
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-xs cursor-pointer"
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
                  <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
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
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-slate-100/5">
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
                  <div className="flex-1 overflow-auto flex min-h-0 p-4 font-mono text-xs bg-slate-100 text-slate-700">
                    {/* Line numbers */}
                    <div className="select-none pr-4 text-right text-slate-600 font-mono text-xs border-r border-slate-200 shrink-0 leading-relaxed">
                      {previewText.split("\n").map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>

                    {/* Source content */}
                    <pre
                      className={`pl-4 font-mono text-xs text-slate-600 leading-relaxed select-text flex-1 overflow-x-auto ${
                        wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
                      }`}
                    >
                      {previewText}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-20 px-6 text-center space-y-3 m-auto">
                  <FileCode className="w-12 h-12 text-[var(--accent)] mx-auto opacity-70" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Air-Gapped Binary Deliverable ({previewArtifact.type || "Document"})
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    This file is compiled in a binary format. You can download the complete deliverable below to view it with your local desktop application.
                  </p>
                  <button
                    type="button"
                    onClick={() => onDownloadArtifact(previewArtifact)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-xs cursor-pointer"
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
