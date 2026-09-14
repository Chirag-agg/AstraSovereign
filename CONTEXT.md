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
- **Offline Node vendoring**: the presentation renderer's full PptxGenJS
  dependency closure is committed under `presentation/node_modules` (pinned
  exactly `4.0.1`) so a fresh air-gapped checkout renders decks with no npm
  registry. `presentation/scripts/install-offline.cjs` verifies the closure
  offline; `docs/OFFLINE_BUNDLE.md` was validated from an index-only export with
  no `npm install`. A `node`-marked test runs the real `render.cjs` and *fails*
  (not skips) if the vendored tree is missing.
- **Presentation geometry + notes**: `render.cjs` derives every content block
  from `SLIDE_W=13.33`/`MARGIN=0.6` (`CONTENT_W=12.13`), so nothing is hardcoded
  for a narrower template (the previous `w: 9.3` left ~26% dead space on
  `LAYOUT_WIDE`). `SlideContent.notes` carries speaker notes through to
  PowerPoint `notesSlide` parts. A `node`-marked test asserts the widest text
  shape spans at least 85% of the actual slide width.
- **Document generator dispatch**: `DocumentGenerationTool` holds a
  `{type: generator}` map (`word`, `excel`) selected by the `type` argument, so
  the frozen `DocumentGenerator.generate()` signature is unchanged. Passing
  `generator=` still works for single-generator tests.
- **Approval notes (docx)**: an optional `approval` object (reference number,
  date, originator, department, subject, background, recommendation, and
  `signatures[]`) on `document_generation` triggers a formal layout: metadata
  table, background, then the findings sections, then recommendation and the
  signature block. Word documents are A4 and carry a footer of optional
  `classification` plus live "Page X of Y" fields (the old hardcoded marketing
  footer was removed). Without `approval` the generic report layout is unchanged.
- **Document images**: `DocumentSection.images` (`DocumentImage {path, caption,
  width_inches}`). The tool resolves every path with `resolve_within_workspace`
  and rejects absolute/traversal/absent paths and non-png/jpg/jpeg before
  generation; `add_picture()` embeds the image with an optional italic caption.
- **Excel generator**: `XlsxDocumentGenerator` (openpyxl) writes one worksheet
  per section table, treats `=`-prefixed cells as real formulas, preserves
  leading-zero IDs as text, formats measured values and numeric formulas to
  `0.0`, freezes the header row, sizes columns, gives the sources sheet a
  "Reference" header, fixes workbook timestamps for determinism, and validates by
  reopening. Artifact type `excel`, download media type `spreadsheetml.sheet`,
  preview reads cells.
- **One findings object → all deliverables (binding constraint)**: the agent
  must produce a single structured findings object (readings + limits, with
  margins and statuses computed once in code) and every generator must render
  that same object. No generator may restate a verdict. This exists because the
  first manual pass authored three separate payloads and they disagreed: the same
  reading (Course 3, 11.2 mm vs a 12.0 mm limit) was "Monitor" in the docx,
  "FAIL" in the xlsx and omitted from the pptx. Week 5's scan → findings →
  approval-note chain must build the findings object first and feed all three
  deliverables from it, with a verifier test that asserts docx/xlsx/pptx verdicts
  match.
- **xlsx formula caching (do not "fix" with LibreOffice)**: openpyxl writes
  formula strings with no cached result, so `data_only=True` returns `None`. The
  artifact preview deliberately reads `data_only=False` and shows the formula
  text, which is honest. Do not add headless LibreOffice or any recalculation
  dependency to populate cached values — it is heavyweight on an air-gapped box
  for a cosmetic gain.
- **Job context in the workbench UI (2026-09-13)**: the composer attaches
  documents explicitly — a knowledge-base picker plus uploads auto-selected by
  default — with a **"Use all documents"** toggle that expands to every ready
  document at submit. The sent message shows the job's `document_ids`, so the
  context that entered the model stays visible (the sovereignty-story asset).
  Empty selection means no retrieval: job-scoped and honest, with the toggle as
  the explicit route to whole-KB search. `submitChat` sends `document_ids`.
