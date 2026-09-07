# Frontend — Sovereign AI Workbench (Phase 11 UX)

A **conversation-first** local workbench (Next.js + React + TypeScript) that
talks only to the local backend. It is inspired by the Claude/Cowork interaction
model — "talk to the AI normally, but when it does real work, watch the work
happen" — while remaining visually original and enterprise-focused.

## Layout

```
Sidebar                     Conversation                        System (drawer)
────────────────────────    ───────────────────────────────     ─────────────────
+ New task                  user message                        Sovereignty
Chats  (message-titled)     assistant: ack → WORK CONSOLE →     Services (Ollama,
Documents (upload/delete)   final answer → artifact cards       models, OCR, vision,
Artifacts (across jobs)     Composer (large, attach chips,      sandbox, docgen)
System                      send / cancel)                      Resources (CPU/GPU)
user-001 · LOCAL
```

- **Work Console** is terminal-like and derived **only** from the backend
  `execution_trace`: `$ planning`, `$ document_search`, `✓/✕ results`, and
  `✓ TASK COMPLETED`. It never invents activity and never shows tool arguments,
  file contents, or raw JSON. It auto-opens while the agent works and collapses
  after completion.
- The user never chooses models/OCR/RAG/tools — the backend orchestrates.
- All sovereignty/audit numbers come from the real backend
  (`/api/sovereignty`, `/health`).

## Two experiences

- **User workspace** (`/`) — conversation-first: chats, documents, artifacts,
  Work Console, composer. No infrastructure metrics.
- **Admin / operations console** (`/admin`, `/admin/overview`, `/admin/workloads`,
  `/admin/users`, `/admin/models`, `/admin/resources`, `/admin/knowledge`,
  `/admin/audit`, `/admin/sovereignty`, `/admin/system`) — dense operational
  views fed by dev-only `/api/admin/*` endpoints (aggregate metadata only).

A clearly-labelled **dev User/Admin switch** (top bar) chooses which experience
the browser loads. This is **not** authentication/RBAC — the backend enforces the
admin boundary via the `X-Role: admin` header and never returns user messages,
prompts, or document contents to the admin views.

## Run

```bash
npm install
npm run dev            # http://localhost:3000 (backend on :8000, CORS enabled)
```

## Test

```bash
npm run typecheck && npm test && npm run build
```

42 Vitest tests cover the console builder, Work Console, conversation rendering,
composer + attachments, artifact cards/download, cancellation, polling, user
isolation, the system drawer, error states, and the flagship flow — all with a
mocked backend (no live model needed).

## Notes

- No authentication — the dev user selector (`user-001`…`user-005`) uses the
  backend `X-User-ID`; each user sees only their own jobs/documents/artifacts.
- Polling (no WebSockets): jobs ~1s, lists ~2s, health ~3s; stops at terminal
  states, retries on transient errors, stops on 404, pauses in hidden tabs.
- The `npm audit` findings are Next.js server-side advisories that require
  external network access to the server; this localhost-only demo is not exposed
  to them.
- **CI**: `.github/workflows/ci.yml` runs `typecheck` + `vitest` + `next build`
  on every push/pull request.

## Adopted SIH workbench (`/preview`)

- The polished operator workbench (ported from the SIH/POC UI) lives under
  `src/sih/` and is mounted client-only at `/preview` (`src/app/preview/page.tsx`,
  `dynamic ssr:false`). Sections: Agent Chat, Live Logs, Model Routing, Knowledge
  Base, Vault, Code Sandbox, and a right rail (Audit / Network / Models).
- It is wired to the real backend: Agent Chat submits real jobs and polls the
  trace; uploads ingest into the knowledge base; artifacts download the real
  files; Knowledge/Vault/Models/Logs/Sandbox read live endpoints.
- Styling: Tailwind CSS v4 (`@import "tailwindcss"` at the top of
  `src/app/globals.css`; `postcss.config.mjs` → `@tailwindcss/postcss`) plus the
  SIH light/dark design tokens appended in `globals.css`. No product branding.
- Client document exports: `.docx` via `docx`; `.xlsx`/`.pptx` generated with a
  small JSZip OOXML writer (`src/sih/lib/exportFile.ts`). `next.config.mjs` stubs
  the `node:` scheme for client bundling.
- Frontend checks: `npm run typecheck`, `npm test` (63), `npm run build`.
