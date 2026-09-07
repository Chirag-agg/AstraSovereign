import { Fragment } from "react";

const PY_KEYWORDS = new Set([
  "def", "return", "import", "from", "as", "if", "elif", "else", "for", "while",
  "class", "assert", "in", "not", "and", "or", "is", "None", "True", "False",
  "try", "except", "finally", "with", "pass", "break", "continue", "lambda",
]);

const TOKEN_RE = /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*')|(\b\d+\.?\d*\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/gm;

function highlightLine(line: string, key: number) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  let i = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) nodes.push(<Fragment key={`${key}-t${i++}`}>{line.slice(last, m.index)}</Fragment>);
    const text = m[0];
    let color = "var(--text-primary)";
    let weight = 400;
    if (m[1]) color = "var(--text-tertiary)";
    else if (m[2]) color = "var(--safe-600)";
    else if (m[3]) color = "var(--copper-600)";
    else if (m[4] && PY_KEYWORDS.has(m[4])) {
      color = "var(--accent)";
      weight = 600;
    }
    nodes.push(
      <span key={`${key}-t${i++}`} style={{ color, fontWeight: weight }}>
        {text}
      </span>
    );
    last = m.index + text.length;
  }
  if (last < line.length) nodes.push(<Fragment key={`${key}-tend`}>{line.slice(last)}</Fragment>);
  return nodes;
}

export function CodeBlock({ code, lang = "python", compact = false }: { code: string; lang?: string; compact?: boolean }) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div
      className="mono overflow-x-auto rounded-md border text-[12.5px] leading-[1.55]"
      style={{ background: "var(--bg-sunken)", borderColor: "var(--border-subtle)" }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-wide"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-tertiary)" }}
      >
        <span>{lang}</span>
      </div>
      <div className={compact ? "px-3 py-2" : "px-4 py-3"}>
        {lines.map((line, idx) => (
          <div key={idx} className="flex">
            <span className="mr-4 select-none text-right" style={{ color: "var(--text-tertiary)", minWidth: 22, opacity: 0.6 }}>
              {idx + 1}
            </span>
            <span className="whitespace-pre">{highlightLine(line, idx) ?? " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
