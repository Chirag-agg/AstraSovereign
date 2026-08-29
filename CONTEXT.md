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
- **Job architecture (Phase 2)**: every request becomes a persistent job
  (`job_id` + typed state machine) processed by a single background worker.
  Flow: `HTTP → JobManager → FIFO queue → Worker → OllamaService → local model`.
- **JobManager / store (Phase 2)**: a `JobStore` interface (in-memory impl, guarded
  by an `asyncio.Lock`) is the seam for swapping in Redis/Postgres later. All
  ownership checks live in the JobManager so API routes can never leak another
  user's job.
- **Worker (Phase 2)**: one `asyncio` task dequeues jobs serially (one active
  Ollama request at a time, FIFO). Reuses the Phase 1 `OllamaService` unchanged;
  Ollama failures surface as job `failed` state with a useful `error`, not HTTP errors.
- **User identity (Phase 2)**: `X-User-ID` header dependency with `user-001` dev
  fallback; no authentication yet — the dependency is the future auth seam.
- **Job states**: `queued`, `running`, `completed`, `failed`, `cancelled`.
  Priority is stored on the job model but priority scheduling is not implemented.
- **Model registry (Phase 3)**: `config/models.yaml` maps task types to local
  models (`provider`, `model`, `enabled`, `capabilities`). Model names come only
  from config; adding a model is a config change. `ModelRegistry` validates the
  file (fails fast on malformed config) and reports per-task-type availability.
- **Task router (Phase 3)**: deterministic, rule-based classification
  (`general`, `coding`, `document`, `vision`) — no LLM is used to classify.
  Rules are ordered and isolated for easy extension.
- **Model router (Phase 3)**: maps a classified `task_type` → configured **enabled**
  model; raises `ModelRoutingError` (no config / disabled) instead of silently
  falling back. `document`/`vision` are reserved for future file/image inputs and
  are disabled by default, so such jobs fail cleanly with `model_routing_error`.
- **Worker + routing (Phase 3)**: the worker classifies each job, stores the
  `task_type` and selected `model` on the job, then calls `OllamaService` with the
  selected model. A job routed to an unavailable model enters the normal lifecycle
  and fails cleanly (`OllamaModelNotFoundError`); startup never fails over a
  missing model and nothing is auto-downloaded.
- **Provider abstraction (Phase 3)**: registry entries carry a `provider` field;
  `ollama` is currently the only supported provider, kept extensible.

---

## Current Phase

**Phase 3 — Model Router & Config-Driven Model Selection** (completed)

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

### Phase 2 — Job Manager & Multi-User Queue
- **Job model** (`app/schemas/job.py`): typed `Job` with `job_id`, `user_id`,
  `message`, `task_type`, `status`, `priority`, `created_at`, `started_at`,
  `completed_at`, `model`, `response`, `error`. States: `queued`, `running`,
  `completed`, `failed`, `cancelled`.
- **JobStore abstraction** (`app/services/job_store.py`): `JobStore` ABC +
  `InMemoryJobStore` (asyncio.Lock-guarded dict) — the swap-in seam for Redis/
  Postgres later.
- **JobManager** (`app/services/job_manager.py`): create/get/list/update/cancel/
  stats. All ownership checks live here (`JobNotFoundError`, `JobPermissionError`,
  `JobStateError`). Listings are always filtered to the caller's `user_id`.
- **JobQueue** (`app/services/job_queue.py`): async FIFO queue of job ids.
- **Worker** (`app/services/worker.py`): single asyncio task; dequeues a job, marks
  it RUNNING, calls the unchanged Phase 1 `OllamaService`, stores the result, and
  marks COMPLETED or FAILED (with a useful `error`). Graceful on Ollama down /
  timeout / model missing / unexpected exceptions. Skips jobs cancelled while queued.
- **API changes**: `POST /api/chat` now enqueues and returns `{job_id, status:
  queued}` with 202 (never blocks on the model). New `GET /api/jobs`,
  `GET /api/jobs/{job_id}`, `DELETE /api/jobs/{job_id}` (cancel queued; 409 if
  running/terminal). `GET /health` extended with `queue_size`, `jobs` counts, and
  `worker` state/active job. `X-User-ID` header dependency with `user-001` fallback.
- **HTTP errors now**: `422` validation, `404 job_not_found`, `403 forbidden`
  (cross-user access), `409 invalid_state`. Ollama failures are job `failed` state,
  not HTTP errors.
- **Logging**: structured `job_created`, `job_started`, `job_completed`,
  `job_failed`, `job_cancelled` events with `job_id`, `user_id`, `status`. No
  prompts or responses logged.
- **Tests (34, all passing)**: direct `OllamaService` unit tests (service stays
  independently testable), chat submission/validation/non-blocking, job ownership
  + listing + cancellation, worker failure states, five-user concurrency scenario
  (distinct ids, correct per-user results, FIFO ordering, no mixing).
