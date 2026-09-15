# AstraSovereign - On-Premise Sovereign AI Workbench

A fully self-hosted, air-gapped AI workbench for confidential industrial,
defense, legal, financial, and governmental work. Everything runs strictly
locally: open-weight models, task routing, an agent tool runtime, document
intelligence, isolated code execution, and native Office deliverables. There are
no cloud AI APIs, no telemetry, and no data leaves the local network.

---

## Hard constraints

- Fully local and air-gapped. No external AI providers and no runtime network
  dependencies.
- Strict egress lockdown. Outbound connections outside local loopback and the
  configured Ollama host are blocked at the transport layer by `NetworkGuard`.
- Config-driven model selection. Every task type maps to a local model through
  `config/models.yaml`; no model name is hardcoded.
- Agentic orchestration is local. Tasks are decomposed, tools are executed, and
  deliverables are assembled on the machine.
- All major actions are audited. An append-only local audit trail records model
  calls, tool invocations, artifact creation, and administrative events.

---

## Stack

- Backend: FastAPI + Uvicorn + Pydantic-settings (Python). Local model runtime:
  Ollama.
- Frontend: Next.js 16 (Turbopack) + React + TypeScript + Tailwind CSS v4 +
  lucide-react.
- PowerPoint rendering: a local Node/PptxGenJS component under `presentation/`.

---

## Pages

- `/` - Landing page and the unified workbench. After signing in, the workbench
  provides: Home, Coworking Space, AI Assistant (with a real workspace file
  explorer), Code Sandbox, Task History, Knowledge Base, Deliverables,
  Models & Routing, Local Tools, Agent Pipelines, Compute & VRAM, System Health,
  Audit Trail, Team & Roles, and Security.
- `/cowork` - A persistent project IDE: project files, an editor, chat, and live
  agent execution.
- `/admin` - The operations console for the admin role.

The legacy `/preview` UI (the ported SIH preview) was removed; the workbench
above is the interface.

---

## Backend features

- Jobs: `JobManager`, a FIFO queue, and a single worker with a typed lifecycle
  (queued, running, completed, failed, cancelled), cancellation, per-user
  isolation, and durable snapshots.
- Routing: a rule-based `TaskRouter`, a config-driven `ModelRouter`, and a
  `CapabilityRouter` for pipeline stages.
- Multi-model pipeline: complex multi-capability requests are decomposed into
  stages (reasoning, math, coding, document, vision, presentation), each run on
  a different local model. Stage plans are validated against a server-side
  capability allowlist before execution.
- Agent and tools: a bounded agent loop over the local model with
  workspace-scoped tools - file operations, `document_search` (RAG over the
  local knowledge base), `document_vision` (local OCR + vision), `code_execution`
  (isolated Docker sandbox), `document_generation` (Word .docx), and
  `presentation_generation` (PptxGenJS .pptx).
- Resource scheduler: CPU, memory, and GPU accounting with grant/wait/reject
  semantics and release on completion, failure, or cancellation.
- Artifacts: an `ArtifactStore` with secure, owner-scoped download endpoints and
  artifact previews.
- Security: `NetworkGuard` (default-deny external egress) with sovereignty
  reporting, an isolated code sandbox (`--network none`, read-only root), and an
  append-only audit trail.
- Document intelligence: local PDF/image ingestion, chunking, embeddings, a
  per-user vector store, RapidOCR, and Ollama vision.
- Cowork: persistent per-user projects, a project-aware execution path,
  `/api/cowork/chat`, project files APIs, and a persistent context manager
  (project summary, decisions, active task, recent conversation, bounded
  execution summaries).
- Development admin API: `/api/admin/*` exposes operational metadata only.

---

## Repository layout

```
AstraSovereign/
├── backend/
│   ├── app/
│   │   ├── api/          # REST API (chat, jobs, documents, artifacts, audit,
│   │   │                 # projects/cowork, workspace files, sandbox, admin)
│   │   ├── services/     # agent, router, pipeline, tools, sandbox, RAG, audit,
│   │   │                 # projects/context, presentation renderer, network guard
│   │   ├── schemas/      # pydantic models incl. presentation intermediate model
│   │   ├── config.py     # environment-driven settings
│   │   └── main.py       # FastAPI application (app.main:app)
│   ├── requirements.txt
│   └── tests/            # pytest suite (jobs, tools, sandbox, pipeline, cowork,
│                         # presentation, audit, sovereignty, admin, ...)
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js routes: /, /cowork, /admin
│   │   ├── components/   # LandingPage, Login, workbench views, AI Assistant,
│   │   │                 # Sandbox, CommandPalette, core/prompt-kit primitives
│   │   └── lib/          # typed API client, polling hooks, types
│   ├── package.json
│   └── vitest.config.ts
├── presentation/
│   ├── src/render.cjs    # local PptxGenJS renderer (offline)
│   └── package.json
├── config/
│   └── models.yaml       # task type -> model mapping (capabilities + resources)
├── docker/
│   └── sandbox/          # Dockerfile for the numpy-capable sandbox image
├── docs/
└── data/                 # git-ignored local storage (uploads, workspaces,
                          # knowledge, artifacts, audit, projects)
```

---

## Configuration

- `config/models.yaml`: maps task types to local models (provider, model,
  enabled, capabilities, resources). Includes optional math and document
  entries; the sandbox code-execution image is defined in `backend/.env`.
- `backend/.env`: all runtime settings (Ollama endpoint, default model, sandbox
  enable/limits, pipeline limits, Cowork roots, presentation renderer path,
  audit root, etc.). See `backend/.env.example`.

---

## Running locally

Backend

```
cd backend
\.venv\Scripts\python -m uvicorn app.main:app
```

Requirements: a local Ollama server with the configured models pulled, Docker
for the code sandbox, and `python-docx` installed in the venv. For PowerPoint
generation install the renderer once:

```
cd presentation
npm install
```

Frontend

```
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

---

## Tests and CI

- Backend: `cd backend && .\.venv\Scripts\python -m pytest` (full suite; the
  real-Docker tests auto-skip when the daemon or image is unavailable).
- Frontend: `npm run typecheck`, `npm test` (63 tests), `npm run build`.
- CI runs backend pytest and frontend typecheck/tests/build on every push to any
  branch, and on pull requests.

---

## Deliverables

- Word (.docx) via `document_generation`.
- PowerPoint (.pptx) via `presentation_generation`, rendered by the local
  PptxGenJS component with local themes and editable text/tables.
- All artifacts are registered in the `ArtifactStore`, stored inside the job
  workspace, listed through the job API, and downloadable through the secure,
  owner-scoped artifact endpoint.

---

## Notes

- Small-model profile (all local, verified with the code sandbox and Word
  generation): `qwen2.5-coder:3b` for general, document, and coding tasks,
  `llava:7b` for vision, and `nomic-embed-text` for embeddings. Configure these in
  `config/models.yaml`; `backend/.env` sets `DEFAULT_MODEL`.
- `qwen3:1.7b` is not recommended: it does not follow the agent's strict-JSON
  protocol (it returns an empty object), so jobs hit the iteration limit. Use a
  model that reliably emits `{"type":"final"|"tool_call",...}`.
- The code sandbox runs in the `workbench-sandbox:py312` Docker image (built from
  `docker/sandbox/Dockerfile`, includes numpy, pandas, openpyxl, pytest). Rebuild
  it with `docker build -t workbench-sandbox:py312 docker/sandbox`.
