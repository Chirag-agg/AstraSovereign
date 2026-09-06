// Document list helpers.

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
