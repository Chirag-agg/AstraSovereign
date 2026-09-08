"use client";

import TextShimmer from "@/components/prompt-kit/text-shimmer";

/** A pill that communicates "thinking" with text + a stop action. */
export function ThinkingBar({
  text = "Thinking…",
  stopLabel = "Stop",
  onStop,
  onClick,
  className = "",
}: {
  text?: string;
  stopLabel?: string;
  onStop?: () => void;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`pka-thinking ${className}`}
      role="status"
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <span className="pka-thinking-dot" aria-hidden="true">
        ✦
      </span>
      <span className="pka-thinking-text">
        <TextShimmer duration={2}>{text}</TextShimmer>
      </span>
      {onStop ? (
        <button
          type="button"
          className="pka-thinking-stop"
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
        >
          {stopLabel}
        </button>
      ) : null}
    </div>
  );
}

export default ThinkingBar;
