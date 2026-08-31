"use client";

import { useRef, useState } from "react";

// Uploads go straight to the backend document API. The browser never reads or
// processes document contents — the backend remains authoritative.

const ACCEPT = ".pdf,.txt,.md,.png,.jpg,.jpeg";

export default function UploadPanel({
  onUpload,
  busy,
}: {
  onUpload: (file: File) => Promise<void>;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const pickFile = () => inputRef.current?.click();

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    void onUpload(file);
  };

  return (
    <section className="panel" aria-label="Upload documents">
      <div className="panel-title">Upload documents</div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        className="btn"
        onClick={pickFile}
        disabled={busy}
        aria-label="Choose a document to upload"
      >
        {busy ? "Uploading…" : "Choose file"}
      </button>
      {fileName ? <p className="hint">Selected: {fileName}</p> : null}
      <p className="hint">Supported: PDF, TXT, MD, PNG, JPG, JPEG</p>
    </section>
  );
}
