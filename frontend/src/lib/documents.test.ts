import { describe, expect, it } from "vitest";

import { ACCEPTED_UPLOAD_TYPES, dedupeDocuments } from "@/lib/documents";
import { documentFixture } from "@/test-utils/factory";

describe("dedupeDocuments", () => {
  it("keeps one document per filename (newest wins)", () => {
    const docs = [
      documentFixture({ document_id: "doc-old", filename: "report.pdf", created_at: "2026-08-01T00:00:00Z" }),
      documentFixture({ document_id: "doc-dup", filename: "report.pdf", created_at: "2026-08-20T00:00:00Z" }),
      documentFixture({ document_id: "doc-other", filename: "manual.txt", created_at: "2026-08-15T00:00:00Z" }),
      documentFixture({ document_id: "doc-other2", filename: "manual.txt", created_at: "2026-08-10T00:00:00Z" }),
    ];
    const unique = dedupeDocuments(docs);
    expect(unique).toHaveLength(2);
    const byName = Object.fromEntries(unique.map((d) => [d.filename, d.document_id]));
    expect(byName["report.pdf"]).toBe("doc-dup");
    expect(byName["manual.txt"]).toBe("doc-other");
  });

  it("handles null/empty", () => {
    expect(dedupeDocuments(null)).toEqual([]);
    expect(dedupeDocuments([])).toEqual([]);
  });
});

describe("ACCEPTED_UPLOAD_TYPES", () => {
  it("covers every family the backend ingests", () => {
    const accepted = ACCEPTED_UPLOAD_TYPES.split(",");
    for (const ext of [".pdf", ".png", ".bmp", ".webp", ".docx", ".xlsx", ".pptx",
                       ".odt", ".csv", ".json", ".yaml", ".html", ".rtf", ".txt",
                       ".md", ".env", ".py", ".svg"]) {
      expect(accepted).toContain(ext);
    }
  });

  it("excludes the legacy binary Office formats", () => {
    const accepted = ACCEPTED_UPLOAD_TYPES.split(",");
    for (const ext of [".doc", ".xls", ".ppt"]) {
      expect(accepted).not.toContain(ext);
    }
  });
});
