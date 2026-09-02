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
