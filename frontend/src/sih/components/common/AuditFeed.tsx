import { useEffect, useRef } from "react";
import { Route, Wrench, ShieldCheck, UserCheck, Download, Server } from "lucide-react";
import type { AuditEntry } from "../../lib/types";

export const CATEGORY_COLOR: Record<AuditEntry["category"], string> = {
  routing: "var(--brand-600)",
  tool: "var(--text-tertiary)",
  security: "var(--alert-600)",
  approval: "var(--copper-600)",
  export: "var(--safe-600)",
  system: "var(--text-tertiary)",
};

export const CATEGORY_ICON: Record<AuditEntry["category"], typeof Route> = {
  routing: Route,
  tool: Wrench,
  security: ShieldCheck,
  approval: UserCheck,
  export: Download,
  system: Server,
};

export function AuditFeed({
  entries,
  dense = true,
  emptyMessage = "Audit entries appear here as tasks run: routing decisions, tool calls, security checks and approvals.",
  className = "px-3 py-2",
}: {
  entries: AuditEntry[];
  dense?: boolean;
  emptyMessage?: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  return (
    <div ref={listRef} className={`flex-1 overflow-y-auto ${className}`}>
      {entries.length === 0 ? (
        <p className="px-1 py-2 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((e) => {
            const Icon = CATEGORY_ICON[e.category];
            return (
              <li key={e.id} className={`animate-fade-in flex items-start gap-2 ${dense ? "py-1.5" : "py-2.5"}`}>
                <Icon size={dense ? 11 : 13} className="mt-0.5 shrink-0" style={{ color: CATEGORY_COLOR[e.category] }} />
                <p className={`min-w-0 flex-1 leading-snug ${dense ? "text-[12px]" : "text-[13px]"}`} style={{ color: "var(--text-primary)" }}>
                  {e.message}
                </p>
                <span className={`mono shrink-0 ${dense ? "text-[10px]" : "text-[11px]"}`} style={{ color: "var(--text-tertiary)" }}>
                  {e.time}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LiveBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--safe-500)" }} />
      <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Live</span>
      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>· {count} events</span>
    </div>
  );
}
