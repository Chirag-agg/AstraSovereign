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
- **Agent (Phase 4)**: after routing, a controlled loop runs each job —
  decide → (tool) → observe → decide → complete. Termination is deterministic
  (`MAX_AGENT_ITERATIONS`=10, `MAX_AGENT_TOOL_CALLS`=20); the agent checks job
  cancellation between iterations and before tools, and records a serializable
  `execution_trace` plus `agent_stage`/`iteration_count`/`tool_call_count` on the job.
- **Model↔tool protocol (Phase 4)**: strict JSON via Ollama `format: json` —
  `{"type":"final"|"tool_call",...}`; non-JSON model output is treated as a plain
  final response. Tool name/args/paths are validated before any execution.
- **Tools (Phase 4)**: `Tool` ABC + deny-by-default `ToolRegistry` with
  `list_files`, `read_file`, `write_file`. Future tools plug in without changing
  the agent loop.
- **Workspace isolation (Phase 4)**: each job gets `data/workspaces/<user>/<job>/`;
  identifiers are sanitized and `resolve_within_workspace` rejects `..` traversal,
  absolute paths, and symlink escapes — tools cannot reach other users' workspaces
  or arbitrary filesystem paths.
- **Cancellation (Phase 4)**: `cancel_job` now accepts QUEUED **and** RUNNING jobs;
  the worker/agent observe the state change and stop as soon as practical.
- **Code-execution sandbox (Phase 5)**: `code_execution` tool runs generated Python
  ONLY inside a short-lived Docker container (`docker run --network none --read-only
  --cap-drop ALL --security-opt no-new-privileges --cpus/--memory limits`), a strict
  timeout, and only a temp code dir mounted `:ro` — never the host fs, app workspace,
  or Docker socket. Container removed via `--rm` + awaited `docker rm -f` on timeout
  (no orphans). Registered only when `SANDBOX_ENABLED=true` (deny-by-default).
- **SandboxRunner abstraction (Phase 5)**: injectable `SandboxRunner` (Docker CLI
  impl + fake in tests); `build_args()` is unit-tested for the exact secure invocation.
- **Sandbox config (Phase 5)**: enabled/image/timeout/cpu/memory/stdout/stderr limits
  from env; the image must already exist locally and is never auto-pulled; Docker or
  image unavailability fails the job cleanly (`SandboxRunnerError` → `ToolError`).
- **Tool logging context (Phase 5)**: `log_context` (contextvars) lets tools log
  `code_execution_started/completed/failed/timeout/cleanup` with job_id/user_id;
  generated source and full output are never logged.
- **Resource scheduler (Phase 6)**: between routing and execution, a
  `ResourceScheduler` decides grant/wait/reject based on the selected model's
  declared `resources` and the in-memory `ResourceProvider` capacity. FIFO waiters
  (no starvation); impossible requests (oversized vs capacity, unknown GPU) fail
  jobs cleanly; resources released on completion/failure/cancellation/timeout.
  Single worker → one active allocation, so multi-job concurrency is enforced at
  the accounting layer and exercised by scheduler unit tests (five-user scenario).
- **Resource provider (Phase 6)**: `ResourceProvider` abstraction (in-memory impl
  for deterministic tests; read-only `LocalResourceProvider` for informational
  CPU/memory/GPU discovery via `RESOURCE_CAPACITY_MODE=auto` — never requires
  NVIDIA tooling, never loads/unloads models).
- **Capacity config (Phase 6)**: `RESOURCE_CPU_CORES`, `RESOURCE_MEMORY_MB`,
  `RESOURCE_GPU_VRAM_MB`, `RESOURCE_GPU_COUNT`; models declare `resources`
  (`gpu_vram_mb`/`cpu_cores`/`memory_mb`/`gpu_id`) in `config/models.yaml`.
  Priority remains on the job model but priority scheduling is not implemented;
  FIFO is the default.
- **Knowledge base (Phase 7)**: a per-user local KB — upload → ingest → extract
  (txt/md via file read, text PDFs via `pypdf`; image-only PDFs reported as
  "Document requires OCR") → deterministic chunking → local embeddings (Ollama
  `/api/embed`, `EMBEDDING_MODEL`) → a JSON-file-per-user `VectorStore` with
  cosine search. Ownership is explicit per user; cross-user access is impossible.
- **document_search tool (Phase 7)**: the ONLY gateway the agent has to the KB
  (it never touches the vector store directly). User scoped via `log_context`;
  returns filename/document_id/page/score and capped chunk text, or
  "No relevant local documents found". Recorded in the execution trace.
- **KB routing (Phase 7)**: an isolated TaskRouter search-intent rule routes
  "search the documents/knowledge..." requests to `general` (the reasoning model
  + document_search tool) instead of the reserved `document` task type.
- **VectorStore/EmbeddingProvider abstractions (Phase 7)**: both behind
  interfaces so the JSON store and Ollama embeddings can be swapped later without
  touching the KB service or agent.
- **Multimodal input handling (Phase 8)**: `document_type_for` now accepts
  `png`/`jpg`/`jpeg`; the upload API detects image-only PDFs (`DocumentRequiresOCR`)
  and image files and routes them through the OCR pipeline. Text-based PDFs keep the
  unchanged Phase 7 text path. OCR text is embedded into the KB too, so
  `document_search` also finds scanned content.
- **DocumentPreparer (Phase 8)**: renders PDF pages to local PNG images via
  `pypdfium2` (page numbers preserved) and normalizes standalone images via
  Pillow (oversized images downscaled to `OCR_MAX_IMAGE_DIMENSION`). Malformed
  PDFs / unreadable pages / unsupported images / rendering failures raise clean
  `DocumentPreparationError`s. Rendered pages live in a per-user/per-job temp dir
  under `MULTIMODAL_TMP_ROOT` and are deleted after success and failure.
- **OCRProvider (Phase 8)**: `OCRProvider` ABC + `RapidOCREngine` (fully local
  RapidOCR/ONNX, lazy engine init, run in a worker thread) producing structured
  `OCRRegion`s (text + bbox + confidence). `FakeOCRProvider` (scripted per page)
  gives deterministic tests. Provider is replaceable later (e.g. PaddleOCR).
- **VisionProvider (Phase 8)**: `VisionProvider` ABC + `OllamaVisionProvider`
  (local multimodal model via Ollama `/api/generate` with a base64 image, model
  name always from the registry — never hardcoded) + `FakeVisionProvider`.
  Provider is independent of the Agent.
- **MultimodalService (Phase 8)**: orchestrates analyze (prepare → OCR → vision
  per page, OCR text passed as optional context to vision) and scanned/image
  ingestion (`ingest_scanned`). Vision-model `resources` flow through the
  `ResourceScheduler` (sub-allocation under `<job_id>:vision`, released in a
  `finally`); the worker also releases sub-allocations on job end. Missing/
  disabled vision model → clean `MultimodalError`.
- **document_vision tool (Phase 8)**: the ONLY gateway the agent has to
  multimodal analysis (never touches vision model, OCR internals, or raw paths).
  User scoped via `log_context`; returns `[OCR]`/`[VISION]`-labelled evidence with
  `document_id`/filename/page so the agent can distinguish OCR, vision, and
  text-KB sources.
- **Logging (Phase 8)**: `ocr_started/completed/failed`,
  `vision_started/completed/failed` events carry only page/provider/model/duration
  metadata — never image contents, OCR text, or vision responses.
