// Small status pill with a colored dot plus a text label (never color-only).

const KIND_BY_VALUE: Record<string, string> = {
  completed: "ok",
  ready: "ok",
  available: "ok",
  reachable: "ok",
  running: "active",
  processing: "active",
  creating: "active",
  allocated: "active",
  failed: "error",
  error: "error",
  cancelled: "warn",
  rejected: "warn",
  queued: "info",
  waiting: "info",
  not_required: "info",
  released: "info",
};

export default function StatusBadge({
  value,
  label,
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const kind = KIND_BY_VALUE[value] || "info";
  return (
    <span className={`badge badge-${kind} ${className}`} role="status">
      <span className="badge-dot" aria-hidden="true" />
      {label ?? value}
    </span>
  );
}
