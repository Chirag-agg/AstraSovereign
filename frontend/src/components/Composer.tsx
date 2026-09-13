"use client";

import { useRef, useState } from "react";

import type { DocumentMeta } from "@/lib/types";

export interface AttachmentChip {
  id: string;
  filename: string;
  state: "uploading" | "processing" | "ready" | "failed";
  // Present for documents that can enter the job's context (uploads and
  // documents attached from the knowledge base).
  documentId?: string;
}

const STATE_LABEL: Record<AttachmentChip["state"], string> = {
  uploading: "uploading",
  processing: "indexing",
  ready: "indexed",
  failed: "failed",
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
  const inputRef = useRef<HTMLInputElement>(null);

  const readyLibrary = libraryDocuments.filter((document) => document.status === "ready");
  const attachedDocIds = new Set(
    attachments.map((chip) => chip.documentId).filter(Boolean) as string[],
  );

  const canSend = text.trim().length > 0 && !running && !disabled;

  const send = () => {
    if (!canSend) {
      return;
    }
    onSubmit(text.trim());
    setText("");
  };

  return (
    <div className="composer" aria-label="Composer">
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
        accept=".pdf,.txt,.md,.png,.jpg,.jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onAttachFile(file);
          }
          e.target.value = "";
        }}
      />
      <div className="composer-box">
        {attachments.length > 0 ? (
          <div className="composer-attachments" aria-label="Attached files">
            {attachments.map((chip) => (
              <span key={chip.id} className="chip">
                {chip.filename}
                <span className="chip-state">· {STATE_LABEL[chip.state]}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(chip.id)}
                  aria-label={`Remove ${chip.filename}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {pickerOpen ? (
          <div
            className="composer-docs"
            aria-label="Attach documents from the knowledge base"
          >
            {readyLibrary.length === 0 ? (
              <span className="t-mut">No indexed documents yet.</span>
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
                    className="composer-doc"
                    aria-pressed={attached}
                    onClick={() =>
                      attached && chip
                        ? onRemoveAttachment(chip.id)
                        : onAttachDocument(document)
                    }
                  >
                    {attached ? "✓ " : ""}
                    {document.filename}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
        <textarea
          aria-label="Task description"
          placeholder="Ask the on-premise AI to do something…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-bar">
          <button
            type="button"
            className="icon-btn"
            onClick={() => inputRef.current?.click()}
            aria-label="Attach files"
            title="Attach files"
            disabled={running || disabled}
          >
            ＋
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="Choose documents"
            title="Attach documents from the knowledge base"
            aria-pressed={pickerOpen}
            disabled={running || disabled}
          >
            Docs
          </button>
          <label className="composer-all" title="Send every ready document as context">
            <input
              type="checkbox"
              aria-label="Use all documents"
              checked={useAllDocuments}
              onChange={(e) => onToggleUseAllDocuments(e.target.checked)}
              disabled={running || disabled}
            />
            Use all documents
          </label>
          <span className="composer-hint">
            {running ? "Agent is working…" : "Enter to send · Shift+Enter for a new line"}
          </span>
          <div className="composer-spacer" />
          <span className="status t-mut">
            <span className="dot" aria-hidden="true" />
            {user}
          </span>
          {running ? (
            <button type="button" className="btn" onClick={onCancel} aria-label="Cancel task">
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-accent"
              onClick={send}
              disabled={!canSend}
              aria-label="Send"
            >
              ↑ Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
