const LINE_WIDTHS = [88, 62, 95, 70, 84, 55, 90, 40];

export function ScanPreview({ label, align = "center" }: { label: string; align?: "center" | "left" }) {
  return (
    <div className={`flex py-2 ${align === "center" ? "justify-center" : "justify-start"}`}>
      <div
        className="relative w-44 -rotate-1 rounded-sm border p-3.5 shadow-md"
        style={{ background: "#fbfbf8", borderColor: "var(--border-default)" }}
      >
        <div className="flex flex-col gap-2">
          {LINE_WIDTHS.map((w, i) => (
            <div key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: "#d9dccf" }} />
          ))}
        </div>
        <span
          className="absolute -bottom-2.5 -right-2.5 rotate-1 rounded px-1.5 py-0.5 text-[9px] font-medium shadow"
          style={{ background: "var(--bg-surface)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
