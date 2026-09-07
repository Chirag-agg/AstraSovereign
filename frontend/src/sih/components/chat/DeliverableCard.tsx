import { FileText, FileSpreadsheet, Presentation, Code2, Download, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Citation, Deliverable } from "../../lib/types";
import { CodeBlock } from "../common/CodeBlock";
import { CitationRow } from "../common/CitationRow";
import { exportDeliverable } from "../../lib/exportFile";

const ICONS: Record<Deliverable["type"], typeof FileText> = {
  docx: FileText,
  xlsx: FileSpreadsheet,
  pptx: Presentation,
  code: Code2,
};

const COLORS: Record<Deliverable["type"], string> = {
  docx: "var(--brand-700)",
  xlsx: "var(--safe-600)",
  pptx: "var(--copper-600)",
  code: "var(--accent)",
};

export function DeliverableCard({
  deliverable,
  locked,
  citations = [],
  onDownload,
}: {
  deliverable: Deliverable;
  locked: boolean;
  citations?: Citation[];
  onDownload?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const Icon = ICONS[deliverable.type];
  const color = COLORS[deliverable.type];

  const handleExport = async () => {
    setExporting(true);
    try {
      if (onDownload) {
        await onDownload();
      } else {
        await exportDeliverable(deliverable);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--bg-sunken)", color }}
          >
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              {deliverable.name}
            </p>
            <p className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {deliverable.summary}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            <Eye size={13} />
            {open ? "Hide preview" : "Preview"}
          </button>
          <button
            onClick={handleExport}
            disabled={locked || exporting}
            title={locked ? "Awaiting approval before export" : `Download as .${deliverable.name.split(".").pop()}`}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: "var(--accent-solid)" }}
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exporting ? "Preparing" : "Export"}
          </button>
        </div>
      </div>

      {citations.length > 0 && (
        <div className="px-4 pb-3">
          <CitationRow citations={citations} />
        </div>
      )}

      {open && (
        <div className="border-t px-4 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
          {deliverable.sections && (
            <div className="flex flex-col gap-3">
              {deliverable.sections.map((s) => (
                <div key={s.heading}>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    {s.heading}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          )}
          {deliverable.code && <CodeBlock code={deliverable.code} lang={deliverable.codeLang ?? "python"} />}
          {deliverable.rows && (
            <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border-subtle)" }}>
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {deliverable.rows.map((row, i) => (
                    <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="whitespace-nowrap px-3 py-1.5"
                          style={{
                            color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)",
                            fontWeight: i === 0 ? 600 : 400,
                            background: i === 0 ? "var(--bg-sunken)" : "transparent",
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