- **Health (Phase 8)**: `/health` gains a `multimodal` section (OCR provider,
  vision model configured/enabled/available, resources, subsystem status).
- **Artifact model (Phase 9)**: `Artifact` (artifact_id, job_id, user_id,
  filename, type, path, created_at, size_bytes, status `creating`/`completed`/
  `failed`) + safe `ArtifactSummary` view (no internal path). Artifacts are tied
  to their creating job and user.
- **ArtifactStore (Phase 9)**: `ArtifactStore` ABC + lock-guarded in-memory impl;
  generated files stay on disk inside the job workspace while the store holds
  metadata only — the seam for moving to a database later.
- **DocumentGenerator (Phase 9)**: `DocumentGenerator` ABC + `WordDocumentGenerator`
  (python-docx) converting a structured `DocumentContent` (title, subtitle,
  sections with headings/paragraphs/bullets/numbered/table, sources, footer) into
  a valid `.docx`; deterministic, validated (exists, non-zero, reopens). Excel/PPT
  are reserved future generators behind the same interface.
- **document_generation tool (Phase 9)**: the only gateway the agent has to
  generation. Strict argument validation (type/filename/sections/sources,
  filename path-safety, content size cap). Writes only inside
  `<workspace>/artifacts/` via the existing workspace containment. Registers the
  artifact with the store; on failure marks it `failed` and cleans partial files.
  CPU-only generation requests a small CPU/memory allocation through the
  `ResourceScheduler` under `<job_id>:docgen` (released in a `finally`).
- **Job/API integration (Phase 9)**: `GET /api/jobs/{job_id}` exposes the job's
  `artifacts` (from the store); secure download
  `GET /api/jobs/{job_id}/artifacts/{artifact_id}` verifies job ownership,
  artifact↔job binding, and path containment inside the job workspace before
  serving the file with the correct content type. No generic filesystem endpoint.
- **Logging (Phase 9)**: `document_generation_started/completed/failed`,
  `artifact_created` events carry only type/filename/size/duration/status —
  never document content. `/health` gains a `document_generation` section.
- **Frontend stack (Phase 10)**: Next.js 14 (App Router) + React 18 + TypeScript,
  plain CSS, Vitest + React Testing Library. Single client page — no multiple
  routes. Talks only to the local backend via a typed fetch client
  (`NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:8000`).
- **Backend CORS (Phase 10)**: configurable `cors_origins` (default
  `http://localhost:3000`), local-dev only. This is the only backend change for
  the frontend.
- **Frontend API client** (`frontend/src/lib/api.ts`): typed functions for
  health, jobs (submit/get/list/cancel), documents (list/upload/delete), and
  artifact download (fetch with `X-User-ID`, blob + content-disposition
  filename). Components never scatter raw fetch calls.
- **Polling** (`frontend/src/lib/hooks.ts`): jobs ~1s, lists ~2s, health ~3s;
  polling stops at terminal states, retries on backend errors (reconnect), stops
  on 404, and pauses in hidden tabs. No WebSockets.
- **Sovereignty indicator**: shows only backend-verified facts from `/health`
  (Ollama endpoint + reachability, local-only inference). The backend exposes no
  external-API counter, so the UI explicitly says "not tracked by backend — no
  counter to display" instead of fabricating a number.
- **Dev user selector**: `user-001`…`user-005` via `X-User-ID` (persisted in
  localStorage); no authentication. Backend ownership rules keep users isolated.
- **CI pipeline**: `.github/workflows/ci.yml` runs on every push (all branches)
  and pull request — Backend `pytest` (Python 3.13; docker-marked sandbox tests
  auto-skip; `libgl1`/`libglib2.0-0` installed for opencv/rapidocr) and Frontend
  `typecheck` + `vitest` + `next build` (Node 22). Note: the root `.gitignore`
  `lib/` rule was scoping out `frontend/src/lib/`; it is now scoped to `backend/`
  so the `@/lib` modules are version-controlled.

---

## Current Phase

**Phase 10 — Frontend Workbench & Flagship End-to-End Workflow** (completed)

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

### Phase 4 — Agentic Pipeline & Local Tool Calling
- **Agent** (`app/services/agent.py`): bounded, cancellation-aware local loop —
  decide → (tool) → observe → decide → complete — against the selected model via
  `OllamaService.generate(..., format="json")`. Deterministic termination
  (`max_iterations`, `max_tool_calls`); malformed output and empty responses fail
  cleanly. Records an ordered `execution_trace` (plan/tool_call/tool_result/final)
  plus `agent_stage`/`iteration_count`/`tool_call_count` on the job.
- **Model↔tool protocol**: strict JSON — `{"type":"final","response":...}` or
  `{"type":"tool_call","tool":...,"arguments":{...}}`; plain non-JSON model text
  is treated as a final response. `format: json` added to OllamaService.generate.
- **Tools** (`app/services/tools.py` + `tool_registry.py`): `Tool` ABC (name,
  description, input_schema, execute) with `list_files`, `read_file`, `write_file`.
  `ToolRegistry` validates tool name and argument schema (deny-by-default) and
  never lets a tool failure crash the loop.
- **Workspace isolation** (`app/services/workspace.py`): each job gets
  `data/workspaces/<user>/<job>/` (gitignored). `resolve_within_workspace`
  rejects `..` traversal, absolute paths, and symlink escapes; identifiers are
  sanitized so crafted headers cannot escape the root.
- **Worker integration**: the worker creates the job workspace and runs the Agent,
  then applies its outcome (COMPLETED/FAILED/CANCELLED). A job cancelled while
  running is never resurrected to COMPLETED. `cancel_job` now accepts RUNNING jobs.
- **Job visibility**: `GET /api/jobs/{job_id}` exposes `task_type`, `model`,
  `agent_stage`, `iteration_count`, `tool_call_count`, `execution_trace`, and the
  final `response`.
- **Logging**: added `agent_started`, `agent_completed`, `agent_failed`,
  `agent_cancelled`, `tool_call_started`, `tool_call_completed`,
  `tool_call_failed` events. No prompts, responses, or file contents logged.
- **Tests (104, all passing)**: 40 new — workspace isolation + traversal,
  tool behavior/validation, agent loop (limits, cancellation, trace order, invalid
  tool/args/path), and an end-to-end demo (plan → list → read → write → complete)
  plus running-job cancellation. All 64 Phase 1–3 tests preserved.
- **Live smoke test**: ran against real local Ollama (llama3.1) — a plain job
  completed with `agent_started → plan → final`; a "list files" job made a real
  `list_files` tool call against the job workspace and completed with a useful
  response; trace + agent fields exposed correctly.
- **Deliberately NOT implemented** (out of scope for Phase 4): Docker sandbox,
  code execution, OCR, vision, RAG, vector DB, Word/PPT/Excel generation, GPU/VRAM
  scheduling, frontend, authentication, Redis/Celery/Kafka, external services.

### Phase 5 — Secure Docker Code Execution Sandbox
- **Sandbox runner** (`app/services/sandbox_runner.py`): `SandboxRunner` ABC +
  `DockerSandboxRunner` (docker CLI, no new dependency). Runs generated code ONLY
  in a short-lived container: `--network none`, `--read-only`, `--cap-drop ALL`,
  `--security-opt no-new-privileges`, `--cpus`/`--memory`, strict timeout, only a
  temp code dir mounted `:ro` (never host fs / app workspace / Docker socket).
  `--rm` plus an awaited `docker rm -f` on timeout (no orphaned containers).
  Structured `ExecutionResult` (success/exit_code/stdout/stderr/timed_out/
  duration_ms); clean `SandboxRunnerError` for Docker/image/container failures
  (never auto-pulls images).
