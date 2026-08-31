# Frontend — Sovereign AI Workbench (Phase 10)

A single-page **local workbench** for operating the Sovereign backend. It is a
Next.js (App Router) + React + TypeScript client that talks **only** to the local
backend — no external services, no telemetry.

```
Backend (FastAPI, :8000)  ←─ HTTP/X-User-ID ──  Frontend (Next.js, :3000)
```

## What it shows

- **Jobs** — submit a task, watch `QUEUED → RUNNING → COMPLETED/FAILED/CANCELLED`,
  stop polling at terminal states, cancel running/queued jobs.
- **Execution trace** — the agent's ordered steps (agent started → plan → tool
  calls → completed) with tool names and short result summaries (never file
  contents).
- **Model/routing visibility** — task type, selected model, agent stage,
  iteration/tool-call counts, resource status.
- **System status** — Ollama reachability, queue, active jobs, per-task-type model
  availability, scheduler (CPU/RAM/GPU allocated vs capacity), knowledge base,
  multimodal (OCR + vision), document generation.
- **Sovereignty indicator** — `LOCAL / SOVEREIGN` with only backend-verified
  facts (Ollama endpoint, reachability, "no external-API counter is exposed").
- **Documents** — upload (PDF/TXT/MD/PNG/JPG/JPEG), ingestion status, list,
  delete; the browser never reads document contents.
- **Artifacts** — generated files listed on the job, downloaded through the
  secure `GET /api/jobs/{job_id}/artifacts/{artifact_id}` endpoint.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript 5
- Plain CSS (no UI framework), custom hooks for polling, `fetch`-based typed API
  client
- Tests: Vitest + React Testing Library + jsdom (backend fully mocked)

## Run

Prerequisites: the backend running on `http://localhost:8000` (see
`backend/README.md`; CORS already allows `http://localhost:3000`).

```bash
npm install
npm run dev          # http://localhost:3000
# or
npm run build && npm run start -p 3000
```

Set `NEXT_PUBLIC_API_BASE_URL` to point at the backend if it is not
`http://localhost:8000`.

## Test

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest run (31 tests, mocked backend)
npm run build        # production build
```

Coverage includes: job submission, queued/running/completed/failed states,
execution-trace rendering, model + resource info, document list, artifact list +
download, per-user isolation, backend error handling, polling termination, and
the flagship approval-note workflow rendering.

## Notes

- No authentication — a dev user selector uses the backend `X-User-ID` mechanism
  (`user-001` … `user-005`).
- Polling is used (no WebSockets): jobs ~1s, lists ~2s, health ~3s; polling stops
  at terminal states and pauses in hidden tabs.
- The `npm audit` findings are Next.js server-side advisories (DoS/cache/middleware)
  that require external network access to the server; this localhost-only demo is
  not exposed to them.
