# CONTEXT.md â€” Persistent Project Memory

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
  Config comes from environment variables / `.env` only â€” no hardcoded URLs or model names.
- **Model runtime (decided in Phase 1)**: **Ollama** is the Phase 1 local model runtime.
  It is installed and running on the dev machine (`http://localhost:11434`) with models
  `llava:7b`, `qwen2.5:7b`, `qwen2.5-coder:7b`, `llama3:latest`. vLLM / local HF remain
  candidates for future evaluation.
- **Frontend stack undecided** â€” to be decided in a later phase (no code written yet).
- **Config-first model selection**: Routing rules will live in `config/` (not implemented
  yet; Phase 1 uses a single `DEFAULT_MODEL`).
- **Structured (JSON) logging**: implemented in Phase 1 via a stdlib `JsonFormatter`
  writing to console and `logs/backend.log`. Audit-logging schema for the broader
  "all major actions logged" requirement still to be defined.
- **App structure**: `create_app()` factory + `app.state` service injection; the
  `ollama_transport` seam lets tests mock Ollama via `httpx.MockTransport`.
- **Job architecture (Phase 2)**: every request becomes a persistent job
  (`job_id` + typed state machine) processed by a single background worker.
  Flow: `HTTP â†’ JobManager â†’ FIFO queue â†’ Worker â†’ OllamaService â†’ local model`.
- **JobManager / store (Phase 2)**: a `JobStore` interface (in-memory impl, guarded
  by an `asyncio.Lock`) is the seam for swapping in Redis/Postgres later. All
  ownership checks live in the JobManager so API routes can never leak another
  user's job.
- **Worker (Phase 2)**: one `asyncio` task dequeues jobs serially (one active
  Ollama request at a time, FIFO). Reuses the Phase 1 `OllamaService` unchanged;
  Ollama failures surface as job `failed` state with a useful `error`, not HTTP errors.
- **User identity (Phase 2)**: `X-User-ID` header dependency with `user-001` dev
  fallback; no authentication yet â€” the dependency is the future auth seam.
- **Job states**: `queued`, `running`, `completed`, `failed`, `cancelled`.
  Priority is stored on the job model but priority scheduling is not implemented.
- **Model registry (Phase 3)**: `config/models.yaml` maps task types to local
  models (`provider`, `model`, `enabled`, `capabilities`). Model names come only
  from config; adding a model is a config change. `ModelRegistry` validates the
  file (fails fast on malformed config) and reports per-task-type availability.
- **Task router (Phase 3)**: deterministic, rule-based classification
  (`general`, `coding`, `document`, `vision`) â€” no LLM is used to classify.
  Rules are ordered and isolated for easy extension.
- **Model router (Phase 3)**: maps a classified `task_type` â†’ configured **enabled**
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
- **Agent (Phase 4)**: after routing, a controlled loop runs each job â€”
  decide â†’ (tool) â†’ observe â†’ decide â†’ complete. Termination is deterministic
  (`MAX_AGENT_ITERATIONS`=10, `MAX_AGENT_TOOL_CALLS`=20); the agent checks job
  cancellation between iterations and before tools, and records a serializable
  `execution_trace` plus `agent_stage`/`iteration_count`/`tool_call_count` on the job.
- **Modelâ†”tool protocol (Phase 4)**: strict JSON via Ollama `format: json` â€”
  `{"type":"final"|"tool_call",...}`; non-JSON model output is treated as a plain
  final response. Tool name/args/paths are validated before any execution.
- **Tools (Phase 4)**: `Tool` ABC + deny-by-default `ToolRegistry` with
  `list_files`, `read_file`, `write_file`. Future tools plug in without changing
  the agent loop.
- **Workspace isolation (Phase 4)**: each job gets `data/workspaces/<user>/<job>/`;
  identifiers are sanitized and `resolve_within_workspace` rejects `..` traversal,
  absolute paths, and symlink escapes â€” tools cannot reach other users' workspaces
  or arbitrary filesystem paths.