- **CodeExecutionTool** (`app/services/tools.py`): registered only when
  `SANDBOX_ENABLED=true`; `language`/`code`/`stdin` args; rejects non-python;
  truncates stdout/stderr to `SANDBOX_MAX_STDOUT/STDERR_CHARS`; returns a
  `ToolResult` whose content lets the agent reason over exit code/duration/output.
- **Logging**: `code_execution_started/completed/failed/timeout/cleanup` with
  job_id/user_id/language/duration/exit_code via a contextvars `log_context` set by
  the agent. Generated source and full output never logged (only short summaries).
- **Config**: `SANDBOX_ENABLED`, `SANDBOX_PYTHON_IMAGE`, `SANDBOX_TIMEOUT_SECONDS`,
  `SANDBOX_CPU_LIMIT`, `SANDBOX_MEMORY_LIMIT`, `SANDBOX_MAX_STDOUT_CHARS`,
  `SANDBOX_MAX_STDERR_CHARS` (env-driven; see `.env.example`).
- **Tests (135, all passing)**: 31 new — `test_sandbox.py` (tool via a scriptable
  fake runner: success/syntax/non-zero/timeout/output limits/stdin/unsupported
  language/malformed args + an exact Docker-invocation security test),
  `test_sandbox_demo.py` (agent calls code_execution; deterministic factorial demo;
  bug-fix loop demo), and `test_sandbox_docker.py` (14 real-sandbox integration
  tests — network blocked, no host fs, no socket, no privileges, timeout/cleanup,
  missing-image clean failure — skipped explicitly via a `docker` marker when the
  daemon/image is unavailable). All 104 Phase 1–4 tests preserved.
- **Live killer test**: ran the real agent + real Ollama + real Docker — the model
  generated Python for factorial(10), `code_execution` ran it (`Exit code 0`),
  the agent observed the result and reported `The factorial of 10 is 3628800.`;
  a second run demonstrated the agent observing failed executions and reasoning
  about the errors. No orphaned containers after any run.
- **Deliberately NOT implemented** (out of scope for Phase 5): multi-language
  execution, GPU/VRAM scheduling, RAG, OCR, vision, Word/PPT/Excel generation,
  frontend, authentication, Redis/Celery/Kafka, cloud execution, model changes
  unrelated to sandbox support.

### Phase 6 — Resource Scheduler & GPU/VRAM Awareness
- **Resource model** (`app/schemas/resources.py`): `ResourceRequirements`
  (cpu_cores/memory_mb/gpu_id/gpu_vram_mb), `ResourceAllocation` (with
  allocated_at), `GpuInfo`, `ResourceCapacity`.
- **ResourceProvider** (`app/services/resource_provider.py`): `ResourceProvider`
  ABC; `InMemoryResourceProvider` (lock-guarded, idempotent, never exceeds
  capacity) for deterministic tests; read-only `LocalResourceProvider` for local
  discovery (CPU count, system memory, optional nvidia-smi GPUs — no NVIDIA
  tooling required for tests).
- **Model requirements**: `ModelConfig.resources` (optional) parsed from
  `config/models.yaml`; `RoutingResult.requirements` carries the selected model's
  declared resources to the scheduler.
- **ResourceScheduler** (`app/services/resource_scheduler.py`):
  `request()` → grant/wait/reject; FIFO waiters (ordered dict) preserve ordering
  (no starvation); `release()` returns capacity and wakes waiters; `cancel()`
  removes a waiting job (never allocates to it); impossible requests (oversized
  vs capacity, unknown GPU, VRAM with no GPU) fail jobs cleanly with a useful
  reason (`Requested 32768 MB VRAM, system capacity is 16384 MB`). Structured
  `resource_requested/waiting/allocated/released/rejected` events.
- **Worker integration**: flow is now queued job → classify → select model →
  determine requirements → scheduler → grant or wait → agent execution; resources
  are released in a `finally` on completion/failure/cancellation/timeout. Job
  gains `resource_status` (`not_required`/`waiting`/`allocated`/`released`/
  `rejected`).
- **Config/capacity**: `RESOURCE_CAPACITY_MODE` (`configured`/`auto`),
  `RESOURCE_CPU_CORES`, `RESOURCE_MEMORY_MB`, `RESOURCE_GPU_VRAM_MB`,
  `RESOURCE_GPU_COUNT`; `main.py` builds capacity, provider, scheduler and exposes
  `scheduler` on app.state + `/health`.
- **Tests (158, all passing)**: 23 new — `test_resources.py` (grant/wait/reject,
  five-user scenario, FIFO, release on completion/failure/cancellation, no
  allocation leaks, zero accounting after finish, model requirements from config,
  unknown-GPU/oversized rejection, local discovery, stats) and
  `test_scheduler_worker.py` (end-to-end allocate→run→release, impossible and
  unknown-GPU jobs fail cleanly, cancelled running job frees resources, health
  scheduler section, models without resources unaffected). All 135 Phase 1–5
  tests preserved.
- **Live smoke test**: ran the real server + Ollama with a temp registry — a
  general job was allocated, ran, completed, and released (`resource_status:
  released`; scheduler allocated VRAM back to 0); a 32 GB document job was
  rejected cleanly with the exact capacity message; `/health` scheduler section
  correct.
- **Deliberately NOT implemented** (out of scope for Phase 6): dynamic GPU model
  loading/unloading, model eviction, batching, speculative decoding, multi-GPU
  execution, distributed inference, Kubernetes, Redis/Celery/Kafka, frontend, RAG,
  OCR, vision, document generation, authentication.

### Phase 7 — Local Document Ingestion & Knowledge Base
- **Document model + ingestion** (`schemas/document.py`, `services/
  document_ingestion.py`): `DocumentRecord` (metadata only) + `ChunkRecord` +
  `SearchResult`. Text extraction for `.txt`/`.md` (direct read) and text PDFs
  (pypdf, per page); image-only PDFs → "Document requires OCR"; malformed PDFs
  fail cleanly. Deterministic order-preserving chunking (configurable size/
  overlap) with stable chunk IDs and page metadata.
- **Embeddings** (`services/embedding.py`): `EmbeddingProvider` ABC;
  `OllamaEmbeddingProvider` uses the local Ollama `/api/embed` (configured model,
  clean error if missing/unreachable). Deterministic `FakeEmbeddingProvider`
  (keyword-overlap) for tests/demos.
- **Vector store** (`services/vector_store.py`): `VectorStore` ABC;
  `JsonVectorStore` persists per-user documents + chunk vectors to
  `data/knowledge/<user>/store.json`, cosine search, delete/list, cross-restart
  persistence, lock-guarded.
- **KnowledgeBase** (`services/knowledge_base.py`): coordinates ingest
  (extract → chunk → embed → store) and search; explicit per-user ownership;
  structured `document_ingestion_started/completed/failed`, `document_deleted`,
  `document_search_started/completed/failed` events (metadata only, never content).
