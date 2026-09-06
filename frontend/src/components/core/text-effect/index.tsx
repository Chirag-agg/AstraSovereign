"use client";

import { useMemo } from "react";

/**
 * Per-character / per-word fade-up text effect (adapted from motion-primitives
 * `TextEffect`). Pure CSS animation, respects prefers-reduced-motion.
 */
export function TextEffect({
  children,
  per = "char",
  preset = "fade",
  className = "",
  as = "span",
}: {
  children: string;
  per?: "char" | "word";
  preset?: "fade";
  className?: string;
  as?: "span" | "div" | "h1" | "h2" | "p";
}) {
  void preset;
  const delayMs = 24;
  const nodes = useMemo(() => {
    if (per === "word") {
      return children.split(" ").map((word, i) => (
        <span key={i} className="core-text-char" style={{ animationDelay: `${i * delayMs}ms` }}>
          {word}
          {i < children.split(" ").length - 1 ? "\u00A0" : ""}
        </span>
      ));
    }
    return Array.from(children).map((ch, i) => (
      <span key={i} className="core-text-char" style={{ animationDelay: `${i * delayMs}ms` }}>
        {ch}
      </span>
    ));
  }, [children, per]);

  const Tag = as as "span";
  return <Tag className={className}>{nodes}</Tag>;
}

export default TextEffect;