- **Cancellation (Phase 4)**: `cancel_job` now accepts QUEUED **and** RUNNING jobs;
  the worker/agent observe the state change and stop as soon as practical.
- **Code-execution sandbox (Phase 5)**: `code_execution` tool runs generated Python
  ONLY inside a short-lived Docker container (`docker run --network none --read-only
  --cap-drop ALL --security-opt no-new-privileges --cpus/--memory limits`), a strict
  timeout, and only a temp code dir mounted `:ro` â€” never the host fs, app workspace,
  or Docker socket. Container removed via `--rm` + awaited `docker rm -f` on timeout
  (no orphans). Registered only when `SANDBOX_ENABLED=true` (deny-by-default).
- **SandboxRunner abstraction (Phase 5)**: injectable `SandboxRunner` (Docker CLI
  impl + fake in tests); `build_args()` is unit-tested for the exact secure invocation.
- **Sandbox config (Phase 5)**: enabled/image/timeout/cpu/memory/stdout/stderr limits
  from env; the image must already exist locally and is never auto-pulled; Docker or
  image unavailability fails the job cleanly (`SandboxRunnerError` â†’ `ToolError`).
- **Tool logging context (Phase 5)**: `log_context` (contextvars) lets tools log
  `code_execution_started/completed/failed/timeout/cleanup` with job_id/user_id;
  generated source and full output are never logged.
- **Resource scheduler (Phase 6)**: between routing and execution, a
  `ResourceScheduler` decides grant/wait/reject based on the selected model's
  declared `resources` and the in-memory `ResourceProvider` capacity. FIFO waiters
  (no starvation); impossible requests (oversized vs capacity, unknown GPU) fail
  jobs cleanly; resources released on completion/failure/cancellation/timeout.
  Single worker â†’ one active allocation, so multi-job concurrency is enforced at
  the accounting layer and exercised by scheduler unit tests (five-user scenario).
- **Resource provider (Phase 6)**: `ResourceProvider` abstraction (in-memory impl
  for deterministic tests; read-only `LocalResourceProvider` for informational
  CPU/memory/GPU discovery via `RESOURCE_CAPACITY_MODE=auto` â€” never requires
  NVIDIA tooling, never loads/unloads models).
- **Capacity config (Phase 6)**: `RESOURCE_CPU_CORES`, `RESOURCE_MEMORY_MB`,
  `RESOURCE_GPU_VRAM_MB`, `RESOURCE_GPU_COUNT`; models declare `resources`
  (`gpu_vram_mb`/`cpu_cores`/`memory_mb`/`gpu_id`) in `config/models.yaml`.
  Priority remains on the job model but priority scheduling is not implemented;
  FIFO is the default.
- **Knowledge base (Phase 7)**: a per-user local KB â€” upload â†’ ingest â†’ extract
  (txt/md via file read, text PDFs via `pypdf`; image-only PDFs reported as
  "Document requires OCR") â†’ deterministic chunking â†’ local embeddings (Ollama
  `/api/embed`, `EMBEDDING_MODEL`) â†’ a JSON-file-per-user `VectorStore` with
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
  name always from the registry â€” never hardcoded) + `FakeVisionProvider`.
  Provider is independent of the Agent.
- **MultimodalService (Phase 8)**: orchestrates analyze (prepare â†’ OCR â†’ vision
  per page, OCR text passed as optional context to vision) and scanned/image
  ingestion (`ingest_scanned`). Vision-model `resources` flow through the
  `ResourceScheduler` (sub-allocation under `<job_id>:vision`, released in a
  `finally`); the worker also releases sub-allocations on job end. Missing/
  disabled vision model â†’ clean `MultimodalError`.
- **document_vision tool (Phase 8)**: the ONLY gateway the agent has to
  multimodal analysis (never touches vision model, OCR internals, or raw paths).
  User scoped via `log_context`; returns `[OCR]`/`[VISION]`-labelled evidence with
  `document_id`/filename/page so the agent can distinguish OCR, vision, and
  text-KB sources.
