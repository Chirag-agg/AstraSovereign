"use client";

import {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The composer.
 *
 * Structure as supplied, re-skinned onto the system and widened for a desk
 * tool rather than a chat sidebar: flat 3px corners, hairline border, mono
 * micro-labels, and the attachment chips carry the thing that matters here —
 * which documents entered the job's context.
 */

export type ChatStatus = "ready" | "streaming" | "submitted" | "idle";

export type AttachedImage = { id: string; filename: string; url: string; size?: number };
export type AttachedFile = { id: string; filename: string; size?: number };

export type InputBarProps = {
  onSend?: (message: { role: "user"; content: string }) => void;
  onStop?: () => void;
  status?: ChatStatus;
  placeholder?: string;
  className?: string;
  onAttach?: () => void;
  attachedImages?: AttachedImage[];
  attachedFiles?: AttachedFile[];
  onRemoveImage?: (id: string) => void;
  onRemoveFile?: (id: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  /** Mono line under the field — the sovereignty note, or the active model. */
  footnote?: ReactNode;
  maxWidth?: number;
};

const Paperclip = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
);
const SendGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);
const StopGlyph = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" />
  </svg>
);
const XGlyph = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const DocGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

function formatBytes(size?: number): string | null {
  if (size === undefined) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Attach a document"
      className="inline-flex h-8 w-8 items-center justify-center transition-colors disabled:opacity-40"
      style={{ color: "var(--granite)", borderRadius: 3 }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bone)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--granite)")}
    >
      <Paperclip />
    </button>
  );
}

function SendButton({ state, onClick }: { state: "idle" | "typing" | "streaming"; onClick: () => void }) {
  const isStreaming = state === "streaming";
  const isActive = state === "typing" || isStreaming;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isStreaming ? "Stop" : "Send"}
      className="inline-flex h-8 w-8 items-center justify-center transition-all duration-150"
      style={{
        borderRadius: 3,
        background: isActive ? "var(--chalk)" : "var(--carbon)",
        color: isActive ? "#101010" : "var(--graphite)",
        border: `1px solid ${isActive ? "var(--chalk)" : "var(--ash)"}`,
      }}
    >
      {isStreaming ? <StopGlyph /> : <SendGlyph />}
    </button>
  );
}

function ImageChip({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <span className="group relative block h-11 w-11 overflow-hidden" style={{ borderRadius: 2, border: "1px solid var(--ash)" }}>
      <img src={url} alt="" className="h-full w-full object-cover" />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove image"
          className="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "#101010cc", color: "var(--bone)" }}
        >
          <XGlyph size={9} />
        </button>
      )}
    </span>
  );
}

function FileChip({ filename, size, onRemove }: { filename: string; size?: number; onRemove?: () => void }) {
  const sizeText = formatBytes(size);
  return (
    <span
      className="group inline-flex items-center gap-2 px-2 py-1.5"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--ash)", borderRadius: 2 }}
    >
      <span style={{ color: "var(--signal)" }}>
        <DocGlyph />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="max-w-[180px] truncate font-mono" style={{ fontSize: 11, color: "var(--bone)" }}>
          {filename}
        </span>
        {sizeText && (
          <span className="font-mono" style={{ fontSize: 10, color: "var(--granite)" }}>
            {sizeText}
          </span>
        )}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${filename}`}
          className="inline-flex h-5 w-5 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--granite)" }}
        >
          <XGlyph />
        </button>
      )}
    </span>
  );
}

export const InputBar = memo(function InputBar({
  onSend,
  onStop,
  status = "ready",
  placeholder = "Describe the task. Attach the scan it should read.",
  className,
  onAttach,
  attachedImages = [],
  attachedFiles = [],
  onRemoveImage,
  onRemoveFile,
  value: controlledValue,
  onChange: controlledOnChange,
  disabled,
  autoFocus,
  leftActions,
  rightActions,
  footnote,
  maxWidth = 760,
}: InputBarProps) {
  const [internalInput, setInternalInput] = useState("");
  const isControlled = controlledValue !== undefined;
  const input = isControlled ? controlledValue : internalInput;
  const setInput = useCallback(
    (v: string) => {
      if (isControlled) controlledOnChange?.(v);
      else setInternalInput(v);
    },
    [isControlled, controlledOnChange],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const isStreaming = status === "streaming" || status === "submitted";
  const hasInput = input.trim().length > 0;
  const hasContextItems = attachedImages.length > 0 || attachedFiles.length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    const next = Math.min(el.scrollHeight, 168);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 168 ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (!autoFocus) return;
    textareaRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend?.({ role: "user", content: trimmed });
    setInput("");
  }, [input, isStreaming, disabled, onSend, setInput]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleContainerClick = useCallback((e: ReactMouseEvent) => {
    if (!(e.target as HTMLElement).closest("button, textarea, a")) {
      textareaRef.current?.focus();
    }
  }, []);

  const sendState: "idle" | "typing" | "streaming" = isStreaming
    ? "streaming"
    : hasInput && !disabled
      ? "typing"
      : "idle";

  return (
    <div className={cn("w-full shrink-0", className)}>
      <div className="mx-auto" style={{ maxWidth }}>
        <div
          className="relative cursor-text"
          onClick={handleContainerClick}
          style={{
            background: "var(--surface)",
            border: `1px solid ${focused ? "var(--ash)" : "#262220"}`,
            borderRadius: 4,
            transition: "border-color 160ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              hasContextItems ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              {hasContextItems && (
                <div className="flex flex-col gap-1.5 px-3 pt-3">
                  <span className="mono-label" style={{ fontSize: 10, letterSpacing: "0.1em" }}>
                    In this job&rsquo;s context
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {attachedImages.map((img) => (
                      <ImageChip key={img.id} url={img.url} onRemove={onRemoveImage ? () => onRemoveImage(img.id) : undefined} />
                    ))}
                    {attachedFiles.map((file) => (
                      <FileChip
                        key={file.id}
                        filename={file.filename}
                        size={file.size}
                        onRemove={onRemoveFile ? () => onRemoveFile(file.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-[46px] px-3.5 pb-0 pt-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              aria-label="Task"
              className={cn("w-full resize-none border-0 bg-transparent outline-none", disabled && "cursor-not-allowed opacity-50")}
              style={{ fontSize: 15, lineHeight: 1.55, color: "var(--bone)", fontFamily: "var(--sans)" }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
            <div className="flex min-w-0 items-center gap-1">
              {onAttach && <AttachmentButton onClick={onAttach} disabled={disabled} />}
              {leftActions}
            </div>
            <div className="flex items-center gap-1.5">
              {rightActions}
              <SendButton
                state={sendState}
                onClick={() => {
                  if (isStreaming) onStop?.();
                  else if (hasInput) handleSubmit();
                }}
              />
            </div>
          </div>
        </div>

        {footnote && (
          <div className="mt-2 flex items-center justify-between px-0.5 font-mono" style={{ fontSize: 11, color: "var(--granite)" }}>
            {footnote}
          </div>
        )}
      </div>
    </div>
  );
});

/** Small mono pill used in the composer toolbar. */
export function ComposerPill({
  children,
  onClick,
  ariaLabel,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 px-2 py-1 font-mono uppercase transition-colors"
      style={{
        fontSize: 10.5,
        letterSpacing: "0.06em",
        borderRadius: 2,
        border: `1px solid ${active ? "var(--signal)" : "var(--ash)"}`,
        color: active ? "var(--signal)" : "var(--stone)",
        background: "transparent",
      }}
    >
      {children}
    </button>
  );
}

export default InputBar;
