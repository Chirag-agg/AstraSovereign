export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20 2.5 34.5 8v10.2c0 9.4-6.1 17.4-14.5 21.3C11.6 35.6 5.5 27.6 5.5 18.2V8L20 2.5Z"
        fill="var(--brand-800)"
      />
      <path
        d="M20 2.5 34.5 8v10.2c0 9.4-6.1 17.4-14.5 21.3V2.5Z"
        fill="var(--brand-700)"
      />
      <circle cx="14.5" cy="16" r="1.7" fill="var(--copper-400)" />
      <circle cx="25.5" cy="16" r="1.7" fill="var(--copper-400)" />
      <circle cx="20" cy="24.5" r="1.7" fill="var(--copper-400)" />
      <path
        d="M14.5 16 L25.5 16 M14.5 16 L20 24.5 M25.5 16 L20 24.5"
        stroke="var(--copper-300)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandWordmark({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`inline-flex items-baseline gap-0.5 font-semibold tracking-tight ${className}`} style={style}>
      <span>AI Workbench</span>
      
    </span>
  );
}

export function InstitutionBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-6 w-6 text-[9px]" : "h-9 w-9 text-[11px]";
  return (
    <span
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded font-bold text-white`}
      style={{ background: "var(--brand-900)", letterSpacing: "-0.02em" }}
      aria-hidden="true"
    >
      AI
    </span>
  );
}