- **document_search tool** (`services/tools.py`): only gateway to the KB; user
  scoped via `log_context`; caps `top_k` and chunk text; returns filename/
  document_id/page/score; "No relevant local documents found" when empty.
- **APIs** (`api/documents.py`): `POST /api/documents` (multipart upload → ingest,
  returns document_id/filename/status), `GET /api/documents`,
  `GET/DELETE /api/documents/{document_id}`. No public search endpoint.
- **KB routing**: isolated TaskRouter search-intent rule (`search/query/look up/
  find ... documents/knowledge/manuals/files`) → `general`, so retrieval requests
  use the reasoning model + document_search instead of the reserved `document`
  task type.
- **Config**: `KNOWLEDGE_BASE_ROOT`, `UPLOADS_ROOT`, `CHUNK_SIZE`, `CHUNK_OVERLAP`,
  `EMBEDDING_MODEL`, `DOCUMENT_SEARCH_DEFAULT/MAX_TOP_K`,
  `DOCUMENT_SEARCH_MAX_CHUNK_CHARS`. Deps: `pypdf`, `python-multipart`
  (`reportlab` for tests).
- **Tests (184, all passing)**: 40 new — ingestion (txt/md/pdf/OCR/malformed),
  chunking determinism/metadata, vector store upsert/search/delete/persistence/
  cross-user isolation, KB + document_search tool (metadata, no-results, limits,
  user context, no-contents-in-logs), document APIs (upload/list/get/delete,
  isolation, no public search), and the synthetic industrial-doc demo (pump
  manual PDF + inspection txt + safety md; agent document_search → grounded
  answer; no-relevant flow). All 144 Phase 1–6 tests preserved.
- **Live demo**: real Ollama (`llama3.1` reasoning + `nomic-embed-text`
  embeddings) — 3 synthetic docs ingested (ready), agent answered the cooling
  water pump inspection question grounded in retrieved chunks (2× document_search,
  3 sources, correct inspection requirements); user-002 saw 0 docs and the agent
  reported "No relevant local documents found".
- **Deliberately NOT implemented** (out of scope for Phase 7): OCR, handwritten
  text recognition, vision models, scanned-document understanding, Word/PPT/Excel
  generation, GPU scheduling changes, multi-GPU, distributed vector databases,
  external services, auth redesign, enterprise RBAC.

### Phase 8 — Local Multimodal Document Understanding (OCR + Vision)
- **Multimodal input support** (`document_ingestion.py`): document types now
  include `png`/`jpg`/`jpeg`; image files and image-only ("scanned") PDFs are
  detected and routed through the OCR pipeline. Text-based PDFs/txt/md keep the
  Phase 7 path (text PDF test explicitly preserved). OCR'd text is chunked,
  embedded, and stored in the same per-user vector store, so `document_search`
  also retrieves scanned content.
- **DocumentPreparer** (`services/document_preparer.py`): renders PDF pages to
  local PNGs via `pypdfium2` (page numbers preserved, configurable scale, page
  cap) and normalizes standalone images via Pillow (oversized → downscaled to
  `OCR_MAX_IMAGE_DIMENSION`). Clean `DocumentPreparationError` for malformed PDF,
  unreadable page, unsupported image, oversized image, out-of-range page, and
  rendering failures. Fully local — no cloud converters / remote APIs.
- **OCRProvider** (`services/ocr_provider.py`): `OCRProvider` ABC with
  `RapidOCREngine` (fully local RapidOCR/ONNX, lazy engine init in a worker
  thread) returning structured `OCRRegion`s (text + `[x1,y1,x2,y2]` bbox +
  confidence) and `FakeOCRProvider` (scripted text per page, `fail_pages`,
  records calls) for deterministic tests. `OCRProviderError` for engine failures.
- **VisionProvider** (`services/vision_provider.py`): `VisionProvider` ABC +
  `OllamaVisionProvider` (local multimodal model via Ollama `/api/generate` with a
  base64 image; model name always from `config/models.yaml` — never hardcoded) +
  `FakeVisionProvider` (scripted observations per page, records calls). Missing/
  unreachable model → `VisionProviderError` → clean tool failure.
- **OllamaService**: added `generate_with_image(prompt, model, image_path)` —
  same local-endpoint-only guarantees and error mapping as `generate`.
- **MultimodalService** (`services/multimodal.py`): coordinates per-page
  prepare → OCR → vision (OCR text passed to vision as optional context per the
  "OCR first, vision when needed" strategy) and `ingest_scanned` (render → OCR →
  `KnowledgeBase.ingest_pages`). Vision-model `resources` are requested through
  the `ResourceScheduler` under `<job_id>:vision` and released in a `finally`;
  impossible requests fail cleanly ("vision resources rejected: …"). Temp page
  images are stored under `MULTIMODAL_TMP_ROOT/<user>/<job>/` and removed after
  success and failure (empty ancestors pruned).
- **document_vision tool** (`services/tools.py`): the only gateway the agent has
  to multimodal analysis. Args `{document_id, question, pages?}`; returns
  `[OCR]`/`[VISION]`-labelled structured evidence with document_id/filename/page.
  Ownership enforced via the per-user KB lookup; ToolRegistry now validates
  `array`-typed arguments.
- **KnowledgeBase**: refactored `ingest_document` (unchanged Phase 7 behavior) +
  new `ingest_pages` (ingest pre-extracted `(page, text)` pairs with metadata).
  Scanned/image docs store `metadata = {"page_count": N, "ocr": true}`.
- **APIs**: `POST /api/documents` accepts images and routes image-only PDFs
  through OCR; text PDFs unchanged. No new public multimodal endpoint (the agent
  remains the primary consumer). `/health` gains a `multimodal` section (OCR
  provider, vision model configured/enabled/available + resources, status).
- **Config**: `OCR_ENABLED`, `OCR_MAX_PAGES`, `OCR_MAX_IMAGE_DIMENSION`,
  `OCR_RENDER_SCALE`, `VISION_MAX_PAGES`, `VISION_RESOURCE_WAIT_ROUNDS`,
  `MULTIMODAL_TMP_ROOT`; `config/models.yaml` vision entry now `llava:7b`,
  `enabled: true`, with declared `resources`. Deps added (already installed in the
  venv): `pillow`, `pypdfium2`, `rapidocr-onnxruntime`.
- **Logging**: `ocr_started/completed/failed`, `vision_started/completed/failed`
  with job_id/user_id/document_id/page/provider/model/duration — metadata only;
  image contents, OCR text, and vision responses never logged (verified by a
  no-contents-in-logs test).
- **Tests (231 passing, 15 skipped)**: 47 new across `test_document_preparer.py`,
  `test_ocr_provider.py`, `test_vision_provider.py`, `test_multimodal.py`,
  `test_multimodal_agent.py`, `test_multimodal_demo.py`, and
  `test_multimodal_integration.py` — covering all 21 Phase 8 test requirements:
  image ingestion, scanned-PDF detection, PDF page rendering, OCR provider
  abstraction/extraction/metadata, vision provider abstraction + model selection,
  missing vision model handling, the document_vision tool, ownership isolation,
  temp-image cleanup (success + failure), cross-user isolation, OCR/vision
  failure handling, vision execution trace, resource-scheduling integration
  (grant+release, rejection), text-PDF Phase 7 path preservation, agent choosing
  document_search for text tasks, document_vision for image questions, both tools
  in a multi-step task, and no image/OCR contents in logs. Real RapidOCR runs
  (`-m rapidocr`); the real-vision smoke test is skipped when no local
  multimodal model exists. All 184 Phase 1–7 tests preserved.
