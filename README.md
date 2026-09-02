# Sovereign On-Premise Agentic AI Workbench

A completely **self-hosted, air-gapped** AI workbench for confidential industrial and
government work. Everything runs locally — models, tools, knowledge base, and document
generation — with no external AI APIs and no data leaving the machine or network.

## High-Level Goals

- **Multiple open-weight models, run locally** — LLMs, vision, embeddings, and OCR
  hosted on-premise (no cloud inference).
- **Automatic, configurable model selection** — a model router chooses the right local
  model for each task based on configuration, not hardcoded logic.
- **Local tools** — process documents and images, execute code in an isolated sandbox,
  and search a local knowledge base (RAG).
- **Office deliverable generation** — produce native Word (`.docx`), Excel (`.xlsx`),
  and PowerPoint (`.pptx`) outputs.
- **Full auditability** — every major action is logged.
- **Security first** — air-gapped by design; data never leaves the local machine/network.

## Layout

```
├── backend/          FastAPI backend (Phase 9: office deliverable generation)
├── frontend/         Next.js + React + TypeScript workbench (Phase 10)
├── config/           models.yaml — task type → model registry (+ resource requirements)
├── data/
│   ├── uploads/      User uploads (not committed)
│   ├── outputs/      Generated deliverables (not committed)
│   ├── knowledge/    Per-user local vector stores (not committed)
│   ├── workspaces/   Per-job agent workspaces (not committed)
│   └── tmp/          Rendered page images (cleaned after use, not committed)
├── logs/             Audit logs (not committed)
└── docker/           Sandbox images / config (planned)
```

See [CONTEXT.md](CONTEXT.md) for the authoritative project state and phase plan.

## Backend

The backend is a FastAPI service that communicates **only** with local services
(a local Ollama server and, when enabled, a local Docker daemon). Requests become
**jobs** processed asynchronously by a background worker (`POST /api/chat`
returns a `job_id` immediately). Each job is classified by task type, routed to a
config-driven model (`config/models.yaml`), scheduled against declared resource
capacity, and executed by a **local agent** that can call workspace-scoped tools
(`list_files`, `read_file`, `write_file`), run generated code in an **isolated
Docker sandbox**, search the user's **local knowledge base** of ingested
documents (`document_search`) for grounded, source-cited answers, analyze
**scanned PDFs and images** with fully local OCR + a local vision model
(`document_vision`), and generate **real Word deliverables** from structured
findings (`document_generation`) that users can list and download securely.
Multi-user safe via an `X-User-ID` header. See [`backend/README.md`](backend/README.md)
for setup, configuration, and usage.

## Frontend

A single-page **local workbench** (`frontend/`, Next.js + React + TypeScript)
that operates the backend: submit tasks, watch job states and the agent
execution trace, inspect model/resource status, upload documents, and download
generated artifacts — with a visible `LOCAL / SOVEREIGN` indicator backed by
`/health`. Dev user selector (`user-001`…`user-005`) via `X-User-ID`; no
authentication. See [`frontend/README.md`](frontend/README.md).

## Status

**Current phase: Phase 11 — Sovereignty Hardening, Audit Evidence, Workbench UX &
Organizational User/Admin split.** The platform now has two experiences: a
conversation-first **User workspace** (`/`) with a terminal-like Work Console,
and a **development Admin/operations console** (`/admin`) fed by `/api/admin/*`
(overview, workloads, users, models, resources, knowledge, audit, sovereignty,
system). A clearly dev-only User/Admin role switch selects the experience; the
backend enforces the admin boundary independently (`X-Role: admin`) and never
exposes user messages or document contents to admins. Sovereignty remains
verified (NetworkGuard + audit trail). Phases are built incrementally, one at a
time.

## Documentation

- [CONTEXT.md](CONTEXT.md) — authoritative project state, phases, and decisions
- [Developer onboarding runbook](docs/ONBOARDING.md) — clone → running demo in ~30 min
- [Cleanup / retention policy](docs/CLEANUP.md) — age-based local data cleanup
- [Sovereignty, audit & network evidence](docs/SOVEREIGNTY.md) — what is enforced,
  what is verified, dependency review, how to inspect the audit trail

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch flow, testing commands, and
contribution rules. Use the issue/PR templates in `.github/`. CI
(`.github/workflows/ci.yml`) runs the backend and frontend suites on every push
and pull request.
