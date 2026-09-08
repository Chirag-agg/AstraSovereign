"use client";

import { createContext, useContext } from "react";
import type { KeyboardEvent, ReactNode } from "react";

const PromptInputContext = createContext<{
  value: string;
  setValue: (value: string) => void;
  isLoading: boolean;
  submit: () => void;
}>({ value: "", setValue: () => undefined, isLoading: false, submit: () => undefined });

/** Minimal, composable prompt input (adapted from prompt-kit). */
export function PromptInput({
  value,
  onValueChange,
  isLoading = false,
  onSubmit,
  children,
  className = "",
}: {
  value: string;
  onValueChange: (value: string) => void;
  isLoading?: boolean;
  onSubmit?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PromptInputContext.Provider
      value={{
        value,
        setValue: onValueChange,
        isLoading,
        submit: onSubmit ?? (() => undefined),
      }}
    >
      <div className={`pka-prompt ${className}`}>{children}</div>
    </PromptInputContext.Provider>
  );
}

export function PromptInputTextarea({
  placeholder,
  className = "",
  autoResize = false,
}: {
  placeholder?: string;
  className?: string;
  autoResize?: boolean;
}) {
  const { value, setValue, isLoading, submit } = useContext(PromptInputContext);
  void autoResize;
  return (
    <textarea
      aria-label="Prompt input"
      className={className}
      placeholder={placeholder}
      value={value}
      disabled={isLoading}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (value.trim()) {
            submit();
          }
        }
      }}
    />
  );
}

export function PromptInputActions({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`pka-prompt-actions ${className}`}>{children}</div>;
}

export function PromptInputAction({
  children,
  tooltip,
}: {
  children: ReactNode;
  tooltip?: string;
}) {
  return (
    <span className="pka-action-btn" title={tooltip}>
      {children}
    </span>
  );
}

export default PromptInput;
