"use client";

import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*(?=\S)[^*\n]*?\S\*|\*\S\*|\[[^\]]+\]\([^)]+\))/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code key={i} className="md-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    } else if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={i} className="md-strong">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (/^\*\S(?:[^*\n]*\S)?\*$/.test(part)) {
      nodes.push(<em key={i}>{part.slice(1, -1)}</em>);
    } else if (/^\[[^\]]+\]\([^)]+\)$/.test(part)) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        nodes.push(
          <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="md-link">
            {m[1]}
          </a>
        );
      } else {
        nodes.push(part);
      }
    } else {
      nodes.push(part);
    }
  });
  return nodes;
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes("-")) return false;
  if (!/^[\s|:\-]+$/.test(t)) return false;
  return t.includes("---");
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function parseBlocks(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || "code";
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(
        <div key={key++} className="md-code-block">
          <div className="md-code-head">
            <span>{lang}</span>
          </div>
          <pre className="md-code-pre">
            <code>{buf.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push(<hr key={key++} className="md-hr" />);
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      out.push(
        <Tag key={key++} className={`md-h md-h${level}`}>
          {inline(heading[2])}
        </Tag>
      );
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      out.push(
        <div key={key++} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                {headers.map((h, j) => (
                  <th key={j}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.trim().startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      out.push(
        <blockquote key={key++} className="md-quote">
          {buf.map((b, j) => (
            <p key={j}>{inline(b)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^(\s*[-*]\s|\s*\d+\.\s)/.test(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      const items: string[] = [];
      const marker = ordered ? /^\s*\d+\.\s+?(.*)$/ : /^\s*[-*]\s+?(.*)$/;
      while (i < lines.length) {
        const m = lines[i].match(marker);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag key={key++} className={`md-list ${ordered ? "md-list-ordered" : "md-list-bullet"}`}>
          {items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !lines[i].trim().startsWith(">") &&
      !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(
      <p key={key++} className="md-p">
        {para.map((p, j) => (
          <span key={j}>
            {inline(p)}
            {j < para.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  }
  return out;
}

export default function Markdown({ text }: { text: string }) {
  return <div className="md select-text">{parseBlocks(text)}</div>;
}
