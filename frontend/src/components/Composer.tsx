"use client";

import React, { useRef, useState } from "react";
import { Paperclip, X, FileText, ArrowUp, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";

import type { DocumentMeta } from "@/lib/types";

export interface AttachmentChip {
  id: string;
  filename: string;
  state: "uploading" | "processing" | "ready" | "failed";
  // Present for documents that can enter the job's context (uploads and
  // documents attached from the knowledge base).
  documentId?: string;
}

const STATE_CONFIG: Record<
  AttachmentChip["state"],
  { label: string; color: string; icon: React.ElementType }
> = {
  uploading: {
    label: "Uploading...",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Loader2,
  },
  processing: {
    label: "indexing",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Clock,
  },
  ready: {
    label: "indexed",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  failed: {
    label: "failed",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    icon: AlertCircle,
  },
};

export default function Composer({
  user,
  attachments,
  onAttachFile,
  onRemoveAttachment,
  onAttachDocument,
  libraryDocuments,
  useAllDocuments,
  onToggleUseAllDocuments,
  running,
  onSubmit,
  onCancel,
  disabled,
}: {
  user: string;
  attachments: AttachmentChip[];
  onAttachFile: (file: File) => void;
  onRemoveAttachment: (id: string) => void;
  onAttachDocument: (document: DocumentMeta) => void;
  libraryDocuments: DocumentMeta[];
  useAllDocuments: boolean;
  onToggleUseAllDocuments: (value: boolean) => void;
  running: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readyLibrary = libraryDocuments.filter((document) => document.status === "ready");
  const attachedDocIds = new Set(
    attachments.map((chip) => chip.documentId).filter(Boolean) as string[],
  );

  const canSend = text.trim().length > 0 && !running && !disabled;

  const send = () => {
    if (!canSend) return;
    onSubmit(text.trim());
    setText("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((f) => onAttachFile(f));
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 bg-white ${
        isDragging
          ? "border-purple-500 ring-2 ring-purple-100 bg-purple-50/20"
          : "border-slate-200/90 shadow-2xs hover:border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      aria-label="Agent Prompt Composer"
    >
      {/* Hidden file input for attachment */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.docx,.txt,.md,.py,.json,.csv,.xlsx,.pptx,.png,.jpg,.jpeg"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            Array.from(files).forEach((f) => onAttachFile(f));
          }
          e.target.value = "";
        }}
      />

      {/* Attached Files Tray */}
      {attachments.length > 0 && (
        <div className="p-3 border-b border-slate-100 bg-slate-50/60 rounded-t-2xl flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Paperclip className="w-3 h-3 text-purple-600" />
            Attachments ({attachments.length}):
          </span>
          {attachments.map((chip) => {
            const config = STATE_CONFIG[chip.state] || STATE_CONFIG.ready;
            const Icon = config.icon;
            return (
              <div
                key={chip.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-semibold text-slate-800 max-w-[160px] truncate" title={chip.filename}>
                  {chip.filename}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md border ${config.color}`}
                >
                  <Icon className={`w-2.5 h-2.5 ${chip.state === "uploading" ? "animate-spin" : ""}`} />
                  {config.label}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(chip.id)}
                  className="w-4 h-4 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                  title={`Remove ${chip.filename}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <div
          className="p-3 border-b border-purple-100 bg-purple-50/40 flex flex-wrap gap-1.5 items-center text-xs"
          aria-label="Attach documents from the knowledge base"
        >
          {readyLibrary.length === 0 ? (
            <span className="text-slate-400 text-xs">No indexed documents yet.</span>
          ) : (
            readyLibrary.map((document) => {
              const attached = attachedDocIds.has(document.document_id);
              const chip = attachments.find(
                (candidate) => candidate.documentId === document.document_id,
              );
              return (
                <button
                  key={document.document_id}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    attached
                      ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                  }`}
                  aria-pressed={attached}
                  onClick={() =>
                    attached && chip
                      ? onRemoveAttachment(chip.id)
                      : onAttachDocument(document)
                  }
                >
                  {attached ? "✓ " : ""}{document.filename}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Textarea Input */}
      <div className="p-3.5 pb-2">
        <textarea
          aria-label="Task description"
          placeholder="Ask the on-premise sovereign AI or instruct the multi-agent swarm… (Drag & drop files or click Attach File)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed font-sans"
        />
      </div>

      {/* Composer Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50/40 rounded-b-2xl border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Explicit Attach File Button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={running || disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-purple-50 hover:text-purple-700 border border-slate-200/90 hover:border-purple-200 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Attach file to prompt context (.pdf, .docx, .txt, .py, .csv, .md, .png)"
          >
            <Paperclip className="w-3.5 h-3.5 text-purple-600" />
            <span>Attach File</span>
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="Choose documents"
            title="Attach documents from the knowledge base"
            aria-pressed={pickerOpen}
            disabled={running || disabled}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 border shadow-2xs ${
              pickerOpen
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-slate-700 hover:bg-purple-50 hover:text-purple-700 border-slate-200/90 hover:border-purple-200"
            }`}
          >
            <span>Docs</span>
          </button>
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none" title="Send every ready document as context">
            <input
              type="checkbox"
              aria-label="Use all documents"
              checked={useAllDocuments}
              onChange={(e) => onToggleUseAllDocuments(e.target.checked)}
              disabled={running || disabled}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span>All Docs</span>
          </label>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            PDF, DOCX, Code, CSV &bull; Zero Egress
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-slate-400 hidden md:inline">
            {running ? "Agent is working…" : "Enter ↵ to send &bull; Shift+Enter for new line"}
          </span>

          {running ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel task"
              className="px-4 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer"
            >
              Cancel task
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              aria-label="Send"
              disabled={!canSend}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer ${
                canSend
                  ? "bg-[#7047eb] hover:bg-[#5e38d6] text-white shadow-purple-500/20"
                  : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
