"use client";

// Minimal, safe markdown renderer (no HTML passthrough). Supports paragraphs,
// fenced code blocks, headings, bullet/numbered lists, inline code, and bold.

import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  parts.forEach((part, i) => {
    if (!part) {
      return;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    } else if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(part);
    }
  });
  return nodes;
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
      i += 1; // closing fence
      out.push(
        <div
          key={key++}
          className="my-3 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-slate-100 bg-slate-50/80 text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
            <span>{lang}</span>
          </div>
          <pre className="p-3.5 text-xs sm:text-[13px] font-mono leading-relaxed text-slate-900 bg-white overflow-x-auto whitespace-pre">
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

    // headings
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      out.push(
        <h3
          key={key++}
          id={`h${key}`}
          className="text-base font-bold text-slate-900 mt-4 mb-2 tracking-tight"
        >
          {inline(heading[2])}
        </h3>
      );
      i += 1;
      continue;
    }

    // lists
    if (/^(\s*[-*]\s|\s*\d+\.\s)/.test(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      const items: string[] = [];
      const marker = ordered ? /^\s*\d+\.\s+?(.*)$/ : /^\s*[-*]\s+?(.*)$/;
      while (i < lines.length) {
        const m = lines[i].match(marker);
        if (!m) {
          break;
        }
        items.push(m[1]);
        i += 1;
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag
          key={key++}
          className={`my-2 pl-5 space-y-1 text-sm md:text-[14.5px] leading-relaxed text-slate-800 ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    // paragraph (consume consecutive non-list, non-fence, non-heading lines)
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^#{1,4}\s/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(
      <p key={key++} className="text-sm md:text-[14.5px] leading-relaxed text-slate-800 mb-3 font-sans">
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