- **Live verification**: real RapidOCR ingested a synthetic scanned inspection
  PDF (embedded image, no text layer) → `ready` (chunked); the real `llama3.1`
  agent answered a retrieval question grounded in the OCR'd content (4×
  `document_search`, correct findings); `/health` multimodal section reported
  rapidocr enabled and `llava:7b` configured-but-not-present (available: false).
  A real vision smoke test is included but skipped on this machine because no
  multimodal model is currently pulled into Ollama.
- **Deliberately NOT implemented** (out of scope for Phase 8): Word/Excel/
  PowerPoint generation, approval-note generation, the final report workflow,
  handwriting-specialized model training, P&ID-specific symbolic reasoning,
  dynamic model loading, distributed inference, frontend, auth redesign, external
  services, and real-OCR-language tuning.

### Phase 9 — Office Deliverable Generation (Word)
- **Artifact model** (`schemas/artifact.py`): `Artifact` (artifact_id, job_id,
  user_id, filename, type, path, created_at, size_bytes, status
  `creating`/`completed`/`failed`) plus `ArtifactSummary` (safe API view — no
  internal path). Artifacts are always associated with their creating job and user.
- **ArtifactStore** (`services/artifact_store.py`): `ArtifactStore` ABC +
  `InMemoryArtifactStore` (lock-guarded, per-job listing, update, delete, stats).
  Generated files remain on disk inside the job workspace; the store keeps
  metadata only — the seam for moving persistence to a database later.
- **DocumentGenerator** (`services/document_generator.py`): `DocumentGenerator`
  ABC + `WordDocumentGenerator` using **python-docx**. Converts a structured
  `DocumentContent` (title, subtitle, sections with headings/paragraphs/bullets/
  numbered/table, a Sources numbered section, and a static footer) into a valid
  `.docx`. Deterministic; output is validated (exists, size > 0, reopens with
  `python-docx`) before success. Excel/PowerPoint are reserved future generators.
- **Structured content** (`schemas/document_content.py`): `DocumentSection`
  (heading, paragraphs, bullets, numbered, table) + `DocumentContent`
  (document_type, title, subtitle, sections, sources) + `GeneratedDocument`. The
  agent never emits formatting instructions — only this structured representation.
- **document_generation tool** (`services/tools.py`): the only gateway the agent
  has to generation. Args `{type, filename, title, document_type?, sections[],
  sources[]?}`. Strict validation rejects unsupported types, unsafe filenames
  (path separators/`..`/wrong extension), malformed sections, and oversized
  content (>200k chars). Writes only under `<workspace>/artifacts/` via the
  existing `resolve_within_workspace` containment. Registers an artifact, runs
  the generator, updates to `completed` with real `size_bytes`, returns metadata;
  on failure marks the artifact `failed`, cleans partial files, and returns a
  controlled `ToolError`. CPU-only generation requests a small CPU/memory
  allocation through the `ResourceScheduler` (`<job_id>:docgen`, released in a
  `finally`; impossible requests fail cleanly).
- **Job/API integration**: `Job.artifacts` field populated by the jobs API from
  the ArtifactStore (`GET /api/jobs/{job_id}` shows artifacts). New secure
  download `GET /api/jobs/{job_id}/artifacts/{artifact_id}` verifies job
  ownership, artifact↔job binding, path containment inside the job workspace, and
  file existence before serving with
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
  No generic filesystem download endpoint.
- **Health/status**: `/health` gains `document_generation` (`available`, `word`,
  artifact store stats).
- **Config/deps**: no new runtime config; added `python-docx==1.2.0` to
  requirements.txt (installed locally).
- **Logging**: `document_generation_started/completed/failed` and `artifact_created`
  events log only type/filename/size/duration/status — never document content
  (verified by a no-sensitive-content-in-logs test).
- **Tests (274 passing, 15 skipped)**: 43 new across `test_document_generator.py`,
  `test_artifact_store.py`, `test_document_generation_tool.py`,
  `test_artifact_api.py`, `test_document_generation_agent.py`, and
  `test_approval_note_demo.py` — covering Word generation (headings, paragraphs,
  bullets, numbered lists, tables, sources, footer, validity, determinism),
  artifact registration/metadata, invalid filename/traversal rejection, cross-user
  isolation, download ownership/containment, generation-failure cleanup, `.docx`
  validity, the agent tool + execution-trace generation step, source metadata
  preservation, no sensitive content in logs, and the synthetic approval-note
  workflow. All 231 Phase 1–8 tests preserved (document_search, document_vision,
  sandbox, resource scheduling unchanged).
- **Live verification**: real RapidOCR ingested a synthetic scanned inspection
  PDF; the real `llama3.1` agent ran `document_search` + `document_generation`
  and produced a real `approval_note.docx` (37 KB) listed on the completed job and
  downloaded through the secure endpoint (opened/parsed with python-docx). The
  agent also demonstrated clean recovery when it attempted `document_vision`
  without a local vision model. (Note: llama3.1 intermittently fails to emit the
  large nested `document_generation` JSON and may loop/return empty finals — the
  tool validation and agent error handling contain this; deterministic tests use
  scripted valid calls.)
- **Deliberately NOT implemented** (out of scope for Phase 9): Excel generation,
  PowerPoint generation, PDF generation, document templates marketplace, OCR/
  vision/RAG changes, GPU scheduling changes, auth redesign, external services,
  cloud storage, generic file browser, artifact retention/lifecycle system
  (partial files are cleaned on failure; completed artifacts persist in the job
  workspace with no cleanup policy yet).

### Phase 10 — Frontend Workbench & Flagship End-to-End Workflow
- **Frontend** (`frontend/`, Next.js 14 App Router + React 18 + TypeScript): a
  single-page local workbench with a clean component architecture (AppShell,
  Sidebar/JobList/JobCard, ChatPanel, TaskStatus, ExecutionTrace/ToolCall,
  ResourcePanel/ModelStatus, DocumentList/UploadPanel, ArtifactList,
  SovereigntyStatus, UserSelector, StatusBadge). Layout: header + 3-column grid
  (jobs/documents sidebar, main task+trace+artifacts, system/sovereignty panel),
  responsive to a laptop screen.
- **Typed API client** (`src/lib/api.ts` + `src/lib/types.ts`): TypeScript
  interfaces mirror the backend schemas; typed functions for health, jobs
  (submit/get/list/cancel), documents (list/upload/delete with FormData), and
  secure artifact download (fetch + `X-User-ID`, returns blob + filename).
  `ApiError` surfaces backend `detail.message`; unreachable backend → friendly
  "Backend unreachable".
- **Polling hooks** (`src/lib/hooks.ts`): `usePolling` + `useJob`/`useJobs`/
  `useHealth`/`useDocuments`. Job polling stops at terminal states (1s), lists
  poll at 2s, health at 3s, retry-on-error for reconnect, stop-on-404, hidden-tab
  pause. `useActiveUser` persists the dev user in localStorage.
- **Sovereignty indicator**: shows only backend-verified facts — Ollama endpoint
  + reachability, local-only inference, model counts; explicitly states the
  backend exposes no external-API counter (no fabricated "0 external calls").
