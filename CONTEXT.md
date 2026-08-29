# CONTEXT.md — Persistent Project Memory

> **Read me before making significant changes. Update me after completing significant work.**
> This file is the authoritative persistent memory for this project. If chat context is lost,
> read this file first to resume work without losing project understanding.

---

## Project Overview

**Sovereign On-Premise Agentic AI Workbench**

A completely self-hosted, air-gapped AI workbench for confidential industrial and
government work. The system runs entirely locally, supports multiple open-weight AI
models, and provides an agentic pipeline that:

- Automatically selects the appropriate local model for each task
- Uses local tools only
- Processes documents and images (local OCR, local vision models)
- Executes code in an isolated sandbox
- Searches a local knowledge base (RAG)
- Generates deliverables: Word (.docx), Excel (.xlsx), and PowerPoint (.pptx)

**Hard constraints (non-negotiable):**
- No external AI APIs
- No data may leave the local machine/network
- Must support multiple local models
- Model selection must be configurable
- All major actions must be logged

---

## Core Requirements

1. **Fully local / air-gapped**: Zero external network dependencies at runtime. All
   model inference, processing, and storage happens on-premise.
2. **Multi-model support**: Multiple open-weight models (LLMs, embedding models, vision
   models, OCR) hosted locally (e.g., Ollama, vLLM, local Hugging Face) behind a
   pluggable interface.
3. **Configurable model routing**: A config-driven "model router" decides which model
   handles each task type (reasoning, summarization, code, vision, embeddings). No
   hardcoded choices.
4. **Agentic orchestration**: Task decomposition, tool use, and deliverable assembly
   run locally.
5. **Tool set (local only)**: Document/image processing, code execution sandbox,
   knowledge base search, and Office document generation.
6. **Isolated code sandbox**: Untrusted/generated code runs in an isolated sandbox
   (Docker container planned).
7. **Local knowledge base**: Retrieval over a local document store (RAG) with no
   external services.
8. **Office deliverable generation**: Native .docx / .xlsx / .pptx output.
9. **Auditability**: Every major action is logged to `logs/`.
10. **Security**: Data never leaves the machine; secrets (if any) are never committed.

---

## Architecture Decisions

- **Repository root = this directory** (`AstraSovereign`). The spec's top-level
  `sovereign-ai-workbench/` maps to the current working directory to avoid redundant
  nesting. The working directory was empty at Phase 0 start, so it was adopted as the
  project root.
- **Monorepo layout**: `backend/`, `frontend/`, `config/`, `data/`, `logs/`, `docker/`.
- **Incremental, phase-by-phase builds**: Phases are implemented one at a time; future
  phases are not implemented unless explicitly requested.
- **Backend stack (decided in Phase 1)**: FastAPI + Uvicorn + httpx + pydantic-settings.
  Config comes from environment variables / `.env` only — no hardcoded URLs or model names.
- **Model runtime (decided in Phase 1)**: **Ollama** is the Phase 1 local model runtime.
  It is installed and running on the dev machine (`http://localhost:11434`) with models
  `llava:7b`, `qwen2.5:7b`, `qwen2.5-coder:7b`, `llama3:latest`. vLLM / local HF remain
  candidates for future evaluation.
- **Frontend stack undecided** — to be decided in a later phase (no code written yet).
- **Config-first model selection**: Routing rules will live in `config/` (not implemented
  yet; Phase 1 uses a single `DEFAULT_MODEL`).
- **Structured (JSON) logging**: implemented in Phase 1 via a stdlib `JsonFormatter`
  writing to console and `logs/backend.log`. Audit-logging schema for the broader
  "all major actions logged" requirement still to be defined.
- **App structure**: `create_app()` factory + `app.state` service injection; the
  `ollama_transport` seam lets tests mock Ollama via `httpx.MockTransport`.

---

## Current Phase

**Phase 1 — Local Backend & Model Connection** (completed)

---

## Completed Work

### Phase 0 — Project Foundation
- Created empty `backend/`, `frontend/`, `config/`, `logs/`, `docker/` directories.
- Created `data/` with `uploads/`, `outputs/`, `knowledge/` subdirectories.
- Created `CONTEXT.md` (this file) as persistent project memory.
- Created `README.md` with project overview and high-level goals.
- Created `.gitignore` for Python, Node.js, env files, logs, uploads, outputs, and
  model/data artifacts.
- **Deliberately NOT implemented** (Phase 0 scope): backend, frontend, AI models,
  model router, agents, RAG, OCR, Docker sandbox, Office generation, logging system.
- Repository is not yet a git repo (no `git init` run). Initialized later if requested.

### Phase 1 — Local Backend & Model Connection
- **Implemented** a minimal FastAPI backend that communicates **only** with the local
  Ollama server (`OLLAMA_BASE_URL`). No external AI APIs, no telemetry.
- Endpoints:
  - `GET /health` — backend liveness + Ollama reachability + model list + default model.
  - `POST /api/chat` — accepts `{"message": ...}`, forwards to Ollama
    `/api/generate` with `stream: false`, returns
    `{"response": ..., "model": ..., "status": "success"}`.