- **Live smoke test**: ran against real local Ollama (`DEFAULT_MODEL=llama3.1:latest`);
  verified submit→queued→completed lifecycle, 403 cross-user access, per-user
  listing, and health job stats.
- **Repository**: initialized as a git repo (branch `main`) and pushed to
  `https://github.com/Chirag-agg/AstraSovereign` (git identity: Chirag-agg /
  ca.aggarwal2006@gmail.com).
- **Deliberately NOT implemented** (out of scope for Phase 2): GPU scheduler, VRAM
  management, model auto-routing, agent loop, tool calling, RAG, OCR, vision, code
  sandbox, frontend, authentication, Redis/Celery/Kafka/Postgres.

### Phase 3 — Model Router & Config-Driven Model Selection
- **Model registry** (`config/models.yaml` + `app/services/model_registry.py`):
  task type → model mapping (`provider`, `model`, `enabled`, `capabilities`).
  `ModelRegistry.from_file()` validates the YAML and fails fast on malformed
  config (`ModelConfigError`); `availability()` reports per-task-type
  configured/enabled/available flags from the live Ollama model set.
- **TaskRouter** (`app/services/task_router.py`): deterministic keyword/rule
  classification into `general` / `coding` / `document` / `vision` with a
  `reason`; no LLM used to classify. Rules are ordered and isolated.
- **ModelRouter** (`app/services/model_router.py`): `resolve(task_type, reason)`
  → `RoutingResult{task_type, provider, model, reason}`; raises
  `ModelRoutingError` when a task type has no configured or enabled model — no
  silent fallback, no external services.
- **Worker integration**: each job is classified, the `task_type` and selected
  `model` are stored on the job, then `OllamaService.generate(message,
  model=<selected>)` is called. `ModelRoutingError` fails the job cleanly with a
  useful `error`; routing failure jobs still record the classified `task_type`.
- **Model availability**: startup discovers available Ollama models and logs
  `model_availability` (non-fatal if Ollama is down). `/health` exposes
  `models: {task_type: {configured, available, enabled}}`. A job routed to a
  configured-but-unavailable model fails with `OllamaModelNotFoundError` through
  the normal lifecycle; nothing is auto-downloaded.
- **Logging**: added `registry_loaded`, `model_availability`, `task_classified`,
  `model_selected`, `routing_failure` structured events (job_id/user_id/task_type/
  model/status where applicable). No prompts or responses logged.
- **API/job visibility**: jobs already expose `task_type` and `model` in
  `GET /api/jobs/{job_id}` and `GET /api/jobs` — clients can see which model
  handled their job.
- **Tests (64, all passing)**: 30 new tests — TaskRouter classification,
  ModelRouter/ModelRegistry (selection, disabled/missing failure, availability,
  YAML validation), and end-to-end routing (general→general model,
  coding→coding model, code snippet→coding, two jobs → two models, disabled /
  missing-config / unavailable-model clean failures, listing exposes
  task_type/model). All 34 Phase 1/2 tests preserved.
- **Live smoke test**: ran against real local Ollama with a temp registry
  (general→`llama3.1:latest`, coding→`llama3:latest`); verified general routing,
  coding routing, and the disabled-model clean failure; `/health` model
  availability correct.
- **Deliberately NOT implemented** (out of scope for Phase 3): frontend, GPU
  scheduling, VRAM management, dynamic model loading, agent loop, tool calling,
  RAG, OCR, vision processing, document generation, Docker sandbox, authentication,
  Redis/Celery/external APIs.

---

## Files and Directories

