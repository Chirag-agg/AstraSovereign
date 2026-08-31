"use client";

import { useState } from "react";

export default function ChatPanel({
  onSubmit,
  disabled,
  hint,
}: {
  onSubmit: (message: string) => Promise<void>;
  disabled: boolean;
  hint?: string;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (!text || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(text);
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel chat-panel" aria-label="Task input">
      <div className="panel-title">Task</div>
      {hint ? <p className="hint">{hint}</p> : null}
      <textarea
        aria-label="Task description"
        rows={3}
        value={message}
        placeholder="Describe the task, e.g. review the inspection report against the maintenance procedure and create an approval note."
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div className="chat-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void submit()}
          disabled={disabled || submitting || message.trim().length === 0}
        >
          {submitting ? "Submitting…" : "Submit task"}
        </button>
      </div>
    </section>
  );
}