- **Flagship workflow UX**: upload scanned report + maintenance procedure under
  Documents, submit the approval-note prompt, watch QUEUED → RUNNING → COMPLETED,
  the agent trace (document_search → document_vision → document_generation), the
  answer, and the downloadable `approval_note.docx`. Nothing is hardcoded — the
  UI renders whatever the backend does.
- **Accessibility/UX**: text labels on status badges (never color-only),
  keyboard-accessible buttons/selects, focus-visible outlines, clear error
  alerts, no decorative animation.
- **Backend change**: configurable `CORS_ORIGINS` (default `http://localhost:3000`)
  via `fastapi.middleware.cors` — the only backend change; no redesign.
- **Tests**: backend 290 passing (incl. 2 new CORS tests; Docker up so sandbox
  integration tests ran; 1 vision smoke skipped — no multimodal model). Frontend
  **31 Vitest tests** (backend fully mocked) covering job submission,
  queued/running/completed/failed states, execution-trace rendering, model +
  resource info, document list, artifact list + download, per-user isolation,
  backend error handling, polling termination, and the flagship workflow. `tsc
  --noEmit` and `next build` both pass.
- **Live verification**: ran backend (temp config mapping general→`llama3.1`)
  + `next start` together — frontend served at :3000, `/health` reachable with
  `Access-Control-Allow-Origin: http://localhost:3000`; a live flagship run
  through the exact endpoints the UI uses: real RapidOCR ingested the scanned
  report, the real agent used `document_search` (+ `document_vision` attempt that
  failed cleanly with no vision model, from which it recovered) +
  `document_generation`, producing a downloadable `pump_approval_note.docx`
  (37 KB) parsed successfully (title, Findings, Required Actions, Sources).
- **Deliberately NOT implemented** (out of scope for Phase 10): authentication,
  RBAC, new AI models, new tools, OCR/vision/RAG/sandbox changes, Excel/
  PowerPoint, dynamic model loading, backend rewrite, external services, WebSockets,
  real-time streaming, and an external-API telemetry counter (backend doesn't
  expose one).

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
│   │   │   ├── job.py             Job, JobStatus, JobSubmitResponse, JobSummary (+ artifacts)
│   │   │   ├── resources.py       ResourceRequirements/Allocation, GpuInfo, Capacity
│   │   │   ├── document.py        DocumentRecord, ChunkRecord, SearchResult
│   │   │   ├── artifact.py        Artifact, ArtifactSummary, ArtifactStatus (Phase 9)
│   │   │   ├── document_content.py DocumentSection/Content, GeneratedDocument (Phase 9)
│   │   │   └── multimodal.py      OCRRegion/OCRPageResult, VisionPageResult, PageEvidence, VisionAnalysisResult
│   │   ├── services/
│   │   │   ├── ollama_service.py  OllamaService async client + typed errors + generate_with_image
│   │   │   ├── job_store.py       JobStore ABC + InMemoryJobStore
│   │   │   ├── job_manager.py     JobManager (lifecycle + ownership)
│   │   │   ├── job_queue.py       FIFO async job queue
│   │   │   ├── worker.py          background worker (dequeue → classify → route → schedule → agent)
│   │   │   ├── model_registry.py  ModelRegistry (validates config/models.yaml)
│   │   │   ├── task_router.py     TaskRouter (deterministic classification + KB search intent)
│   │   │   ├── model_router.py    ModelRouter (task_type → enabled model)
│   │   │   ├── workspace.py       WorkspaceManager + safe path resolution
│   │   │   ├── log_context.py     contextvars job context for tool logging
│   │   │   ├── sandbox_runner.py  SandboxRunner ABC + DockerSandboxRunner (Phase 5)
│   │   │   ├── artifact_store.py  ArtifactStore ABC + InMemoryArtifactStore (Phase 9)
│   │   │   ├── document_generator.py DocumentGenerator ABC + WordDocumentGenerator (Phase 9)
│   │   │   ├── document_preparer.py  PDF page rendering (pypdfium2) + image prep (Pillow) (Phase 8)
│   │   │   ├── ocr_provider.py    OCRProvider ABC + RapidOCREngine + FakeOCRProvider (Phase 8)
│   │   │   ├── vision_provider.py VisionProvider ABC + OllamaVisionProvider + FakeVisionProvider (Phase 8)
│   │   │   ├── multimodal.py      MultimodalService (OCR+vision pipeline, scheduler integration) (Phase 8)
│   │   │   ├── tools.py           Tool ABC + list/read/write + code_execution + document_search + document_vision + document_generation
│   │   │   ├── tool_registry.py   ToolRegistry (deny-by-default validation)
│   │   │   ├── agent.py           Agent (bounded loop, trace, cancellation)
│   │   │   ├── resource_provider.py  ResourceProvider ABC + in-memory + local discovery
│   │   │   ├── resource_scheduler.py ResourceScheduler (grant/wait/reject, FIFO)
│   │   │   ├── document_ingestion.py text extraction + deterministic chunking (now incl. image types)
│   │   │   ├── embedding.py       EmbeddingProvider ABC + OllamaEmbeddingProvider
│   │   │   ├── vector_store.py    VectorStore ABC + JsonVectorStore
│   │   │   └── knowledge_base.py  KnowledgeBase (ingest/search/delete, per-user) + ingest_pages
│   │   └── api/
│   │       ├── deps.py            get_user_id (X-User-ID header dependency)
│   │       ├── chat.py            POST /api/chat (enqueue job)
│   │       ├── jobs.py            GET/DELETE /api/jobs, GET /api/jobs/{job_id} (+ artifacts), artifact download
│   │       ├── documents.py       POST/GET/DELETE /api/documents (+ image/scanned-PDF OCR routing)
│   │       └── health.py          GET /health (Ollama + models + queue + scheduler + KB + multimodal + docgen + worker)
│   └── tests/
│       ├── conftest.py            fixtures, mocks, FakeEmbeddingProvider, FakeOCR/FakeVision, pdf/image helpers, wait_for_job
│       ├── test_ollama_service.py 8 tests (direct service unit tests)
│       ├── test_chat.py           7 tests
│       ├── test_health.py         3 tests
│       ├── test_jobs.py           8 tests
│       ├── test_worker.py         5 tests
│       ├── test_concurrency.py    2 tests (5-user + FIFO ordering)
│       ├── test_task_router.py    10 tests (classification rules)
│       ├── test_model_router.py   11 tests (selection, registry validation)
│       ├── test_routing.py        9 tests (end-to-end job routing)
│       ├── test_workspace.py      12 tests (isolation + traversal)
│       ├── test_tools.py          14 tests (tool behavior + validation)
│       ├── test_agent.py          12 tests (agent loop + cancellation)
│       ├── test_agent_demo.py     2 tests (demo + running-job cancellation)
│       ├── test_sandbox.py        14 tests (code_execution + docker invocation)
│       ├── test_sandbox_demo.py   3 tests (factorial + bug-fix-loop demos)
│       ├── test_sandbox_docker.py 14 tests (docker-marked integration tests)
│       ├── test_resources.py      19 tests (scheduler + provider + five-user scenario)
│       ├── test_scheduler_worker.py 6 tests (worker + scheduler integration)
│       ├── test_ingestion.py      11 tests (extraction + chunking)
│       ├── test_vector_store.py   7 tests (upsert/search/delete/persistence/isolation)
│       ├── test_knowledge.py      10 tests (KB + document_search tool + logs)
│       ├── test_documents_api.py  11 tests (document APIs + isolation)
│       ├── test_knowledge_demo.py 2 tests (synthetic industrial demo + no-results)
│       ├── test_document_preparer.py 11 tests (PDF rendering, image prep, clean failures) (Phase 8)
│       ├── test_ocr_provider.py   5 tests (fake + real RapidOCR) (Phase 8)
│       ├── test_vision_provider.py 8 tests (fake + Ollama vision mapping) (Phase 8)
│       ├── test_multimodal.py     20 tests (ingestion, tool, isolation, cleanup, scheduling, logs, health) (Phase 8)
│       ├── test_multimodal_agent.py 3 tests (document_search vs document_vision + multi-step) (Phase 8)
│       ├── test_multimodal_demo.py 1 test (synthetic industrial comparison) (Phase 8)
│       ├── test_multimodal_integration.py 2 tests (real RapidOCR + real vision smoke) (Phase 8)
│       ├── test_document_generator.py 10 tests (Word generation: title/headings/paragraphs/bullets/numbered/tables/sources/footer/validity) (Phase 9)
│       ├── test_artifact_store.py 7 tests (create/get/update/list/delete/stats/summary) (Phase 9)
│       ├── test_document_generation_tool.py 15 tests (validation, isolation, cleanup, scheduling, logs) (Phase 9)
│       ├── test_artifact_api.py 9 tests (job artifacts, secure download, ownership, containment, health) (Phase 9)
│       ├── test_document_generation_agent.py 2 tests (agent tool + trace + download) (Phase 9)
│       └── test_approval_note_demo.py 1 test (synthetic approval-note workflow) (Phase 9)
├── frontend/                      Next.js + React + TypeScript workbench (Phase 10)
│   ├── package.json               next/react/typescript + vitest/RTL dev deps
│   ├── next.config.mjs, tsconfig.json, vitest.config.ts
│   └── src/
│       ├── app/
│       │   ├── layout.tsx         root layout (metadata)
│       │   ├── page.tsx           single-page workbench (client component)
│       │   └── globals.css        layout/panel/badge/table/trace styles
│       ├── components/
│       │   ├── AppShell.tsx       header + 3-column grid
│       │   ├── JobList.tsx / JobCard, ChatPanel, TaskStatus
│       │   ├── ExecutionTrace.tsx (incl. ToolCall rendering, content hidden)
│       │   ├── ResourcePanel.tsx / ModelStatus.tsx
│       │   ├── DocumentList.tsx / UploadPanel.tsx
│       │   ├── ArtifactList.tsx / SovereigntyStatus.tsx
│       │   ├── UserSelector.tsx / StatusBadge.tsx / ActiveJobPanel.tsx
│       │   └── components.test.tsx, workbench.test.tsx   (Vitest)
│       ├── lib/
│       │   ├── api.ts             typed API client (health/jobs/documents/artifacts)
│       │   ├── types.ts           TS interfaces mirroring backend schemas
│       │   ├── hooks.ts           polling hooks + useActiveUser
│       │   └── api.test.ts, hooks.test.tsx
│       └── test-utils/factory.ts  fixtures + fetch mock helpers
├── config/
│   └── models.yaml                task type → local model registry (incl. vision=llava:7b + resources)
├── data/
│   ├── uploads/                   (empty — user uploads, gitignored)
│   ├── outputs/                   (empty — generated deliverables, gitignored)
│   ├── knowledge/                 (empty — local knowledge base, gitignored)
│   ├── tmp/                       (empty — rendered page images, cleaned, gitignored)
│   └── workspaces/                (per-job agent workspaces, gitignored)
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
- Agent tool-calling depends on the local model emitting the strict JSON protocol
  (prompted via `format: json`); models that ignore the format degrade to a
  plain-text final response (no tool use) rather than failing.