- **Per-node routing + reservation (2026-09-14)**: the node sequence is the only
  routing. Each node resolves its capability model through `CapabilityRouter`
  (declared `fallback_to` chains plus a `general` floor for disabled/unavailable
  capabilities, emitting `MODEL_FALLBACK`); all node models resolve at sequence
  start, and the scheduler reservation is held across consecutive nodes that
  share a model and released only on change (no per-node thrash). `TaskRouter`
  and `ModelRouter` are deleted; the worker only classifies `task_type`, which
  `compute` uses as its precondition.
- **Extraction artifact + `read_document` (2026-09-14)**: ingestion persists one
  per-document extraction artifact (ordered elements with page/bbox/type/
  `confidence` — null when the backend exposes none — plus a markdown rendering)
  under `data/extractions/<user>/`. The `read_document` tool serves that markdown
  within a token budget, and the extract node's attachment input carries each
  attached document's markdown whole when it fits the per-doc/total budget, so a
  document is read end to end without depending on the model to call the tool.
  Docling will implement the same extractor seam and add real table/section
  element types.
- **`submit_findings` (2026-09-14)**: extract's typed exit is a terminal tool
  whose schema is `FindingsObject`; the node completes only when it is accepted.
  This is the native-tool-calling replacement for asking a model to emit JSON in
  free text (the pattern removed with the hand-rolled envelope).

---

## Current State

Implemented and working locally (backend + frontend + local models + Docker):

- Jobs, queue, single worker, cancellation, per-user isolation, admin ops API.
- Config-driven routing and a typed agent node sequence (extract -> retrieve ->
  compute -> draft) spanning the document, coding, and general models.
- Agent tool runtime: `list_files`/`read_file`/`write_file`, `document_search`
  (local RAG), `read_document` (whole-document extraction markup), `document_vision`
  (RapidOCR + Ollama vision), `code_execution`
  (isolated Docker sandbox), `document_generation` (Word `.docx` + Excel `.xlsx`,
  formal approval notes with signature blocks, workspace images),
  `presentation_generation` (PptxGenJS). See `README.md` for the full surface.
- Resource scheduler, ArtifactStore + secure downloads, NetworkGuard + sovereignty
  reporting, append-only audit, per-user knowledge base, Cowork projects with a
  persistent context manager.
- Frontend: Landing + unified workbench at `/`, project cowork IDE at `/cowork`,
  operations console at `/admin`. The legacy `/preview` UI was removed.
- Offline deck generation is self-contained: the full PptxGenJS dependency
  closure is vendored under `presentation/node_modules` (pinned `4.0.1`) and the
  real `render.cjs` is covered by a `node`-marked integration test; see
  `docs/OFFLINE_BUNDLE.md`.
- Tests: backend `pytest` (466 passed) and frontend typecheck + 67 tests + build.
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
- **Bench determinism (2026-09-13):** `BENCH_MODE=true` forces temperature `0`
  and a fixed seed on every generation call (text and vision) via `OllamaService`
  options; production keeps sampling. `bench/.env.example` sets it alongside
  `MODEL_FALLBACK_ENABLED=false`. Re-baseline with it on — a benchmark with
  multi-point run-to-run spread cannot detect a real improvement.
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
- **Excel generation is implemented**: `.xlsx` via openpyxl with real `=`
  formulas, one worksheet per section table, sources sheet, and deterministic
  output. Word now also supports formal approval notes (reference/date/originator/
  department/subject/background/recommendation + signature block) and
  workspace-contained images (`add_picture`). **Spreadsheet read/compute and
  `.xlsx` ingestion are still not implemented**; the sandbox image already
  includes pandas/openpyxl.
