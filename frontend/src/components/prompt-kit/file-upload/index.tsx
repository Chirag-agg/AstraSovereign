"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { DragEvent, ReactNode } from "react";

const FileUploadContext = createContext<{
  dragging: boolean;
  pick: () => void;
}>({ dragging: false, pick: () => undefined });

/** Drop zone wrapper: exposes trigger/content and handles drag + pick. */
export function FileUpload({
  onFilesAdded,
  accept,
  multiple = true,
  children,
  className = "",
}: {
  onFilesAdded: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      onFilesAdded(Array.from(files));
    },
    [onFilesAdded],
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const pick = () => inputRef.current?.click();

  return (
    <FileUploadContext.Provider value={{ dragging, pick }}>
      <div
        className={`pka-file-zone ${className}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {children}
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="visually-hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </FileUploadContext.Provider>
  );
}

export function FileUploadTrigger({
  asChild = false,
  children,
}: {
  asChild?: boolean;
  children: ReactNode;
}) {
  const { pick } = useContext(FileUploadContext);
  if (asChild) {
    return <span onClick={pick}>{children}</span>;
  }
  return (
    <button type="button" onClick={pick}>
      {children}
    </button>
  );
}

export function FileUploadContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { dragging } = useContext(FileUploadContext);
  if (!dragging) {
    return null;
  }
  return (
    <div className={`pka-file-overlay ${className}`}>
      <div className="pka-file-overlay-inner">{children}</div>
    </div>
  );
}

export default FileUpload;