```
sovereign-ai-workbench/            (== ./AstraSovereign)
├── CONTEXT.md                     persistent project memory (this file)
├── README.md                      project overview and goals
├── .gitignore                     excludes env, logs, uploads, outputs, models, caches
├── backend/
│   ├── README.md                  backend setup/run/usage guide
│   ├── requirements.txt           fastapi, uvicorn, httpx, pydantic-settings, pyyaml
│   ├── requirements-dev.txt       pytest
│   ├── pytest.ini                 pythonpath=tests config
│   ├── .env.example               template for local config (copy to .env)
│   ├── app/
│   │   ├── main.py                create_app() factory, lifespan, JSON logging
│   │   ├── config.py              pydantic-settings Settings (env-driven)
│   │   ├── schemas/
│   │   │   ├── chat.py            ChatRequest (message, task_type, priority)
│   │   │   └── job.py             Job, JobStatus, JobSubmitResponse, JobSummary
│   │   ├── services/
│   │   │   ├── ollama_service.py  OllamaService async client + typed errors
│   │   │   ├── job_store.py       JobStore ABC + InMemoryJobStore
│   │   │   ├── job_manager.py     JobManager (lifecycle + ownership)
│   │   │   ├── job_queue.py       FIFO async job queue
│   │   │   ├── worker.py          background worker (dequeue → classify → route → Ollama)
│   │   │   ├── model_registry.py  ModelRegistry (validates config/models.yaml)
│   │   │   ├── task_router.py     TaskRouter (deterministic classification)
│   │   │   └── model_router.py    ModelRouter (task_type → enabled model)
│   │   └── api/
│   │       ├── deps.py            get_user_id (X-User-ID header dependency)
│   │       ├── chat.py            POST /api/chat (enqueue job)
│   │       ├── jobs.py            GET/DELETE /api/jobs, GET /api/jobs/{job_id}
│   │       └── health.py          GET /health (Ollama + models + queue + worker)
│   └── tests/
│       ├── conftest.py            fixtures, model-aware Ollama mock, wait_for_job
│       ├── test_ollama_service.py 8 tests (direct service unit tests)
│       ├── test_chat.py           7 tests
│       ├── test_health.py         3 tests
│       ├── test_jobs.py           8 tests
│       ├── test_worker.py         5 tests
│       ├── test_concurrency.py    2 tests (5-user + FIFO ordering)
│       ├── test_task_router.py    10 tests (classification rules)
│       ├── test_model_router.py   11 tests (selection, registry validation)
│       └── test_routing.py        9 tests (end-to-end job routing)
├── frontend/                      (empty — reserved for frontend)
├── config/
│   └── models.yaml                task type → local model registry (Phase 3)
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
  `.env` (or exported env vars) with `DEFAULT_MODEL` set before jobs can run
  against a live Ollama.
- Default `DEFAULT_MODEL` is empty; app logs a startup warning until configured.
- `config/models.yaml` enables `qwen2.5:7b` (general) and `qwen2.5-coder:7b`
  (coding), which are NOT currently pulled on the dev machine's Ollama (only
  `llama3.1:latest` and `llama3:latest` exist). Jobs for those types fail cleanly
  with `OllamaModelNotFoundError` until the models are pulled or the config is
  edited. This is intentional: nothing is auto-downloaded.
- The in-memory job store/queue are process-local: jobs are lost on restart and
  do not survive multiple processes. `JobStore` is the seam for a durable store.
- One worker only; no concurrency or priority scheduling yet (by design).
- Task classification is keyword-based and deterministic; it may misclassify
  ambiguous prose (acceptable for this phase, no LLM used).
- `logs/backend.log` is generated at import time (module-level `app = create_app()`);
  it is gitignored so this is harmless.
- Repository is a git repo (branch `main`) tracking `origin` at
  `https://github.com/Chirag-agg/AstraSovereign.git`.

---

## Next Steps

1. **Recommended next phase — Phase 4: Agentic Pipeline / Tool Calling.**
   Introduce an agent loop that decomposes tasks and calls local tools
   (document/image processing, code sandbox, knowledge base search) using the
   routing layer built in Phase 3. **Do not start until explicitly requested.**
2. Other candidate phases (do not start early): document & image processing (OCR,
   vision); local knowledge base (RAG + vector store); Docker code sandbox; Office
   deliverable generation (.docx/.xlsx/.pptx); durable job store (Redis/Postgres
   behind `JobStore`); audit-log schema for "all major actions logged"; frontend.
3. Keep updating this file after every significant change.

---

## Change Log

- **Phase 0 (2026-08-29)**: Created project scaffold — directory structure, CONTEXT.md,
  README.md, .gitignore. No application code yet.
- **Phase 1 (2026-08-29)**: Implemented FastAPI backend (`backend/`) that talks only to
  the local Ollama server — `GET /health`, `POST /api/chat`, env-driven config,
  structured JSON logging, typed Ollama error handling, 10 passing tests, live smoke
  test against real Ollama. See Architecture Decisions for the stack and runtime chosen.
- **Phase 2 (2026-08-29)**: Reworked the backend to a job queue architecture —
  `HTTP → JobManager → FIFO queue → Worker → Ollama`. `POST /api/chat` enqueues and
  returns a `job_id` immediately; new `GET /api/jobs`, `GET /api/jobs/{job_id}`,
  `DELETE /api/jobs/{job_id}` enforce per-user ownership via `X-User-ID`. 34 tests
  incl. a five-user concurrency scenario; live smoke test against real Ollama.
  Also initialized the git repo (`main`) and pushed to GitHub.
- **Phase 3 (2026-08-29)**: Added config-driven model routing —
  `config/models.yaml` model registry, deterministic TaskRouter (general/coding/
  document/vision), ModelRouter (task_type → enabled model, no silent fallback),
  and worker integration (classify → select → call OllamaService with the selected
  model). `/health` reports per-task-type model availability; jobs expose
  `task_type`/`model`. 64 tests incl. routing unit + end-to-end; live smoke test
  verified general and coding routing and the disabled-model clean failure.
