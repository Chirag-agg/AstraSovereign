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
      nodes.push(<code key={i}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
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
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      out.push(
        <pre key={key++}>
          <code>{buf.join("\n")}</code>
        </pre>,
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
        <h3 key={key++} id={`h${key}`}>
          {inline(heading[2])}
        </h3>,
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
        <Tag key={key++}>
          {items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </Tag>,
      );
      continue;
    }

    // paragraph (consume consecutive non-list, non-fence, non-heading lines)
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^\s*[-*]\s/.test(lines[i]) && !lines[i].trim().startsWith("```") && !/^#{1,4}\s/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(
      <p key={key++}>
        {para.map((p, j) => (
          <span key={j}>
            {inline(p)}
            {j < para.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>,
    );
  }
  return out;
}

export default function Markdown({ text }: { text: string }) {
  return <div className="md">{parseBlocks(text)}</div>;
}
