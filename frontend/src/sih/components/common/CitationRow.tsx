import { Quote } from "lucide-react";
import type { Citation } from "../../lib/types";

export function CitationRow({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Sources</span>
      {citations.map((c) => (
        <span
          key={c.doc + c.page}
          className="flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]"
          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
        >
          <Quote size={10} />
          {c.doc} · p.{c.page}
        </span>
      ))}
    </div>
  );
}
