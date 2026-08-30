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
├── backend/          FastAPI backend (Phase 7: local document ingestion + knowledge base)
├── frontend/         Frontend application (planned)
├── config/           models.yaml — task type → model registry (+ resource requirements)
├── data/
│   ├── uploads/      User uploads (not committed)
│   ├── outputs/      Generated deliverables (not committed)
│   ├── knowledge/    Per-user local vector stores (not committed)
│   └── workspaces/   Per-job agent workspaces (not committed)
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
Docker sandbox**, and search the user's **local knowledge base** of ingested
documents (`document_search`) for grounded, source-cited answers. Multi-user safe
via an `X-User-ID` header. See [`backend/README.md`](backend/README.md) for setup,
configuration, and usage.

## Status

**Current phase: Phase 7 — Local Document Ingestion & Knowledge Base.** The agent
can ingest local text documents (PDF/txt/md), embed them with a local model, store
them in a per-user local vector store, and answer retrieval-grounded questions via
the `document_search` tool with source metadata. Phases are built incrementally,
one at a time.