- **Logging (Phase 8)**: `ocr_started/completed/failed`,
  `vision_started/completed/failed` events carry only page/provider/model/duration
  metadata â€” never image contents, OCR text, or vision responses.
- **Health (Phase 8)**: `/health` gains a `multimodal` section (OCR provider,
  vision model configured/enabled/available, resources, subsystem status).
- **Artifact model (Phase 9)**: `Artifact` (artifact_id, job_id, user_id,
  filename, type, path, created_at, size_bytes, status `creating`/`completed`/
  `failed`) + safe `ArtifactSummary` view (no internal path). Artifacts are tied
  to their creating job and user.
- **ArtifactStore (Phase 9)**: `ArtifactStore` ABC + lock-guarded in-memory impl;
  generated files stay on disk inside the job workspace while the store holds
  metadata only â€” the seam for moving to a database later.
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
  artifactâ†”job binding, and path containment inside the job workspace before
  serving the file with the correct content type. No generic filesystem endpoint.
- **Logging (Phase 9)**: `document_generation_started/completed/failed`,
  `artifact_created` events carry only type/filename/size/duration/status â€”
  never document content. `/health` gains a `document_generation` section.
- **Frontend stack (Phase 10)**: Next.js 14 (App Router) + React 18 + TypeScript,
  plain CSS, Vitest + React Testing Library. Single client page â€” no multiple
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
  external-API counter, so the UI explicitly says "not tracked by backend â€” no
  counter to display" instead of fabricating a number.
- **Dev user selector**: `user-001`â€¦`user-005` via `X-User-ID` (persisted in
  localStorage); no authentication. Backend ownership rules keep users isolated.
- **CI pipeline**: `.github/workflows/ci.yml` runs on every push (all branches)
  and pull request â€” Backend `pytest` (Python 3.13; docker-marked sandbox tests
  auto-skip; `libgl1`/`libglib2.0-0` installed for opencv/rapidocr) and Frontend
  `typecheck` + `vitest` + `next build` (Node 22). Note: the root `.gitignore`
  `lib/` rule was scoping out `frontend/src/lib/`; it is now scoped to `backend/`
  so the `@/lib` modules are version-controlled.
- **Audit model + store (Phase 11)**: `AuditEvent` (event_id, timestamp,
  event_type, component, status, job_id, user_id, metadata) â€” never prompts,
  responses, document contents, OCR/vision text, code, or secrets. `JsonlAuditStore`
  is append-only JSONL under `AUDIT_ROOT` (default `data/audit/`), concurrent-safe,
  restart-persistent, with a logâ†’audit handler that reuses existing structured
  `event` log calls (no duplicated business logic).
- **Audit events (Phase 11)**: JOB_CREATED/STARTED/COMPLETED/FAILED,
  MODEL_SELECTED, MODEL_CALL_STARTED/COMPLETED (agent + embeddings + vision),
  TOOL_CALL_*, DOCUMENT_INGESTION_*, DOCUMENT_SEARCH_*, OCR_*, VISION_*,
  SANDBOX_* (code_execution), DOCUMENT_GENERATION_*, RESOURCE_ALLOCATED/RELEASED.
- **NetworkGuard (Phase 11)**: classifies outbound HTTP as LOCAL (loopback +
  configured Ollama host) vs EXTERNAL; blocks external by default
  (`ExternalNetworkBlocked`), recording blocked attempts. All Ollama/embedding/
  vision clients go through `GuardedTransport`. onnxruntime telemetry disabled
  (`ORT_TELEMETRY_ENABLED=0`).
- **Sovereignty status (Phase 11)**: `build_sovereignty_status` derives real
  values only â€” `local_model_calls` from MODEL_CALL_COMPLETED audit count,
  `external_connections.{status,count,blocked_attempts}` from the guard
  (VERIFIED_LOCAL/VERIFIED_EXTERNAL/UNKNOWN; UNKNOWN until traffic observed, so
  nothing is fabricated), `audit_logging`, `sandbox_network: DISABLED`. Exposed
  via `/api/sovereignty` and `/health.sovereignty`.
