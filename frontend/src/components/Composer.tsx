"use client";

import { useRef, useState } from "react";

export interface AttachmentChip {
  id: string;
  filename: string;
  state: "uploading" | "processing" | "ready" | "failed";
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
  running,
  onSubmit,
  onCancel,
  disabled,
}: {
  user: string;
  attachments: AttachmentChip[];
  onAttachFile: (file: File) => void;
  onRemoveAttachment: (id: string) => void;
  running: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
        <textarea
          aria-label="Task description"
          placeholder="Ask Sovereign AI to do something…"
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