- `code_execution` supports only `python` and requires `SANDBOX_ENABLED=true`
  plus a locally available Docker image; sandbox failures (Docker down, missing
  image) fail jobs cleanly but a job's success still depends on the model emitting
  valid code inside the JSON protocol (llama3.1 sometimes produced syntax errors —
  the agent observed and handled them).
- Resource capacity is **config-declared** (the model's declared requirements are
  authoritative — no automatic VRAM estimation); `RESOURCE_CAPACITY_MODE=auto`
  discovery is informational only. With the single worker, one allocation is
  active at a time, so multi-job concurrency is enforced at the scheduler's
  accounting layer and verified via scheduler unit tests, not concurrent worker
  execution.
- Priority is stored on the job model but **priority scheduling is not
  implemented** — the scheduler is FIFO by default (structured for future
  priority/creation-time/resource ordering).
- The knowledge base supports **text-based documents** (PDF with text layer,
  txt, md) through the Phase 7 path and **scanned/image-only documents** (image
  PDFs, png/jpg/jpeg) through the Phase 8 OCR pipeline; OCR text is indexed so
  `document_search` retrieves scanned content too. A PDF with no text layer AND
  no OCR-able content still fails cleanly with "Document requires OCR". "No
  relevant local documents found" is reported when a user's knowledge base has
  no matching chunks. The vector store is a per-user JSON file (simple +
  persistent); a real vector DB can be swapped in behind `VectorStore`.
- **OCR quality** depends on the local RapidOCR engine; accuracy on dense
  tables/handwriting is limited (no handwritten-text training in this phase).
  **Vision** requires a local multimodal model in Ollama. The default
  `config/models.yaml` configures `llava:7b`, which is NOT currently pulled on
  the dev machine — the real-vision smoke test and live `document_vision` use are
  skipped/fail cleanly until `ollama pull llava:7b` (or the config is edited);
  `document_vision` tool calls fail cleanly with a clear message. Nothing is
  auto-downloaded.
- Tool results feed the model prompt; a `read_file` observation is capped at
  ~4000 chars to bound prompt growth. Workspaces accumulate under
  `data/workspaces/` (gitignored); no automatic cleanup/retention yet — a
  documented age-based cleanup command exists (`python -m
  app.services.data_cleanup --yes`, see `docs/CLEANUP.md`), and deleting an old
  workspace also removes its artifacts. Rendered page images under `data/tmp/`
  are cleaned after success and failure.
- **Document generation** is limited to Word (.docx) in this phase (Excel/PPT
  reserved). Generated artifacts persist in the job workspace's `artifacts/`
  directory with **no retention/cleanup policy yet** (partial files are cleaned
  on failure; completed artifacts remain accessible after the job finishes —
  this is the documented current behavior). The ArtifactStore is in-memory
  (metadata lost on restart; files remain on disk) — the seam for a database
  later. Real agent-driven generation depends on the local model emitting the
  large nested `document_generation` JSON: llama3.1 sometimes emits invalid or
  incomplete arguments (the tool rejects them and the agent recovers) or returns
  empty finals/loops — deterministic tests use scripted valid calls, and a more
  capable local reasoning model produces more reliable tool calls.
- **Frontend** (Phase 10): no real-time streaming (polling-based); the dev user
  selector is a stand-in for authentication (backend `X-User-ID`); the
  sovereignty indicator cannot display an "external API calls" count because the
  backend exposes no such metric (shown as "not tracked"). `npm audit` reports
  Next.js server-side advisories (DoS/cache/middleware) that require external
  network access to the server — not applicable to this localhost-only demo.
  The frontend requires the backend's CORS allow-list to include its origin
  (default `http://localhost:3000`).