- **Audit API (Phase 11)**: `GET /api/audit` (user-scoped via X-User-ID, optional
  `job_id`, pagination) and `GET /api/jobs/{job_id}/audit` (ownership enforced).
  No generic log-file download endpoint.
- **Frontend evidence (Phase 11)**: SovereigntyStatus shows network policy,
  external-traffic status, audit-logging, local model calls, sandbox network;
  JobAuditTimeline renders the user-scoped backend audit trail for the selected
  job (polled until terminal).
- **Conversation-first UX (Phase 11 UX redesign)**: the frontend is a
  Claude/Cowork-inspired workbench â€” a left sidebar (New task / Chats /
  Documents / Artifacts / System), a conversation-centred main column (user +
  assistant messages, markdown rendering, readable errors, inline artifact
  cards), a large bottom Composer (attach chips, send/cancel), and a
  terminal-like **Work Console** derived ONLY from real `execution_trace`
  (planning, `$ tool` commands, running/completed/failed states, TASK COMPLETED)
  that auto-opens while the agent works. System/sovereignty facts moved to a
  secondary drawer. Dark-first design system; responsive (sidebar collapses).
- **Backend micro-additions for the UX (documented)**: `ArtifactSummary` now
  carries `job_id`; `GET /api/artifacts` lists the caller's artifacts across
  jobs; `JobSummary` now carries `message` (chat titles). No other backend
  behavior changed.
- **Organizational User + Admin (Phase 11 UX)**: two clearly separated
  experiences on one platform. `/` is the conversation-first **User workspace**
  (chats/documents/artifacts, Work Console, composer â€” no infrastructure
  metrics). `/admin[/section]` is the **Admin/operations console** (Overview,
  Workloads, Users, Models, Resources, Knowledge, Audit, Sovereignty, System) fed
  by new dev-only `/api/admin/*` endpoints that return aggregate operational
  metadata only (never user messages/responses/document contents).
- **Dev role model**: a `useDevRole()` user/admin switch (localStorage,
  clearly labelled dev-only) chooses which UI/APIs the browser uses. NOT
  authentication/RBAC â€” the backend independently enforces the admin boundary via
  the `X-Role: admin` header; a real identity layer must replace both later.
  Platform administration and confidential content access remain separate
  concepts (admins get operational metadata, not private content).

---

## Current State

Implemented and working locally (backend + frontend + local models + Docker):

- Jobs, queue, single worker, cancellation, per-user isolation, admin ops API.
- Config-driven routing and a multi-model pipeline (reasoning, math, coding,
  document, vision, presentation).
- Agent tool runtime: `list_files`/`read_file`/`write_file`, `document_search`
  (local RAG), `document_vision` (RapidOCR + Ollama vision), `code_execution`
  (isolated Docker sandbox), `document_generation` (Word), `presentation_generation`
  (PptxGenJS). See `README.md` for the full surface.
- Resource scheduler, ArtifactStore + secure downloads, NetworkGuard + sovereignty
  reporting, append-only audit, per-user knowledge base, Cowork projects with a
  persistent context manager.
- Frontend: Landing + unified workbench at `/`, project IDE at `/cowork`,
  operations console at `/admin`. The legacy `/preview` UI was removed.
- Tests: backend `pytest` (374 passed) and frontend typecheck + 63 tests + build.
- SQLite job updates are flat: 200 status updates measured at ~0.27 ms/update with
  1 job and ~0.25 ms/update with 200 jobs (0.93x) - the old full-table rewrite is
  gone.

Phase-by-phase history is in `docs/HISTORY.md`.

---

## Known Issues

