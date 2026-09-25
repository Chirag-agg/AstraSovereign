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
  WrapText,
  FileCode,
} from "lucide-react";
import { getHealth, getDocumentContent, getDocumentFileBlob } from "@/lib/api";
import { FigurePanel, StatSlab } from "@/components/ui/instrument";
import type { DocumentMeta } from "@/lib/types";

function activeUserId(): string {
  if (typeof window === "undefined") return "user-001";
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

interface KnowledgeBaseViewProps {
  documents: DocumentMeta[] | null;
  onUploadDocument: (file: File, documentKind?: string) => void;
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

  const [documentKind, setDocumentKind] = useState<string>("general");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadDocument(e.target.files[0], documentKind);
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
    const isImage = ["png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp"].includes(ext);

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

  const docs = documents ?? [];

  // Grouped by file type, so "what is actually in the index" is legible at a
  // glance rather than a flat list of filenames.
  const byKind = docs.reduce<Record<string, number>>((acc, d) => {
    const ext = d.filename.split(".").pop()?.toLowerCase() || "file";
    acc[ext] = (acc[ext] ?? 0) + 1;
    return acc;
  }, {});
  const kinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Index</span>
            <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>Documents the agent can read</h1>
            <p style={{ margin: "8px 0 0" }}>
              Anything you add here is split, indexed and searchable on this machine. The
              index is built locally, it is yours alone, and it has nowhere else to go.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="doc-kind-select" className="sr-only">Document type</label>
            <select
              id="doc-kind-select"
              value={documentKind}
              onChange={(e) => setDocumentKind(e.target.value)}
              className="font-mono text-xs px-2.5 py-1.5 rounded border border-[var(--carbon)] bg-[var(--surface)] text-[var(--bone)] cursor-pointer"
              title="Select document ingestion profile"
            >
              <option value="general">General</option>
              <option value="pid">Engineering Drawing (P&ID)</option>
            </select>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            <button

              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 font-mono uppercase"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.08em",
                padding: "8px 13px",
                borderRadius: 2,
                border: "1px solid var(--signal)",
                background: "transparent",
                color: "var(--signal)",
                cursor: uploading ? "default" : "pointer",
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <Upload className="w-3 h-3" />
              {uploading ? "Adding" : "Add a document"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab
              value={String(docs.length)}
              label="Documents indexed"
              tone={docs.length > 0 ? "signal" : "neutral"}
            />
            <FigurePanel figure="1" title="The index" caption="built here, stored here">
              <dl style={{ margin: 0 }}>
                {[
                  { k: "Pieces indexed", v: chunks !== null ? chunks.toLocaleString() : "—" },
                  { k: "Embedding model", v: embedding || "—" },
                  { k: "Vector store", v: vectorStore || "—" },
                ].map((row) => (
                  <div key={row.k} style={{ padding: "9px 0", borderBottom: "1px solid var(--carbon)" }}>
                    <dt className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--graphite)" }}>
                      {row.k}
                    </dt>
                    <dd className="font-mono" style={{ margin: "5px 0 0", fontSize: 12, color: "var(--bone)", wordBreak: "break-word" }}>
                      {row.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </FigurePanel>
            {kinds.length > 0 && (
              <FigurePanel figure="2" title="By kind">
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {kinds.map(([ext, n]) => (
                    <li key={ext} className="flex items-center justify-between gap-2" style={{ padding: "7px 0", borderBottom: "1px solid var(--carbon)" }}>
                      <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--signal)" }}>{ext}</span>
                      <span className="font-mono tnum" style={{ fontSize: 12, color: "var(--stone)" }}>{n}</span>
                    </li>
                  ))}
                </ul>
              </FigurePanel>
            )}
          </div>

          <FigurePanel figure="3" title="Everything in the index" caption={`${docs.length} document(s)`} flush>
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Kind</th>
                  <th>Pieces</th>
                  <th>Added</th>
                  <th style={{ textAlign: "right" }}>Open</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="font-mono" style={{ color: "var(--graphite)" }}>
                      Nothing indexed yet. Add a document and the agent can read it.
                    </td>
                  </tr>
                ) : (
                  docs.map((doc) => (
                    <tr key={doc.document_id}>
                      <td style={{ maxWidth: 440 }}>
                        <span className="block truncate" style={{ color: "var(--bone)" }}>{doc.filename}</span>
                        <span className="block font-mono truncate" style={{ marginTop: 3, fontSize: 11, color: "var(--graphite)" }}>
                          {doc.document_id}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--signal)" }}>
                          {doc.filename.split(".").pop() || "file"}
                        </span>
                      </td>
                      <td className="font-mono tnum" style={{ color: "var(--stone)" }}>
                        {doc.chunk_count > 0 ? doc.chunk_count.toLocaleString() : "—"}
                      </td>
                      <td className="font-mono" style={{ color: "var(--granite)" }}>
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => void handleOpenPreview(doc)}
                          className="font-mono uppercase"
                          style={{ fontSize: 10, letterSpacing: "0.08em", padding: "5px 9px", marginRight: 6, borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
                        >
                          Look
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc.document_id)}
                          className="font-mono uppercase"
                          style={{ fontSize: 10, letterSpacing: "0.08em", padding: "5px 9px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--alert)", cursor: "pointer" }}
                        >
                          Remove
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

      {/* Enterprise Full-File Document Preview Modal */}
      {previewDoc && (
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
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-sm sm:max-w-md md:max-w-lg" title={previewDoc.filename}>
                      {previewDoc.filename}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[var(--accent)] border border-purple-200 uppercase tracking-wide shrink-0">
                      {previewType}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block truncate">
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
                      activeTab === "document" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Full File
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("metadata")}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activeTab === "metadata" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
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
                      title="Copy full text"
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
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-xs cursor-pointer"
                  title="Download raw document"
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

            {/* Content Body */}
            <div className="flex-1 min-h-0 overflow-hidden relative bg-slate-50 flex flex-col">
              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <span>Loading full document file...</span>
                </div>
              ) : activeTab === "metadata" ? (
                <div className="p-6 overflow-y-auto space-y-4 max-w-3xl mx-auto w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Index Status
                      </span>
                      <span className="font-bold text-slate-800 capitalize text-sm">
                        {previewDoc.status || "available"}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Ingestion Engine
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        Local Air-Gap Ingestion
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Format
                      </span>
                      <span className="font-bold text-slate-800 uppercase text-sm">
                        {previewDoc.document_type || "txt"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs">Vector Store & Retrieval Specification</h4>
                    <p className="text-slate-600 leading-relaxed text-xs">
                      This document is chunked and embedded in the local Sovereign vector store under user namespace <code>{activeUserId()}</code>.
                      The AI Assistant executes similarity queries against all chunks using cosine distance when using the <code>document_search</code> tool.
                    </p>
                  </div>
                </div>
              ) : previewType === "pdf" && previewUrl ? (
                <div className="w-full h-full flex flex-col p-2">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0 rounded-2xl shadow-inner bg-white"
                    title={previewDoc.filename}
                  />
                </div>
              ) : previewType === "image" && previewUrl ? (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-slate-100/5">
                  <img
                    src={previewUrl}
                    alt={previewDoc.filename}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-slate-200"
                  />
                </div>
              ) : previewText !== null ? (
                <div className="w-full h-full flex flex-col bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-100/70 text-[11px] font-mono text-slate-600 shrink-0">
                    <span className="font-semibold text-slate-700">
                      Full Document Text · {previewText.split("\n").length} lines · {previewText.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                    <span className="text-slate-400">Complete File Preview</span>
                  </div>

                  <div className="flex-1 overflow-auto flex min-h-0 p-4 font-mono text-xs bg-slate-100 text-slate-700">
                    {/* Line numbers */}
                    <div className="select-none pr-4 text-right text-slate-600 font-mono text-xs border-r border-slate-200 shrink-0 leading-relaxed">
                      {previewText.split("\n").map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>

                    {/* Content */}
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
                    Document Content Available
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Click download below to inspect the original binary document file.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Original Document</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white shrink-0">
              <span className="text-xs text-slate-400 font-medium">
                Verified sovereign knowledge base document
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
