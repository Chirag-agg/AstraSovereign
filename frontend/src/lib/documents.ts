// Document list helpers.

/**
 * Extensions the ingestion pipeline accepts, grouped by the family that reads
 * them. Kept here so the two hidden file inputs cannot drift apart, and shaped
 * to mirror `SUPPORTED_DOCUMENT_TYPES` on the backend.
 */
const ACCEPTED_UPLOAD_EXTENSIONS = [
  // PDF and the raster image formats (images go through OCR).
  "pdf",
  "png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp",
  // Office and OpenDocument.
  "docx", "xlsx", "pptx", "odt", "ods", "odp",
  // Data.
  "csv", "tsv", "json", "yaml", "yml", "xml",
  // Markup and prose. SVG is indexed for its labels; it is not a raster, so
  // export one as a PNG/JPG when it is wanted as a figure in a deliverable.
  "html", "htm", "rtf", "svg", "txt", "text", "md", "markdown", "rst", "log",
  // Config.
  "ini", "cfg", "conf", "toml", "env",
  // Source code.
  "py", "pyi", "js", "jsx", "mjs", "cjs", "ts", "tsx", "java",
  "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "cs", "go", "rs", "rb", "php",
  "swift", "kt", "kts", "scala", "sh", "bash", "zsh", "fish", "ps1", "psm1",
  "bat", "cmd", "pl", "pm", "lua", "r", "dart", "vue", "svelte", "gradle",
  "sql", "css", "scss", "sass", "less",
];

export const ACCEPTED_UPLOAD_TYPES = ACCEPTED_UPLOAD_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(",");

export interface DeducibleDocument {
  document_id: string;
  filename: string;
  created_at: string;
}

/**
 * Re-ingesting a file creates a new document record; for a clean employee
 * experience each uploaded filename should appear exactly once. Keeps the
 * newest record per filename (stable order by creation time).
 */
export function dedupeDocuments<T extends DeducibleDocument>(docs: T[] | null): T[] {
  if (!docs) {
    return [];
  }
  const newest = new Map<string, T>();
  for (const doc of docs) {
    const existing = newest.get(doc.filename);
    if (!existing || new Date(doc.created_at).getTime() > new Date(existing.created_at).getTime()) {
      newest.set(doc.filename, doc);
    }
  }
  return Array.from(newest.values());
}