- **Hard Scenario 01 baseline (2026-09-12): 3/20, not finale-ready.** The API 653
  Tank 204 fitness-for-service scenario lives in `tests/hard_scenario_01/`
  (fixtures, `verify.py`, `run_scenario.py`, `make_golden.py`) and records to
  `bench/results/`. First run: the job used only the `general` model (no vision,
  document or coding model), read none of the readings or nameplate geometry,
  cited the superseded SOP-09 **Rev 2** alongside Rev 3, invented `10 mm/year`
  corrosion rates, and produced one of three deliverables (no xlsx, no pptx). The
  automatic fail was not tripped (Course 5 was never mentioned) but the same class
  of fabrication appeared on other courses. Full failure list:
  `bench/results/*_hard_scenario_01_findings.md`. `constants.py` is provisional and
  must be validated against the real MRPL standard before scores are trusted.
  **First properly-wired run (2026-09-13):** `run_scenario.py` now passes
  `document_ids` and records per-node capability/model/confidence/runner-up/
  iterations/tool-calls/outcome (same shape as `run_nodes_direct.py`). Queue and
  direct agree on every wiring field; the score is **1-6/20 across runs** because
  the model is inconsistent — in the failing runs `extract` never reads
  `inspection_report_2026.pdf` and degrades, so `compute` and the
  three-deliverable `draft` skip. High variance means multiple runs per
  configuration are required for the December series.
- **Network proof is application-layer only** (`NetworkGuard`); there is no
  OS-level packet capture.
- Frontend polls (no streaming); the dev role switch is not authentication; and
  artifacts are user-scoped (a document generated as `admin-001` is not visible to
  `user-001`).
- OCR/vision accuracy on dense tables, handwriting, and drawings is limited.
- Workspace retention is manual (`docs/CLEANUP.md`); `logs/backend.log` is
  gitignored.
- **Routing is semantic and per-node (2026-09-14).** The keyword `TaskRouter` and
  the task-type `ModelRouter` are retired. A job's `task_type` comes from the
  nearest-exemplar `SemanticCapabilityClassifier` (held-out 15/17 at 0.55; see
  `bench/classifier_eval.py`); every node resolves its own capability model via
  `CapabilityRouter`, which absorbs the declared `fallback_to` chains and floors
  to `general` when a capability is disabled or unavailable, recording a
  `MODEL_FALLBACK` event. Resource reservation moved into the node sequence: all
  node models resolve up front and the scheduler hold is kept across consecutive
  same-model nodes, released only on change. The fifth and last recorded keyword
  miss (2026-09-13, the cowork turn) now routes to `coding`.
- **`extract` has no intent signal.** Its precondition is structural
  ("attachments present"), so it runs on *every* attachment job — including
  retrieval and Q&A tasks — and wastes an iteration and a model call before
  degrading (no typed findings). The classifier now exists and is wired, but
  `extract`'s precondition is still structural; gating it on a document-intent
  signal is the remaining use of the same capability work.
- **`extract` emits typed output via a tool (2026-09-14).** The node no longer
  asks the model to write JSON. `submit_findings` is a tool in extract's set whose
  schema is `FindingsObject`, and it is **terminal**: the node completes only when
  that call is accepted (the agent steers the model back if it answers prose, and
  a final without the call degrades with `submit_findings was not called`). A
  malformed object returns as a tool error the model can correct. An ambiguous
  cell (two candidate values) is carried as `candidates_mm` and the assessment
  refers it (`REFER_AMBIGUOUS_READING`) instead of silently picking a value. With
  the data gap (read_document + whole-document injection) and the output gap both
  closed, the deterministic scenario completes with extract submitting findings
  (2/20, previously 1/20 or a failed job); what remains is findings quality and
  rendering, not structure.
- **Ollama call timeout can fail a job (2026-09-14).** A single slow generation
  on CPU exceeded the default 120 s `OLLAMA_TIMEOUT_SECONDS` and failed the job
  mid-sequence. Benchmark runs use a larger value; raise it (or cap generation)
  for the finale, and keep `BENCH_MODE`/pre-ingest in the demo checklist.