- **Model mapping (current):** text tasks (`general`, `document`, `coding`) use
  `qwen2.5-coder:3b`; `vision` uses `llava:7b`; embeddings use
  `nomic-embed-text`. `qwen3:1.7b` is NOT usable: it returns an empty JSON object
  for the agent protocol, so jobs hit the iteration limit. `llama3.1:latest` is
  available as a larger fallback if needed.
- **No availability-aware routing for undeclared entries:** a configured but
  unpulled model without a `fallback_to` chain fails the job at the model call
  (`OllamaModelNotFoundError`); startup preflight and the Models UI warn about it.
- **Fallback (implemented):** each entry may declare a bounded `fallback_to` chain
  (max 2 hops). Chains are validated at load - every target must satisfy the
  entry's declared capabilities and support tool calling, with no cycles or
  self-reference - and an invalid chain refuses startup. Fallback follows only the
  declared chain, never an arbitrary model; substitutions are recorded on the
  `RoutingDecision` (`requested_model`, `effective`, `candidates`,
  `fallback_active`), emitted as a `MODEL_FALLBACK` audit event (requested,
  actual, reason `model_unavailable`), shown in `/health.models_resolved` and the
  Models UI, and reported by startup preflight. `MODEL_FALLBACK_ENABLED` (default
  true) disables it; `bench/` forces it off. The shipped `models.yaml` declares
  chains but the pulled models mean **zero active fallbacks** at preflight.
- **Demo checklist:** run preflight before the finale and confirm zero active
  fallbacks; fallback is disaster insurance, not the state to demo in.
- **Sandbox (hardened):** Docker-only; the host-subprocess fallback was removed.
  `--pids-limit 128`; defaults `timeout 30s` / `memory 512m`; exit 137 reports
  "Execution exceeded the memory limit". The image `workbench-sandbox:py312`
  (numpy, pandas, openpyxl, pytest) must exist locally and be shipped offline
  (see `docs/OFFLINE_BUNDLE.md`).
- **Stores are durable SQLite** (`data/astra.db`, WAL, `busy_timeout=5000`):
  `SqliteJobStore`, `SqliteArtifactStore`, and a hash-chained `SqliteAuditStore`.
  Legacy JSON/JSONL data was migrated with
  `python -m app.services.import_legacy`; `GET /api/audit/verify` reports the
  chain status. The `InMemory*` stores remain only as pure test doubles.
- **Known latency wrinkle:** the audit store uses its own connection, so a
  synchronous `append()` on the event loop can wait behind a job/artifact write
  for up to `busy_timeout` (5s). WAL writes are sub-millisecond, so this is not
  expected to matter at demo scale. If event-loop stalls are ever observed, the
  fix is to queue audit appends off the loop rather than writing them inline.
- Single worker, FIFO, no priority scheduling. Task classification is
  keyword-based and may misclassify ambiguous prose.
- **Excel deliverable generation and `.xlsx` ingestion are not implemented.** Word
  and PowerPoint generation exist; the sandbox image already includes
  pandas/openpyxl.
- **Network proof is application-layer only** (`NetworkGuard`); there is no
  OS-level packet capture.
- Frontend polls (no streaming); the dev role switch is not authentication; and
  artifacts are user-scoped (a document generated as `admin-001` is not visible to
  `user-001`).
- OCR/vision accuracy on dense tables, handwriting, and drawings is limited.
- Workspace retention is manual (`docs/CLEANUP.md`); `logs/backend.log` is
  gitignored.

---

## Next Steps

1. Policy engine: classification-gated routing that filters the `RoutingDecision`
   candidate set before fallback (fallback must never select around a denial).
2. Excel: `.xlsx` generation, spreadsheet read/compute, and `.xlsx` ingestion.
3. A live network/egress monitor in the UI to make the zero-egress claim visible.
4. A guided demo runner and a router-decision card.
5. Benchmark suite (runs with `MODEL_FALLBACK_ENABLED=false`) scoring routing
   effectiveness against an always-largest-model baseline.
6. Keep `CONTEXT.md` current; move any new history to `docs/HISTORY.md`.