"use client";

/** Circular "generating" loader ring (CSS-only). */
export function GeneratingRing({
  size = 44,
  label = "Generating",
  className = "",
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span className={`ring-wrap ${className}`} role="status" aria-label={label}>
      <span
        className="ring"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    </span>
  );
}

export default GeneratingRing;
