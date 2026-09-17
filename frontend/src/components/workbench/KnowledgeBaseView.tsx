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
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
  FileCode,
  ArrowRightLeft,
  FileCheck,
  WrapText,
} from "lucide-react";
import { getHealth, getDocumentContent, getDocumentFileBlob, convertExistingDocument } from "@/lib/api";
import type { DocumentMeta } from "@/lib/types";

function activeUserId(): string {
  if (typeof window === "undefined") return "user-001";
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

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

  // Conversion state
  const [converting, setConverting] = useState(false);
  const [convertStatus, setConvertStatus] = useState<string | null>(null);

  // Full-file preview states
  const [previewDoc, setPreviewDoc] = useState<DocumentMeta | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "text">("text");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [activeTab, setActiveTab] = useState<"document" | "metadata">("document");

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

  const handleOpenPreview = async (doc: DocumentMeta) => {
    setPreviewDoc(doc);
    setPreviewText(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setLoadingPreview(true);
    setCopied(false);
    setActiveTab("document");

    const ext = doc.filename.split(".").pop()?.toLowerCase() || "";
    const isPdf = ext === "pdf" || doc.document_type === "pdf";
    const isImage = ["png", "jpg", "jpeg", "svg", "webp"].includes(ext) || ["png", "jpg", "jpeg"].includes(doc.document_type);

    try {
      if (isPdf) {
        setPreviewType("pdf");
        try {
          const { blob } = await getDocumentFileBlob(activeUserId(), doc.document_id);
          const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
          setPreviewUrl(url);
        } catch {
          // fallback to extracted text
        }
        try {
          const content = await getDocumentContent(activeUserId(), doc.document_id);
          if (content.text) setPreviewText(content.text);
        } catch {
          // ignore
        }
      } else if (isImage) {
        setPreviewType("image");
        try {
          const { blob } = await getDocumentFileBlob(activeUserId(), doc.document_id);
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } catch {
          // ignore
        }
        try {
          const content = await getDocumentContent(activeUserId(), doc.document_id);
          if (content.text) setPreviewText(content.text);
        } catch {
          // ignore
        }
      } else {
        setPreviewType("text");
        const content = await getDocumentContent(activeUserId(), doc.document_id);
        setPreviewText(content.text);
      }
    } catch {
      setPreviewText("Could not load full document text.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewDoc(null);
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

  const handleDownload = async () => {
    if (!previewDoc) return;
    try {
      const { blob, filename } = await getDocumentFileBlob(activeUserId(), previewDoc.document_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      if (previewText) {
        const blob = new Blob([previewText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = previewDoc.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleConvertDocument = async (doc: DocumentMeta, targetFormat: "pdf" | "docx") => {
    setConverting(true);
    setConvertStatus(`Converting ${doc.filename} to ${targetFormat.toUpperCase()}...`);
    try {
      const { blob, filename } = await convertExistingDocument(activeUserId(), doc.document_id, targetFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setConvertStatus(`Downloaded ${filename}!`);
      setTimeout(() => setConvertStatus(null), 3000);
    } catch (err) {
      setConvertStatus(err instanceof Error ? err.message : "Conversion failed.");
      setTimeout(() => setConvertStatus(null), 4000);
    } finally {
      setConverting(false);
    }
  };


  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#09090b]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-1 leading-relaxed">
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

        {/* Conversion & Notification Feedback */}
        {convertStatus && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs font-semibold animate-in fade-in">
            <ArrowRightLeft className={`w-4 h-4 text-red-400 ${converting ? "animate-spin" : ""}`} />
            <span>{convertStatus}</span>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-950/30 flex items-center justify-center text-[#7047eb] shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Total Documents
              </span>
              <span className="text-lg font-bold text-zinc-100">
                {documents ? documents.length : "—"}
              </span>
            </div>
          </div>

          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-950/30 flex items-center justify-center text-[#7047eb] shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Indexed Chunks
              </span>
              <span className="text-lg font-bold text-zinc-100">
                {chunks !== null ? chunks : "—"}
              </span>
            </div>
          </div>

          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-950/30 flex items-center justify-center text-[#7047eb] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Embedding Model
              </span>
              <span className="text-xs font-bold text-zinc-100 truncate block max-w-[180px]">
                {embedding || "Local SentenceTransformers"}
              </span>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {!documents || documents.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-2">
              <FileText className="w-12 h-12 text-slate-300 mb-2" />
              <h3 className="text-base font-bold text-zinc-100">No documents in index</h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Upload business documents (PDF, Word, TXT, or markdown) to empower your Sovereign AI assistant.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-[#18181b]/30">
                    <th className="py-3.5 px-5">Document Name</th>
                    <th className="py-3.5 px-5">Format</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.document_id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-red-950/30 flex items-center justify-center text-[#7047eb] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100 block text-xs truncate max-w-xs sm:max-w-md">
                              {doc.filename}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 block truncate">
                              ID: {doc.document_id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-950/30 text-[#7047eb] border border-red-900/40/60 uppercase">
                          {doc.document_type || "txt"}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            doc.status === "ready"
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/50/60"
                              : doc.status === "failed"
                              ? "bg-rose-950/40 text-rose-400 border-rose-900/50/60"
                              : "bg-amber-950/40 text-amber-400 border-amber-900/50/60"
                          }`}
                        >
                          {doc.status || "available"}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Conversion button */}
                          {doc.document_type === "pdf" ? (
                            <button
                              type="button"
                              disabled={converting}
                              onClick={() => void handleConvertDocument(doc, "docx")}
                              className="border border-zinc-800 bg-[#18181b] hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Convert to Microsoft Word (.docx)"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-red-400" />
                              <span>To Word</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={converting}
                              onClick={() => void handleConvertDocument(doc, "pdf")}
                              className="border border-zinc-800 bg-[#18181b] hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Convert to PDF (.pdf)"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-red-400" />
                              <span>To PDF</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleOpenPreview(doc)}
                            className="border border-zinc-800 bg-[#111115] hover:bg-[#18181b] text-zinc-200 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteDocument(doc.document_id)}
                            className="p-1.5 text-zinc-500 hover:text-rose-600 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer inline-flex"
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

      {/* Enterprise Full-File Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div
            className={`bg-[#111115] shadow-2xl border border-zinc-800 flex flex-col overflow-hidden transition-all duration-200 ${
              isFullscreen
                ? "fixed inset-2 rounded-2xl z-50"
                : "rounded-3xl w-[95vw] max-w-6xl h-[88vh]"
            }`}
          >
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-[#18181b]/80 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-red-950/40 border border-red-900/40 flex items-center justify-center text-red-400 shrink-0 shadow-2xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100 truncate max-w-sm sm:max-w-md md:max-w-lg" title={previewDoc.filename}>
                      {previewDoc.filename}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/40 text-red-400 border border-red-900/40 uppercase tracking-wide shrink-0 font-mono">
                      {previewType}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 block truncate">
                    ID: {previewDoc.document_id} · Status: {previewDoc.status || "available"}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Tab Switcher */}
                <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-xs font-semibold mr-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("document")}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activeTab === "document" ? "bg-[#111115] text-zinc-100 shadow-2xs" : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    Full File
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("metadata")}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activeTab === "metadata" ? "bg-[#111115] text-zinc-100 shadow-2xs" : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    Index Details
                  </button>
                </div>

                {previewText && activeTab === "document" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setWordWrap(!wordWrap)}
                      className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        wordWrap
                          ? "bg-red-950/40 border-red-900/40 text-red-400"
                          : "bg-[#111115] border-zinc-800 text-zinc-400 hover:bg-[#18181b]"
                      }`}
                      title="Toggle Word Wrap"
                    >
                      <WrapText className="w-3.5 h-3.5" />
                      <span>Wrap</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-[#111115] hover:bg-[#18181b] text-zinc-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      title="Copy full text"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer shadow-red-900/20"
                  title="Download raw document"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="text-zinc-500 hover:text-zinc-200 cursor-pointer p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors ml-1"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 min-h-0 overflow-hidden relative bg-[#18181b] flex flex-col">
              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-zinc-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading full document file...</span>
                </div>
              ) : activeTab === "metadata" ? (
                <div className="p-6 overflow-y-auto space-y-4 max-w-3xl mx-auto w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-[#111115] border border-zinc-800 shadow-2xs">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Index Status
                      </span>
                      <span className="font-bold text-zinc-100 capitalize text-sm">
                        {previewDoc.status || "available"}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#111115] border border-zinc-800 shadow-2xs">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Ingestion Engine
                      </span>
                      <span className="font-bold text-zinc-100 text-sm">
                        Local Air-Gap Ingestion
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#111115] border border-zinc-800 shadow-2xs">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Format
                      </span>
                      <span className="font-bold text-zinc-100 uppercase text-sm">
                        {previewDoc.document_type || "txt"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#111115] border border-zinc-800 shadow-2xs space-y-2">
                    <h4 className="font-bold text-zinc-100 text-xs">Vector Store & Retrieval Specification</h4>
                    <p className="text-zinc-400 leading-relaxed text-xs">
                      This document is chunked and embedded in the local Sovereign vector store under user namespace <code>{activeUserId()}</code>.
                      The AI Assistant executes similarity queries against all chunks using cosine distance when using the <code>document_search</code> tool.
                    </p>
                  </div>
                </div>
              ) : previewType === "pdf" && previewUrl ? (
                <div className="w-full h-full flex flex-col p-4 bg-zinc-950 items-center justify-center">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0 rounded-xl shadow-2xl bg-white"
                    title={previewDoc.filename}
                  />
                </div>
              ) : previewType === "image" && previewUrl ? (
                <div className="w-full h-full flex items-center justify-center p-6 overflow-auto bg-zinc-950">
                  <img
                    src={previewUrl}
                    alt={previewDoc.filename}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-zinc-800 bg-white"
                  />
                </div>
              ) : previewText !== null ? (
                <div className="w-full h-full flex flex-col bg-zinc-950 overflow-hidden items-center p-4 sm:p-6">
                  {/* Faithful Authentic White Paper Document Viewport */}
                  <div className="w-full max-w-4xl flex-1 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 shrink-0">
                      <span className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        Exact Format Document View: {previewDoc.filename}
                      </span>
                      <span className="text-slate-500">{previewText.split("\n").length} lines</span>
                    </div>

                    <div className="flex-1 overflow-auto p-8 font-sans text-sm text-slate-800 leading-relaxed select-text">
                      <pre
                        className={`font-sans text-sm text-slate-800 leading-relaxed select-text ${
                          wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
                        }`}
                        style={{ fontFamily: "inherit" }}
                      >
                        {previewText}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 px-6 text-center space-y-3 m-auto">
                  <FileCode className="w-12 h-12 text-red-500 mx-auto opacity-70" />
                  <h4 className="text-sm font-bold text-zinc-100">
                    Document Content Available
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Click download below to inspect the original binary document file or convert it to Word / PDF.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer shadow-red-900/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Original Document</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#111115] shrink-0">
              <span className="text-xs text-zinc-500 font-medium">
                Verified sovereign knowledge base document
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-[#27272a] cursor-pointer"
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
