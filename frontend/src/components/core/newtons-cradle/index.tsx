"use client";

/** Small Newton's-cradle loading dots (CSS-only, text-safe wrapper). */
export function NewtonsCradle({ label = "working", size = 22 }: { label?: string; size?: number }) {
  return (
    <span
      className="nc"
      style={{ ["--uib-size" as string]: `${size}px` }}
      role="status"
      aria-label={label}
    >
      <span className="nc-dot" />
      <span className="nc-dot" />
      <span className="nc-dot" />
      <span className="nc-dot" />
    </span>
  );
}

export default NewtonsCradle;