- **Config via env / `.env` only** (`backend/.env.example`): `OLLAMA_BASE_URL`,
  `DEFAULT_MODEL`, `HOST`, `PORT`, `OLLAMA_TIMEOUT_SECONDS`, `LOG_LEVEL`, `LOG_FILE`.
  No hardcoded URLs or model names in code.
- **Structured JSON logging** (stdlib `JsonFormatter` to console + `logs/backend.log`):
  startup (logs Ollama destination + default model), chat request received (message
  length only — full prompt NOT logged), Ollama request start, success, and failure.
- **Error handling** maps to JSON `detail` errors: Ollama unreachable `503`
  (`ollama_unavailable`), timeout `504` (`ollama_timeout`), model missing `502`
  (`model_not_found`), bad Ollama payload/HTTP error `502` (`ollama_request_error`),
  unexpected `500` (`internal_error`), validation `422`.
- **Tests (10, all passing)**: health ok, health with Ollama down, chat success,
  empty/whitespace/missing message validation, Ollama unavailable, model not found,
  timeout, bad payload, Ollama 500. Ollama mocked via `httpx.MockTransport`.
- **Live smoke test**: ran the server against the real local Ollama with
  `DEFAULT_MODEL=qwen2.5:7b`; `/health` and `/api/chat` both verified working.
- Created `backend/README.md` (setup, Ollama, env, run, curl examples, error table,
  tests) and a Backend section in the root `README.md`.
- **Deliberately NOT implemented** (out of scope for Phase 1): frontend, agent loop,
  tool calling, multi-model routing, OCR, vision, RAG, vector DB, Docker sandbox,
  authentication, file upload.

---

## Files and Directories

```
sovereign-ai-workbench/            (== ./AstraSovereign)
├── CONTEXT.md                     persistent project memory (this file)
├── README.md                      project overview and goals
├── .gitignore                     excludes env, logs, uploads, outputs, models, caches
├── backend/
│   ├── README.md                  backend setup/run/usage guide
│   ├── requirements.txt           fastapi, uvicorn, httpx, pydantic-settings
│   ├── requirements-dev.txt       pytest
│   ├── pytest.ini                 pythonpath=tests config
│   ├── .env.example               template for local config (copy to .env)
│   ├── app/
│   │   ├── main.py                create_app() factory, lifespan, JSON logging setup
│   │   ├── config.py              pydantic-settings Settings (env-driven)
│   │   ├── schemas/
│   │   │   └── chat.py            ChatRequest / ChatResponse
│   │   ├── services/
│   │   │   └── ollama_service.py  OllamaService async client + typed errors
│   │   └── api/
│   │       └── chat.py            GET /health, POST /api/chat
│   └── tests/
│       ├── conftest.py            fixtures + httpx.MockTransport mocks
│       ├── test_health.py         2 tests
│       └── test_chat.py           8 tests
├── frontend/                      (empty — reserved for frontend)
├── config/                        (empty — reserved for model routing / system config)
├── data/
│   ├── uploads/                   (empty — user uploads, gitignored)
│   ├── outputs/                   (empty — generated deliverables, gitignored)
│   └── knowledge/                 (empty — local knowledge base, gitignored)
├── logs/                          backend.log (gitignored, structured JSON)
└── docker/                        (empty — reserved for sandbox/container images)
```

---

## Known Issues

- `backend/.env` is not present (only `.env.example`); the backend needs a real
  `.env` (or exported env vars) with `DEFAULT_MODEL` set before `POST /api/chat`
  can run against a live Ollama.
- Default `DEFAULT_MODEL` is empty; app logs a startup warning until it is configured.
- `logs/backend.log` is generated at import time (module-level `app = create_app()`);
  it is gitignored so this is harmless.
- No `.gitkeep` files yet; empty scaffold dirs would be dropped by a future
  `git init` + commit unless added.
- Repository is still not a git repo.

---

## Next Steps

1. **Initialize the repository** (`git init`) if version control is desired. If so,
   decide whether to track empty scaffold dirs via `.gitkeep`.
2. **Recommended next phase — Phase 2: Model Router & Config-Driven Selection.**
   Define the `config/` model-routing schema (JSON/YAML) mapping task types
   (reasoning, summarization, code, vision, embeddings) to local models, and implement
   a `model_router` service that resolves a model per request from configuration.
   Extend the `/api/chat` request to accept an optional task type. **Do not start until
   explicitly requested.**
3. Other candidate phases after Phase 2 (do not start early): agent loop / tool
   calling; document & image processing (OCR, vision); local knowledge base (RAG +
   vector store); Docker code sandbox; Office deliverable generation (.docx/.xlsx/.pptx);
   audit-log schema for "all major actions logged"; frontend.
4. Keep updating this file after every significant change.

---

## Change Log

- **Phase 0 (2026-08-29)**: Created project scaffold — directory structure, CONTEXT.md,
  README.md, .gitignore. No application code yet.
- **Phase 1 (2026-08-29)**: Implemented FastAPI backend (`backend/`) that talks only to
  the local Ollama server — `GET /health`, `POST /api/chat`, env-driven config,
  structured JSON logging, typed Ollama error handling, 10 passing tests, live smoke
  test against real Ollama. See Architecture Decisions for the stack and runtime chosen.