- **Docling chosen for table extraction (2026-09-14).** Spike: `docling==2.127.0`
  (torch 2.14 CPU) runs fully offline (`HF_HUB_OFFLINE=1` + dead proxy) once
  `docling-project/docling-models` (342 MB) and `docling-project/docling-layout-heron`
  (164 MB) are vendored; it returns the page-1 table **with headers** and keeps
  the struck + handwritten C5 values (`10.4 11.6`, remark `re-shot`). Caveats:
  (a) its default OCR is RapidOCR (torch) and fetched `.pth` models from
  **ModelScope** — point it at the existing `rapidocr-onnxruntime` instead
  (a second external host otherwise); (b) it exposes provenance (page/bbox) but
  **no per-element confidence**, so the escalation gate needs a fallback signal
  (e.g. a multi-token cell = ambiguous → human review); (c) ~62 s/page on CPU, so
  pre-ingest fixtures before the finale (demo checklist) and measure layout vs
  table-structure cost before optimising.
- **Docling OCR moved to ONNX (2026-09-14).** `RapidOcrOptions(backend="onnxruntime")`
  removes the torch RapidOCR engine and the **ModelScope** host entirely; the
  4-page fixture drops from ~249 s to ~100 s (2.5x) and passes the dead-proxy
  offline test. The ONNX models are the ones already shipped with RapidOCR.
- **GLM-OCR bake-off (2026-09-14): Docling wins.** `zai-org/GLM-OCR` (VLM,
  `GlmOcrForConditionalGeneration`, 2.66 GB) run model-only via transformers,
  offline + dead proxy, `Table Recognition:` on page 1: returns an HTML table
  with headers, but on the struck + handwritten C5 it silently emits `10.4` and
  **drops the handwritten `11.6`** (the unsafe pick). No per-element confidence,
  ~98 s/page CPU (~4x Docling per page), and **no layout stage** — the HF weights
  are recognition only and PP-DocLayout-V3 ships in the official SDK; Ollama
  serves the model only and no GGUF is present locally. Keep Docling.
- **The `/cowork` composer still cannot attach documents (2026-09-13).** The
  main workbench composer now sends `document_ids`, but `coworkChat` posts only
  `{project_id, message}` and `CoworkChatRequest` has no `document_ids`, so
  project jobs always run with an empty job-scoped manifest.
- **Run backend tests with the project venv.** The exact invocation, from
  `backend/`, is `.\.venv\Scripts\python.exe -m pytest`; from the repo root,
  `backend\.venv\Scripts\python.exe -m pytest`. A global interpreter lacks
  `python-docx`, which shows up as ~2 Word-generation test failures rather than
  an import error. `tests/conftest.py` now raises a clear `UsageError` in that
  case; CI installs the deps into the runner interpreter and sets `CI`, so the
  guard skips there.

---

## Next Steps

1. Ingestion week, in this order (derived from the Hard Scenario 01 failure list):
   a. **Extraction/vision first**: route scanned reports and the nameplate to
      `document_vision` (or a findings extractor) and ground every number in
      OCR/vision output; define the ingest → findings contract.
   b. **Retrieval ranking second**: record supersession at ingestion and never
      surface or cite a superseded revision when the current one exists.
   c. **Grounded computation and planning third**: one findings object → sandbox
      calculation → all three deliverables; reject ungrounded numbers.
2. Policy engine: classification-gated routing that filters the `RoutingDecision`
   candidate set before fallback (fallback must never select around a denial).
3. Excel: spreadsheet read/compute and `.xlsx` ingestion.
4. Live network/egress monitor in the UI; guided demo runner and router-decision
   card; benchmark suite expansion.
5. Generalise the Hard Scenario auto-fail ("no invented number") to every course.
6. Keep `CONTEXT.md` current; move any new history to `docs/HISTORY.md`.