- `logs/backend.log` is generated at import time (module-level `app = create_app()`);
  it is gitignored so this is harmless.
- Repository is a git repo (branch `main`) tracking `origin` at
  `https://github.com/Chirag-agg/AstraSovereign.git`.

---

## Next Steps

1. **Recommended next phase — Phase 11: Excel & PowerPoint Deliverable Generation.**
   Add `.xlsx` (e.g. inspection readings/tables) and `.pptx` (e.g. inspection
   summary slide deck) generators behind the existing `DocumentGenerator`
   interface, with secure download and frontend artifact rendering for the new
   types. **Do not start until explicitly requested.**
2. Other candidate phases (do not start early): durable job/artifact stores
   (Redis/Postgres behind `JobStore`/`ArtifactStore`); audit-log schema for "all
   major actions logged"; enterprise organization-wide knowledge base with access
   control; multi-language code sandbox; real-time streaming/WebSocket job
   updates; an external-API telemetry counter on the backend (would let the
   sovereignty indicator show a verified "0 external calls").
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
- **Phase 4 (2026-08-29)**: Added the agentic pipeline — a bounded, cancellation-aware
  Agent loop (strict JSON tool-calling protocol with plain-text fallback), a
  deny-by-default ToolRegistry with `list_files`/`read_file`/`write_file`, per-job
  workspace isolation (`data/workspaces/<user>/<job>/`), and an ordered execution
  trace exposed through the job API. Worker runs the agent after routing; cancel now
  stops running jobs. 104 tests incl. the end-to-end demo; live smoke test verified a
  real `list_files` tool call against real Ollama.
- **Phase 5 (2026-08-29)**: Added the secure Docker code-execution sandbox — a
  `code_execution` tool (registered only when `SANDBOX_ENABLED=true`) that runs
  generated Python ONLY inside an isolated container (`--network none`, no
  privileges, read-only root, resource limits, strict timeout, temp code dir only,
  guaranteed cleanup). Structured `code_execution_*` logging; 135 tests incl. 14
  real-Docker integration tests and deterministic factorial + bug-fix demos. Live
  killer test: real agent + Ollama + Docker ran factorial(10) (exit 0) and reported
  3628800; network-blocked and no-host-fs confirmed.
- **Phase 6 (2026-08-29)**: Added the resource scheduler — typed resource models,
  a `ResourceProvider` (in-memory + read-only local discovery), model-declared
  `resources` in `config/models.yaml`, and a FIFO `ResourceScheduler`
  (grant/wait/reject, clean release on completion/failure/cancellation/timeout,
  impossible/unknown-GPU jobs fail cleanly). Worker flow is now queue → classify →
  select model → schedule → agent. `/health` reports scheduler state; jobs expose
  `resource_status`. 158 tests incl. the five-user scheduling scenario; live smoke
  test verified allocate→run→release and the exact 32 GB reject message.
- **Phase 7 (2026-08-29)**: Added the local document knowledge base — ingestion
  (txt/md/text-PDF; scanned PDFs → "requires OCR"), deterministic chunking, local
  Ollama embeddings, a per-user persistent JSON vector store with cosine search, a
  `document_search` tool (the only gateway for the agent), and document APIs. The
  agent answers retrieval-grounded questions with source metadata. 184 tests incl.
  the synthetic industrial-doc demo; live demo with `llama3.1` + `nomic-embed-text`
  produced a grounded pump-inspection answer and confirmed cross-user isolation.
- **Phase 8 (2026-08-31)**: Added local multimodal document understanding —
  image-only PDF detection + png/jpg/jpeg support, a `DocumentPreparer`
  (pypdfium2 page rendering + Pillow image normalization, temp-file cleanup after
  success/failure), an `OCRProvider` abstraction with the fully local RapidOCR
  engine, a `VisionProvider` abstraction backed by the registry-configured local
  multimodal model (Ollama, default `llava:7b`), a `MultimodalService` that runs
  prepare → OCR → vision per page with OCR text as context and routes the vision
  model's declared resources through the `ResourceScheduler`, and a
  `document_vision` tool (the agent's only gateway to multimodal analysis) that
  returns `[OCR]`/`[VISION]`-labelled evidence. Scanned/image docs are OCR-indexed
  into the KB so `document_search` also finds them. `/health` gains a `multimodal`
  section. 231 tests incl. the synthetic industrial comparison demo and real
  RapidOCR integration; live smoke: real RapidOCR + real `llama3.1` agent answered
  a retrieval question grounded in OCR'd scanned-PDF content. Vision smoke test
  skipped until a multimodal model is pulled into Ollama.
- **Phase 9 (2026-08-31)**: Added office deliverable generation (Word first) —
  a `DocumentGenerator` abstraction with `WordDocumentGenerator` (python-docx)
  converting structured `DocumentContent` (title, headings, paragraphs, bullets,
  numbered lists, tables, sources, footer) into valid `.docx` files; an
  `Artifact` model + `ArtifactStore` (in-memory metadata, files stay in the job
  workspace); a `document_generation` tool (strict validation, workspace
  containment, failure cleanup, CPU/memory scheduled through the
  `ResourceScheduler`); job `artifacts` exposure and a secure download endpoint
  (`GET /api/jobs/{job_id}/artifacts/{artifact_id}` with ownership + containment
  checks); and a `document_generation` health section. 274 tests incl. the
  synthetic approval-note workflow; live verification: real RapidOCR + real
  `llama3.1` produced a downloadable `approval_note.docx` (37 KB) via
  `document_search` → `document_generation`.
- **Phase 10 (2026-08-31)**: Added the frontend workbench — a single-page
  Next.js + React + TypeScript client that operates the backend: typed API
  client, polling hooks (terminal-stop/reconnect/hidden-tab pause), components
  for jobs/trace/resources/documents/artifacts/sovereignty, a dev user selector
  (`user-001`…`user-005`), and the flagship approval-note workflow UI (nothing
  hardcoded). Backend gained configurable CORS (`CORS_ORIGINS`) as the only
  backend change. 290 backend tests + 31 frontend Vitest tests (mocked backend);
  `tsc --noEmit` and `next build` pass. Live: backend + `next start` ran
  together with CORS verified; a live flagship run produced a downloadable
  `pump_approval_note.docx` (37 KB) via the exact endpoints the UI uses.
- **Phase 10 follow-up (2026-09-01)**: Added the CI pipeline
  (`.github/workflows/ci.yml`) — backend `pytest` + frontend typecheck/vitest/
  build run on every push and PR (green verified). Fixed a repo-level gitignore
  bug where the bare `lib/` rule silently excluded `frontend/src/lib/` from
  version control (now scoped to `backend/`).
- **Phase 10 follow-up (2026-09-01)**: Community/ops hardening — `CONTRIBUTING.md`
  + issue/PR templates (issue #7), `docs/ONBOARDING.md` developer runbook
  (issue #8), and an age-based local data cleanup tool + policy
  (`backend/app/services/data_cleanup.py`, CLI via `python -m
  app.services.data_cleanup`, `docs/CLEANUP.md`, 7 tests; issue #9). Enabled SSH
  commit signing (dedicated `sovereign_signing` ed25519 key; registration of the
  signing key on the GitHub account is required before commits show "Verified").
