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
├── backend/          FastAPI backend (Phase 3: model routing, job queue)
├── frontend/         Frontend application (planned)
├── config/           models.yaml — task type → local model registry
├── data/
│   ├── uploads/      User uploads (not committed)
│   ├── outputs/      Generated deliverables (not committed)
│   └── knowledge/    Local knowledge base (not committed)
├── logs/             Audit logs (not committed)
└── docker/           Sandbox / container images (planned)
```

See [CONTEXT.md](CONTEXT.md) for the authoritative project state and phase plan.

## Backend

The backend is a FastAPI service that communicates **only** with a local Ollama
server. Requests become **jobs** processed asynchronously by a background worker
(`POST /api/chat` returns a `job_id` immediately). Each job is classified by task
type and routed to a config-driven model (`config/models.yaml`). Multi-user safe
via an `X-User-ID` header. See [`backend/README.md`](backend/README.md) for
setup, configuration, and usage.

## Status

**Current phase: Phase 3 — Model Router & Config-Driven Model Selection.** Jobs are
queued FIFO, classified by task type, and routed to the configured local model for
that task type. Phases are built incrementally, one at a time.
