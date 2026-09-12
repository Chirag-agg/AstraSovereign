# Project History

Phase-by-phase build log moved out of `CONTEXT.md` so the current-state file stays small and cheap to read each session. This is reference material only; `CONTEXT.md` is authoritative for the current state.

---

## Completed Work

### Phase 0 â€” Project Foundation
- Created empty `backend/`, `frontend/`, `config/`, `logs/`, `docker/` directories.
- Created `data/` with `uploads/`, `outputs/`, `knowledge/` subdirectories.
- Created `CONTEXT.md` (this file) as persistent project memory.
- Created `README.md` with project overview and high-level goals.
- Created `.gitignore` for Python, Node.js, env files, logs, uploads, outputs, and
  model/data artifacts.
- **Deliberately NOT implemented** (Phase 0 scope): backend, frontend, AI models,
  model router, agents, RAG, OCR, Docker sandbox, Office generation, logging system.
- Repository is not yet a git repo (no `git init` run). Initialized later if requested.

### Phase 1 â€” Local Backend & Model Connection
- **Implemented** a minimal FastAPI backend that communicates **only** with the local
  Ollama server (`OLLAMA_BASE_URL`). No external AI APIs, no telemetry.
- Endpoints:
  - `GET /health` â€” backend liveness + Ollama reachability + model list + default model.
  - `POST /api/chat` â€” accepts `{"message": ...}`, forwards to Ollama
    `/api/generate` with `stream: false`, returns
    `{"response": ..., "model": ..., "status": "success"}`.
- **Config via env / `.env` only** (`backend/.env.example`): `OLLAMA_BASE_URL`,
  `DEFAULT_MODEL`, `HOST`, `PORT`, `OLLAMA_TIMEOUT_SECONDS`, `LOG_LEVEL`, `LOG_FILE`.
  No hardcoded URLs or model names in code.
- **Structured JSON logging** (stdlib `JsonFormatter` to console + `logs/backend.log`):
  startup (logs Ollama destination + default model), chat request received (message
  length only â€” full prompt NOT logged), Ollama request start, success, and failure.
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

### Phase 2 â€” Job Manager & Multi-User Queue
- **Job model** (`app/schemas/job.py`): typed `Job` with `job_id`, `user_id`,
  `message`, `task_type`, `status`, `priority`, `created_at`, `started_at`,
  `completed_at`, `model`, `response`, `error`. States: `queued`, `running`,
  `completed`, `failed`, `cancelled`.
- **JobStore abstraction** (`app/services/job_store.py`): `JobStore` ABC +
  `InMemoryJobStore` (asyncio.Lock-guarded dict) â€” the swap-in seam for Redis/
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
  verified submitâ†’queuedâ†’completed lifecycle, 403 cross-user access, per-user
  listing, and health job stats.
- **Repository**: initialized as a git repo (branch `main`) and pushed to
  `https://github.com/Chirag-agg/AstraSovereign` (git identity: Chirag-agg /
  ca.aggarwal2006@gmail.com).
- **Deliberately NOT implemented** (out of scope for Phase 2): GPU scheduler, VRAM
  management, model auto-routing, agent loop, tool calling, RAG, OCR, vision, code
  sandbox, frontend, authentication, Redis/Celery/Kafka/Postgres.

### Phase 3 â€” Model Router & Config-Driven Model Selection
- **Model registry** (`config/models.yaml` + `app/services/model_registry.py`):
  task type â†’ model mapping (`provider`, `model`, `enabled`, `capabilities`).
  `ModelRegistry.from_file()` validates the YAML and fails fast on malformed
  config (`ModelConfigError`); `availability()` reports per-task-type
  configured/enabled/available flags from the live Ollama model set.
- **TaskRouter** (`app/services/task_router.py`): deterministic keyword/rule
  classification into `general` / `coding` / `document` / `vision` with a
  `reason`; no LLM used to classify. Rules are ordered and isolated.
- **ModelRouter** (`app/services/model_router.py`): `resolve(task_type, reason)`
  â†’ `RoutingResult{task_type, provider, model, reason}`; raises
  `ModelRoutingError` when a task type has no configured or enabled model â€” no
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
  `GET /api/jobs/{job_id}` and `GET /api/jobs` â€” clients can see which model
  handled their job.
- **Tests (64, all passing)**: 30 new tests â€” TaskRouter classification,
  ModelRouter/ModelRegistry (selection, disabled/missing failure, availability,
  YAML validation), and end-to-end routing (generalâ†’general model,
  codingâ†’coding model, code snippetâ†’coding, two jobs â†’ two models, disabled /
  missing-config / unavailable-model clean failures, listing exposes
  task_type/model). All 34 Phase 1/2 tests preserved.
- **Live smoke test**: ran against real local Ollama with a temp registry
  (generalâ†’`llama3.1:latest`, codingâ†’`llama3:latest`); verified general routing,
  coding routing, and the disabled-model clean failure; `/health` model
  availability correct.
- **Deliberately NOT implemented** (out of scope for Phase 3): frontend, GPU
  scheduling, VRAM management, dynamic model loading, agent loop, tool calling,
  RAG, OCR, vision processing, document generation, Docker sandbox, authentication,
  Redis/Celery/external APIs.

### Phase 4 â€” Agentic Pipeline & Local Tool Calling
- **Agent** (`app/services/agent.py`): bounded, cancellation-aware local loop â€”
  decide â†’ (tool) â†’ observe â†’ decide â†’ complete â€” against the selected model via
  `OllamaService.generate(..., format="json")`. Deterministic termination
  (`max_iterations`, `max_tool_calls`); malformed output and empty responses fail
  cleanly. Records an ordered `execution_trace` (plan/tool_call/tool_result/final)
  plus `agent_stage`/`iteration_count`/`tool_call_count` on the job.
- **Modelâ†”tool protocol**: strict JSON â€” `{"type":"final","response":...}` or
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
- **Tests (104, all passing)**: 40 new â€” workspace isolation + traversal,
  tool behavior/validation, agent loop (limits, cancellation, trace order, invalid
  tool/args/path), and an end-to-end demo (plan â†’ list â†’ read â†’ write â†’ complete)
  plus running-job cancellation. All 64 Phase 1â€“3 tests preserved.
- **Live smoke test**: ran against real local Ollama (llama3.1) â€” a plain job
  completed with `agent_started â†’ plan â†’ final`; a "list files" job made a real
  `list_files` tool call against the job workspace and completed with a useful
  response; trace + agent fields exposed correctly.
- **Deliberately NOT implemented** (out of scope for Phase 4): Docker sandbox,
  code execution, OCR, vision, RAG, vector DB, Word/PPT/Excel generation, GPU/VRAM
  scheduling, frontend, authentication, Redis/Celery/Kafka, external services.

### Phase 5 â€” Secure Docker Code Execution Sandbox
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
- **Tests (135, all passing)**: 31 new â€” `test_sandbox.py` (tool via a scriptable
  fake runner: success/syntax/non-zero/timeout/output limits/stdin/unsupported
  language/malformed args + an exact Docker-invocation security test),
  `test_sandbox_demo.py` (agent calls code_execution; deterministic factorial demo;
  bug-fix loop demo), and `test_sandbox_docker.py` (14 real-sandbox integration
  tests â€” network blocked, no host fs, no socket, no privileges, timeout/cleanup,
  missing-image clean failure â€” skipped explicitly via a `docker` marker when the
  daemon/image is unavailable). All 104 Phase 1â€“4 tests preserved.
- **Live killer test**: ran the real agent + real Ollama + real Docker â€” the model
  generated Python for factorial(10), `code_execution` ran it (`Exit code 0`),
  the agent observed the result and reported `The factorial of 10 is 3628800.`;
  a second run demonstrated the agent observing failed executions and reasoning
  about the errors. No orphaned containers after any run.
- **Deliberately NOT implemented** (out of scope for Phase 5): multi-language
  execution, GPU/VRAM scheduling, RAG, OCR, vision, Word/PPT/Excel generation,
  frontend, authentication, Redis/Celery/Kafka, cloud execution, model changes
  unrelated to sandbox support.

### Phase 6 â€” Resource Scheduler & GPU/VRAM Awareness
- **Resource model** (`app/schemas/resources.py`): `ResourceRequirements`
  (cpu_cores/memory_mb/gpu_id/gpu_vram_mb), `ResourceAllocation` (with
  allocated_at), `GpuInfo`, `ResourceCapacity`.
- **ResourceProvider** (`app/services/resource_provider.py`): `ResourceProvider`
  ABC; `InMemoryResourceProvider` (lock-guarded, idempotent, never exceeds
  capacity) for deterministic tests; read-only `LocalResourceProvider` for local
  discovery (CPU count, system memory, optional nvidia-smi GPUs â€” no NVIDIA
  tooling required for tests).
- **Model requirements**: `ModelConfig.resources` (optional) parsed from
  `config/models.yaml`; `RoutingResult.requirements` carries the selected model's
  declared resources to the scheduler.
- **ResourceScheduler** (`app/services/resource_scheduler.py`):
  `request()` â†’ grant/wait/reject; FIFO waiters (ordered dict) preserve ordering
  (no starvation); `release()` returns capacity and wakes waiters; `cancel()`
  removes a waiting job (never allocates to it); impossible requests (oversized
  vs capacity, unknown GPU, VRAM with no GPU) fail jobs cleanly with a useful
  reason (`Requested 32768 MB VRAM, system capacity is 16384 MB`). Structured
  `resource_requested/waiting/allocated/released/rejected` events.
- **Worker integration**: flow is now queued job â†’ classify â†’ select model â†’
  determine requirements â†’ scheduler â†’ grant or wait â†’ agent execution; resources
  are released in a `finally` on completion/failure/cancellation/timeout. Job
  gains `resource_status` (`not_required`/`waiting`/`allocated`/`released`/
  `rejected`).
- **Config/capacity**: `RESOURCE_CAPACITY_MODE` (`configured`/`auto`),
  `RESOURCE_CPU_CORES`, `RESOURCE_MEMORY_MB`, `RESOURCE_GPU_VRAM_MB`,
  `RESOURCE_GPU_COUNT`; `main.py` builds capacity, provider, scheduler and exposes
  `scheduler` on app.state + `/health`.
- **Tests (158, all passing)**: 23 new â€” `test_resources.py` (grant/wait/reject,
  five-user scenario, FIFO, release on completion/failure/cancellation, no
  allocation leaks, zero accounting after finish, model requirements from config,
  unknown-GPU/oversized rejection, local discovery, stats) and
  `test_scheduler_worker.py` (end-to-end allocateâ†’runâ†’release, impossible and
  unknown-GPU jobs fail cleanly, cancelled running job frees resources, health
  scheduler section, models without resources unaffected). All 135 Phase 1â€“5
  tests preserved.
- **Live smoke test**: ran the real server + Ollama with a temp registry â€” a
  general job was allocated, ran, completed, and released (`resource_status:
  released`; scheduler allocated VRAM back to 0); a 32 GB document job was
  rejected cleanly with the exact capacity message; `/health` scheduler section
  correct.
- **Deliberately NOT implemented** (out of scope for Phase 6): dynamic GPU model
  loading/unloading, model eviction, batching, speculative decoding, multi-GPU
  execution, distributed inference, Kubernetes, Redis/Celery/Kafka, frontend, RAG,
  OCR, vision, document generation, authentication.

### Phase 7 â€” Local Document Ingestion & Knowledge Base
- **Document model + ingestion** (`schemas/document.py`, `services/
  document_ingestion.py`): `DocumentRecord` (metadata only) + `ChunkRecord` +
  `SearchResult`. Text extraction for `.txt`/`.md` (direct read) and text PDFs
  (pypdf, per page); image-only PDFs â†’ "Document requires OCR"; malformed PDFs
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
  (extract â†’ chunk â†’ embed â†’ store) and search; explicit per-user ownership;
  structured `document_ingestion_started/completed/failed`, `document_deleted`,
  `document_search_started/completed/failed` events (metadata only, never content).
- **document_search tool** (`services/tools.py`): only gateway to the KB; user
  scoped via `log_context`; caps `top_k` and chunk text; returns filename/
  document_id/page/score; "No relevant local documents found" when empty.
- **APIs** (`api/documents.py`): `POST /api/documents` (multipart upload â†’ ingest,
  returns document_id/filename/status), `GET /api/documents`,
  `GET/DELETE /api/documents/{document_id}`. No public search endpoint.
- **KB routing**: isolated TaskRouter search-intent rule (`search/query/look up/
  find ... documents/knowledge/manuals/files`) â†’ `general`, so retrieval requests
  use the reasoning model + document_search instead of the reserved `document`
  task type.
- **Config**: `KNOWLEDGE_BASE_ROOT`, `UPLOADS_ROOT`, `CHUNK_SIZE`, `CHUNK_OVERLAP`,
  `EMBEDDING_MODEL`, `DOCUMENT_SEARCH_DEFAULT/MAX_TOP_K`,
  `DOCUMENT_SEARCH_MAX_CHUNK_CHARS`. Deps: `pypdf`, `python-multipart`
  (`reportlab` for tests).
- **Tests (184, all passing)**: 40 new â€” ingestion (txt/md/pdf/OCR/malformed),
  chunking determinism/metadata, vector store upsert/search/delete/persistence/
  cross-user isolation, KB + document_search tool (metadata, no-results, limits,
  user context, no-contents-in-logs), document APIs (upload/list/get/delete,
  isolation, no public search), and the synthetic industrial-doc demo (pump
  manual PDF + inspection txt + safety md; agent document_search â†’ grounded
  answer; no-relevant flow). All 144 Phase 1â€“6 tests preserved.
- **Live demo**: real Ollama (`llama3.1` reasoning + `nomic-embed-text`
  embeddings) â€” 3 synthetic docs ingested (ready), agent answered the cooling
  water pump inspection question grounded in retrieved chunks (2Ã— document_search,
  3 sources, correct inspection requirements); user-002 saw 0 docs and the agent
  reported "No relevant local documents found".
- **Deliberately NOT implemented** (out of scope for Phase 7): OCR, handwritten
  text recognition, vision models, scanned-document understanding, Word/PPT/Excel
  generation, GPU scheduling changes, multi-GPU, distributed vector databases,
  external services, auth redesign, enterprise RBAC.

### Phase 8 â€” Local Multimodal Document Understanding (OCR + Vision)
- **Multimodal input support** (`document_ingestion.py`): document types now
  include `png`/`jpg`/`jpeg`; image files and image-only ("scanned") PDFs are
  detected and routed through the OCR pipeline. Text-based PDFs/txt/md keep the
  Phase 7 path (text PDF test explicitly preserved). OCR'd text is chunked,
  embedded, and stored in the same per-user vector store, so `document_search`
  also retrieves scanned content.
- **DocumentPreparer** (`services/document_preparer.py`): renders PDF pages to
  local PNGs via `pypdfium2` (page numbers preserved, configurable scale, page
  cap) and normalizes standalone images via Pillow (oversized â†’ downscaled to
  `OCR_MAX_IMAGE_DIMENSION`). Clean `DocumentPreparationError` for malformed PDF,
  unreadable page, unsupported image, oversized image, out-of-range page, and
  rendering failures. Fully local â€” no cloud converters / remote APIs.
- **OCRProvider** (`services/ocr_provider.py`): `OCRProvider` ABC with
  `RapidOCREngine` (fully local RapidOCR/ONNX, lazy engine init in a worker
  thread) returning structured `OCRRegion`s (text + `[x1,y1,x2,y2]` bbox +
  confidence) and `FakeOCRProvider` (scripted text per page, `fail_pages`,
  records calls) for deterministic tests. `OCRProviderError` for engine failures.
- **VisionProvider** (`services/vision_provider.py`): `VisionProvider` ABC +
  `OllamaVisionProvider` (local multimodal model via Ollama `/api/generate` with a
  base64 image; model name always from `config/models.yaml` â€” never hardcoded) +
  `FakeVisionProvider` (scripted observations per page, records calls). Missing/
  unreachable model â†’ `VisionProviderError` â†’ clean tool failure.
- **OllamaService**: added `generate_with_image(prompt, model, image_path)` â€”
  same local-endpoint-only guarantees and error mapping as `generate`.
- **MultimodalService** (`services/multimodal.py`): coordinates per-page
  prepare â†’ OCR â†’ vision (OCR text passed to vision as optional context per the
  "OCR first, vision when needed" strategy) and `ingest_scanned` (render â†’ OCR â†’
  `KnowledgeBase.ingest_pages`). Vision-model `resources` are requested through
  the `ResourceScheduler` under `<job_id>:vision` and released in a `finally`;
  impossible requests fail cleanly ("vision resources rejected: â€¦"). Temp page
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
  with job_id/user_id/document_id/page/provider/model/duration â€” metadata only;
  image contents, OCR text, and vision responses never logged (verified by a
  no-contents-in-logs test).
- **Tests (231 passing, 15 skipped)**: 47 new across `test_document_preparer.py`,
  `test_ocr_provider.py`, `test_vision_provider.py`, `test_multimodal.py`,
  `test_multimodal_agent.py`, `test_multimodal_demo.py`, and
  `test_multimodal_integration.py` â€” covering all 21 Phase 8 test requirements:
  image ingestion, scanned-PDF detection, PDF page rendering, OCR provider
  abstraction/extraction/metadata, vision provider abstraction + model selection,
  missing vision model handling, the document_vision tool, ownership isolation,
  temp-image cleanup (success + failure), cross-user isolation, OCR/vision
  failure handling, vision execution trace, resource-scheduling integration
  (grant+release, rejection), text-PDF Phase 7 path preservation, agent choosing
  document_search for text tasks, document_vision for image questions, both tools
  in a multi-step task, and no image/OCR contents in logs. Real RapidOCR runs
  (`-m rapidocr`); the real-vision smoke test is skipped when no local
  multimodal model exists. All 184 Phase 1â€“7 tests preserved.
- **Live verification**: real RapidOCR ingested a synthetic scanned inspection
  PDF (embedded image, no text layer) â†’ `ready` (chunked); the real `llama3.1`
  agent answered a retrieval question grounded in the OCR'd content (4Ã—
  `document_search`, correct findings); `/health` multimodal section reported
  rapidocr enabled and `llava:7b` configured-but-not-present (available: false).
  A real vision smoke test is included but skipped on this machine because no
  multimodal model is currently pulled into Ollama.
- **Deliberately NOT implemented** (out of scope for Phase 8): Word/Excel/
  PowerPoint generation, approval-note generation, the final report workflow,
  handwriting-specialized model training, P&ID-specific symbolic reasoning,
  dynamic model loading, distributed inference, frontend, auth redesign, external
  services, and real-OCR-language tuning.

### Phase 9 â€” Office Deliverable Generation (Word)
- **Artifact model** (`schemas/artifact.py`): `Artifact` (artifact_id, job_id,
  user_id, filename, type, path, created_at, size_bytes, status
  `creating`/`completed`/`failed`) plus `ArtifactSummary` (safe API view â€” no
  internal path). Artifacts are always associated with their creating job and user.
- **ArtifactStore** (`services/artifact_store.py`): `ArtifactStore` ABC +
  `InMemoryArtifactStore` (lock-guarded, per-job listing, update, delete, stats).
  Generated files remain on disk inside the job workspace; the store keeps
  metadata only â€” the seam for moving persistence to a database later.
- **DocumentGenerator** (`services/document_generator.py`): `DocumentGenerator`
  ABC + `WordDocumentGenerator` using **python-docx**. Converts a structured
  `DocumentContent` (title, subtitle, sections with headings/paragraphs/bullets/
  numbered/table, a Sources numbered section, and a static footer) into a valid
  `.docx`. Deterministic; output is validated (exists, size > 0, reopens with
  `python-docx`) before success. Excel/PowerPoint are reserved future generators.
- **Structured content** (`schemas/document_content.py`): `DocumentSection`
  (heading, paragraphs, bullets, numbered, table) + `DocumentContent`
  (document_type, title, subtitle, sections, sources) + `GeneratedDocument`. The
  agent never emits formatting instructions â€” only this structured representation.
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
  ownership, artifactâ†”job binding, path containment inside the job workspace, and
  file existence before serving with
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
  No generic filesystem download endpoint.
- **Health/status**: `/health` gains `document_generation` (`available`, `word`,
  artifact store stats).
- **Config/deps**: no new runtime config; added `python-docx==1.2.0` to
  requirements.txt (installed locally).
- **Logging**: `document_generation_started/completed/failed` and `artifact_created`
  events log only type/filename/size/duration/status â€” never document content
  (verified by a no-sensitive-content-in-logs test).
- **Tests (274 passing, 15 skipped)**: 43 new across `test_document_generator.py`,
  `test_artifact_store.py`, `test_document_generation_tool.py`,
  `test_artifact_api.py`, `test_document_generation_agent.py`, and
  `test_approval_note_demo.py` â€” covering Word generation (headings, paragraphs,
  bullets, numbered lists, tables, sources, footer, validity, determinism),
  artifact registration/metadata, invalid filename/traversal rejection, cross-user
  isolation, download ownership/containment, generation-failure cleanup, `.docx`
  validity, the agent tool + execution-trace generation step, source metadata
  preservation, no sensitive content in logs, and the synthetic approval-note
  workflow. All 231 Phase 1â€“8 tests preserved (document_search, document_vision,
  sandbox, resource scheduling unchanged).
- **Live verification**: real RapidOCR ingested a synthetic scanned inspection
  PDF; the real `llama3.1` agent ran `document_search` + `document_generation`
  and produced a real `approval_note.docx` (37 KB) listed on the completed job and
  downloaded through the secure endpoint (opened/parsed with python-docx). The
  agent also demonstrated clean recovery when it attempted `document_vision`
  without a local vision model. (Note: llama3.1 intermittently fails to emit the
  large nested `document_generation` JSON and may loop/return empty finals â€” the
  tool validation and agent error handling contain this; deterministic tests use
  scripted valid calls.)
- **Deliberately NOT implemented** (out of scope for Phase 9): Excel generation,
  PowerPoint generation, PDF generation, document templates marketplace, OCR/
  vision/RAG changes, GPU scheduling changes, auth redesign, external services,
  cloud storage, generic file browser, artifact retention/lifecycle system
  (partial files are cleaned on failure; completed artifacts persist in the job
  workspace with no cleanup policy yet).

### Phase 10 â€” Frontend Workbench & Flagship End-to-End Workflow
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
  `ApiError` surfaces backend `detail.message`; unreachable backend â†’ friendly
  "Backend unreachable".
- **Polling hooks** (`src/lib/hooks.ts`): `usePolling` + `useJob`/`useJobs`/
  `useHealth`/`useDocuments`. Job polling stops at terminal states (1s), lists
  poll at 2s, health at 3s, retry-on-error for reconnect, stop-on-404, hidden-tab
  pause. `useActiveUser` persists the dev user in localStorage.
- **Sovereignty indicator**: shows only backend-verified facts â€” Ollama endpoint
  + reachability, local-only inference, model counts; explicitly states the
  backend exposes no external-API counter (no fabricated "0 external calls").
- **Flagship workflow UX**: upload scanned report + maintenance procedure under
  Documents, submit the approval-note prompt, watch QUEUED â†’ RUNNING â†’ COMPLETED,
  the agent trace (document_search â†’ document_vision â†’ document_generation), the
  answer, and the downloadable `approval_note.docx`. Nothing is hardcoded â€” the
  UI renders whatever the backend does.
- **Accessibility/UX**: text labels on status badges (never color-only),
  keyboard-accessible buttons/selects, focus-visible outlines, clear error
  alerts, no decorative animation.
- **Backend change**: configurable `CORS_ORIGINS` (default `http://localhost:3000`)
  via `fastapi.middleware.cors` â€” the only backend change; no redesign.
- **Tests**: backend 290 passing (incl. 2 new CORS tests; Docker up so sandbox
  integration tests ran; 1 vision smoke skipped â€” no multimodal model). Frontend
  **31 Vitest tests** (backend fully mocked) covering job submission,
  queued/running/completed/failed states, execution-trace rendering, model +
  resource info, document list, artifact list + download, per-user isolation,
  backend error handling, polling termination, and the flagship workflow. `tsc
  --noEmit` and `next build` both pass.
- **Live verification**: ran backend (temp config mapping generalâ†’`llama3.1`)
  + `next start` together â€” frontend served at :3000, `/health` reachable with
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

### Phase 11 â€” Sovereignty Hardening & Audit Evidence
- **AuditEvent + JsonlAuditStore** (`schemas/audit.py`, `services/audit_store.py`):
  append-only JSONL under `AUDIT_ROOT` (`data/audit/audit.jsonl`), concurrent-safe
  (threading lock), restart-persistent, easy to inspect. A root `AuditLogHandler`
  maps existing structured `event` log calls to audit event types with an
  allowlist â€” business logic is never duplicated, and only a whitelisted set of
  non-sensitive metadata keys is ever recorded (prompts, responses, document
  contents, OCR/vision text, code, secrets are excluded; verified by a
  sensitive-payload test). The emitting app loggers are lifted to INFO so audit
  events flow even when the root level is higher.
- **Audit events recorded**: JOB_CREATED/STARTED/COMPLETED/FAILED, MODEL_SELECTED,
  MODEL_CALL_STARTED/COMPLETED (added in the agent, embedding provider, and
  vision provider around each local model call), TOOL_CALL_STARTED/COMPLETED,
  DOCUMENT_INGESTION_STARTED/COMPLETED, DOCUMENT_SEARCH_STARTED/COMPLETED,
  OCR_STARTED/COMPLETED, VISION_STARTED/COMPLETED, SANDBOX_STARTED/COMPLETED
  (code_execution), DOCUMENT_GENERATION_STARTED/COMPLETED, and
  RESOURCE_ALLOCATED/RELEASED (resource_released now carries user_id so it stays
  user-scoped).
- **NetworkGuard** (`services/network_guard.py`): every outbound HTTP request via
  the Ollama/embedding/vision clients passes a `GuardedTransport`. Loopback and
  the configured Ollama host are LOCAL (counted); any other destination is
  EXTERNAL â€” recorded as a blocked attempt and rejected by default
  (`ExternalNetworkBlocked`). Status is VERIFIED_LOCAL / VERIFIED_EXTERNAL /
  UNKNOWN (UNKNOWN until traffic is observed â†’ nothing fabricated). onnxruntime
  telemetry disabled (`ORT_TELEMETRY_ENABLED=0`) in the OCR engine.
- **Sovereignty status**: `services/sovereignty.py` assembles real values
  (`local_model_calls` from audit, `external_connections` from the guard,
  `network_policy: LOCAL_ONLY`, `audit_logging: true`, `sandbox_network:
  DISABLED`, `audit_events`). Exposed by `GET /api/sovereignty` and
  `/health.sovereignty`.
- **Audit API**: `GET /api/audit` (user-scoped, optional `job_id`, limit/offset
  pagination) and `GET /api/jobs/{job_id}/audit` (ownership enforced, 403 cross-
  user, 404 unknown). No generic log download.
- **Frontend**: SovereigntyStatus panel shows the verified evidence (network
  policy, external-traffic status + count + blocked attempts, audit logging,
  local model calls, sandbox network, audit event count); JobAuditTimeline shows
  the selected job's backend audit trail with friendly labels, polled until the
  job is terminal.
- **Security/dependency review** (`docs/SOVEREIGNTY.md`): documents what is
  enforced (guard, sandbox `--network none`, no-startup-downloads, ORT telemetry
  off), what is verified (audit trail, sovereignty status), and what cannot be
  verified automatically (OS-level packet capture; third-party libs outside the
  guarded clients). Startup behavior confirmed: no model/image/remote-config/
  telemetry downloads.
- **Tests (backend 322 passing)**: 24 new â€” audit store (creation, persistence,
  concurrent writes, filtering, pagination, sensitive-payload exclusion, mapping),
  network guard (localhost classification, external blocking, non-blocked status,
  unknown state, guarded transport), audit API (user isolation, job filter,
  sovereignty/health status, ownership), and the flagship workflow audit trail +
  machine-readable demo report (all expected stages incl. resource alloc/release;
  tools/models/artifact/sovereignty accurate). Frontend 32 passing (sovereignty
  panel + job audit timeline rendering).
- **Deliberately NOT implemented** (out of scope for Phase 11): authentication
  redesign, RBAC, cloud logging, external monitoring, Kubernetes, distributed
  tracing, new AI tools/models, new OCR/vision capabilities, Excel/PPT, model
  training, automatic model downloading, OS-level packet capture.

### Phase 11 â€” Workbench UX Redesign (frontend)
- **Conversation-first layout**: grid of a persistent left sidebar and a main  column (top bar, scrollable conversation, bottom composer). Removed the old
  dashboard layout (Task status / trace / resource panels as primary).
- **Sidebar** (NEW / Chats / Documents / Artifacts / System + user footer with
  LOCAL pill): chat entries are message-titled (backend `JobSummary.message`);
  documents show status and support upload/delete; artifacts list the caller's
  files across jobs (via new `GET /api/artifacts`) and download through the
  secure per-job endpoint; System opens the drawer.
- **Composer**: large multiline input, attach button with file chips (uploads to
  the document API, chip shows uploading/indexed/failed), Send and Cancel
  (running task) controls, user tag. The user never chooses models/tools â€” the
  backend orchestrates.
- **Conversation**: user message + assistant block that acknowledges QUEUED/
  RUNNING, embeds the **Work Console**, then shows the final markdown answer and
  inline **artifact cards**. Failures map to readable messages with an
  expandable technical detail; cancelled shows a notice. A lazy "Audit trail"
  expander surfaces the per-job audit events. No backend JSON or sensitive
  contents are rendered.
- **Work Console**: built by `lib/console.ts` purely from `execution_trace`
  (planning block from leading plan entries, `$ tool` command lines,
  `âœ“/âœ• result` lines, `TASK COMPLETED/FAILED/CANCELLED`); never invents steps and
  never shows arguments/file contents. Running tool shows "runningâ€¦" with a
  subtle spinner (text always present). Auto-opens while working; collapsible.
- **System drawer**: secondary panel with only backend-verified facts
  (sovereignty: network policy, external-traffic status/count/blocked, audit
  logging/events, sandbox network; services: Ollama/models/worker/queue/KB/OCR/
  vision/docgen; resources: CPU/RAM/GPU).
- **Design**: dark-first, restrained, monospace only for the console, generous
  whitespace, statuses always carry text. Responsive: sidebar becomes an
  off-canvas drawer under 860px.
- **Tests**: frontend suite rewritten/expanded to 42 tests â€” console builder
  (real trace â†’ lines, no fabrication, no sensitive content), WorkConsole
  (completed/running/collapsible), Markdown, ArtifactCard, Conversation
  (completed/failed/cancelled/welcome), friendly errors, SystemDrawer, and the
  page (flagship submitâ†’queuedâ†’runningâ†’completed with console + artifact,
  failure banner, cancellation, attachment chip, artifact download, user
  isolation, chat selection, system drawer, backend-unavailable, cancelled
  state). Backend 324 passing (incl. `job_id` on summaries + `/api/artifacts`).
- **Live verification**: backend + `next start` ran together; the flagships
  upload â†’ chat â†’ completed (document_search/vision/generation) â†’ audit â†’
  sovereignty (VERIFIED_LOCAL, 0 external) â†’ artifact download (37 KB) chain
  works through the exact endpoints the UI calls; `/api/jobs` returns `message`
  for chat titles and `/api/artifacts` lists the generated file with `job_id`.
- **Organizational User + Admin split**: `/` = conversation-first **User
  workspace** (no infra metrics, no other users). `/admin[/section]` =
  **Admin/operations console** (Overview, Workloads, Users, Models, Resources,
  Knowledge, Audit, Sovereignty, System) with dense tables and real data from
  dev-only `/api/admin/*` endpoints. A clearly-labelled dev **User/Admin**
  switch (`useDevRole`, localStorage) selects the experience; the backend
  enforces the admin boundary independently via `X-Role: admin`. Admin views
  expose operational metadata only â€” never messages, prompts, or document
  contents (job detail shows task type/model/duration/trace, not the message).
  Routes: `/admin` + `/admin/{section}` (9 static sections).
- **Live verification**: backend + `next start`; user flagship upload â†’
  job runs; `/api/admin/*` returns real overview (job counts, models available,
  audit events), cross-user workload metadata, per-user counts, filtered audit,
  sovereignty (VERIFIED_LOCAL Â· 0 external), all-HEALTHY system states, and job
  detail with trace but no private `message`. Request without the admin role
  â†’ 403. Frontend: user page (no admin nav) and `/admin/*` console both serve.
- **Deliberately NOT implemented**: new models/tools/OCR/vision/RAG, Excel/PPT,
  authentication/RBAC, WebSockets, backend architecture changes, telemetry.

---

## Files and Directories

```
sovereign-ai-workbench/            (== ./AstraSovereign)
â”œâ”€â”€ CONTEXT.md                     persistent project memory (this file)
â”œâ”€â”€ README.md                      project overview and goals
â”œâ”€â”€ .gitignore                     excludes env, logs, uploads, outputs, models, caches
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ README.md                  backend setup/run/usage guide
â”‚   â”œâ”€â”€ requirements.txt           fastapi, uvicorn, httpx, pydantic-settings, pyyaml
â”‚   â”œâ”€â”€ requirements-dev.txt       pytest
â”‚   â”œâ”€â”€ pytest.ini                 pythonpath=tests config
â”‚   â”œâ”€â”€ .env.example               template for local config (copy to .env)
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ main.py                create_app() factory, lifespan, JSON logging
â”‚   â”‚   â”œâ”€â”€ config.py              pydantic-settings Settings (env-driven)
â”‚   â”‚   â”œâ”€â”€ schemas/
â”‚   â”‚   â”‚   â”œâ”€â”€ chat.py            ChatRequest (message, task_type, priority)
â”‚   â”‚   â”‚   â”œâ”€â”€ job.py             Job, JobStatus, JobSubmitResponse, JobSummary (+ artifacts)
â”‚   â”‚   â”‚   â”œâ”€â”€ resources.py       ResourceRequirements/Allocation, GpuInfo, Capacity
â”‚   â”‚   â”‚   â”œâ”€â”€ document.py        DocumentRecord, ChunkRecord, SearchResult
â”‚   â”‚   â”‚   â”œâ”€â”€ artifact.py        Artifact, ArtifactSummary, ArtifactStatus (Phase 9)
â”‚   â”‚   â”‚   â”œâ”€â”€ document_content.py DocumentSection/Content, GeneratedDocument (Phase 9)
â”‚   â”‚   â”‚   â””â”€â”€ multimodal.py      OCRRegion/OCRPageResult, VisionPageResult, PageEvidence, VisionAnalysisResult
â”‚   â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”‚   â”œâ”€â”€ ollama_service.py  OllamaService async client + typed errors + generate_with_image
â”‚   â”‚   â”‚   â”œâ”€â”€ job_store.py       JobStore ABC + InMemoryJobStore
â”‚   â”‚   â”‚   â”œâ”€â”€ job_manager.py     JobManager (lifecycle + ownership)
â”‚   â”‚   â”‚   â”œâ”€â”€ job_queue.py       FIFO async job queue
â”‚   â”‚   â”‚   â”œâ”€â”€ worker.py          background worker (dequeue â†’ classify â†’ route â†’ schedule â†’ agent)
â”‚   â”‚   â”‚   â”œâ”€â”€ model_registry.py  ModelRegistry (validates config/models.yaml)
â”‚   â”‚   â”‚   â”œâ”€â”€ task_router.py     TaskRouter (deterministic classification + KB search intent)
â”‚   â”‚   â”‚   â”œâ”€â”€ model_router.py    ModelRouter (task_type â†’ enabled model)
â”‚   â”‚   â”‚   â”œâ”€â”€ workspace.py       WorkspaceManager + safe path resolution
â”‚   â”‚   â”‚   â”œâ”€â”€ log_context.py     contextvars job context for tool logging
â”‚   â”‚   â”‚   â”œâ”€â”€ sandbox_runner.py  SandboxRunner ABC + DockerSandboxRunner (Phase 5)
â”‚   â”‚   â”‚   â”œâ”€â”€ artifact_store.py  ArtifactStore ABC + InMemoryArtifactStore (Phase 9)
â”‚   â”‚   â”‚   â”œâ”€â”€ document_generator.py DocumentGenerator ABC + WordDocumentGenerator (Phase 9)
â”‚   â”‚   â”‚   â”œâ”€â”€ document_preparer.py  PDF page rendering (pypdfium2) + image prep (Pillow) (Phase 8)
â”‚   â”‚   â”‚   â”œâ”€â”€ ocr_provider.py    OCRProvider ABC + RapidOCREngine + FakeOCRProvider (Phase 8)
â”‚   â”‚   â”‚   â”œâ”€â”€ vision_provider.py VisionProvider ABC + OllamaVisionProvider + FakeVisionProvider (Phase 8)
â”‚   â”‚   â”‚   â”œâ”€â”€ multimodal.py      MultimodalService (OCR+vision pipeline, scheduler integration) (Phase 8)
â”‚   â”‚   â”‚   â”œâ”€â”€ tools.py           Tool ABC + list/read/write + code_execution + document_search + document_vision + document_generation
â”‚   â”‚   â”‚   â”œâ”€â”€ tool_registry.py   ToolRegistry (deny-by-default validation)
â”‚   â”‚   â”‚   â”œâ”€â”€ agent.py           Agent (bounded loop, trace, cancellation)
â”‚   â”‚   â”‚   â”œâ”€â”€ resource_provider.py  ResourceProvider ABC + in-memory + local discovery
â”‚   â”‚   â”‚   â”œâ”€â”€ resource_scheduler.py ResourceScheduler (grant/wait/reject, FIFO)
â”‚   â”‚   â”‚   â”œâ”€â”€ document_ingestion.py text extraction + deterministic chunking (now incl. image types)
â”‚   â”‚   â”‚   â”œâ”€â”€ embedding.py       EmbeddingProvider ABC + OllamaEmbeddingProvider
â”‚   â”‚   â”‚   â”œâ”€â”€ vector_store.py    VectorStore ABC + JsonVectorStore
â”‚   â”‚   â”‚   â””â”€â”€ knowledge_base.py  KnowledgeBase (ingest/search/delete, per-user) + ingest_pages
â”‚   â”‚   â””â”€â”€ api/
â”‚   â”‚       â”œâ”€â”€ deps.py            get_user_id (X-User-ID header dependency)
â”‚   â”‚       â”œâ”€â”€ chat.py            POST /api/chat (enqueue job)
â”‚   â”‚       â”œâ”€â”€ jobs.py            GET/DELETE /api/jobs, GET /api/jobs/{job_id} (+ artifacts), artifact download
â”‚   â”‚       â”œâ”€â”€ documents.py       POST/GET/DELETE /api/documents (+ image/scanned-PDF OCR routing)
â”‚   â”‚       â””â”€â”€ health.py          GET /health (Ollama + models + queue + scheduler + KB + multimodal + docgen + worker)
â”‚   â””â”€â”€ tests/
â”‚       â”œâ”€â”€ conftest.py            fixtures, mocks, FakeEmbeddingProvider, FakeOCR/FakeVision, pdf/image helpers, wait_for_job
â”‚       â”œâ”€â”€ test_ollama_service.py 8 tests (direct service unit tests)
â”‚       â”œâ”€â”€ test_chat.py           7 tests
â”‚       â”œâ”€â”€ test_health.py         3 tests
â”‚       â”œâ”€â”€ test_jobs.py           8 tests
â”‚       â”œâ”€â”€ test_worker.py         5 tests
â”‚       â”œâ”€â”€ test_concurrency.py    2 tests (5-user + FIFO ordering)
â”‚       â”œâ”€â”€ test_task_router.py    10 tests (classification rules)
â”‚       â”œâ”€â”€ test_model_router.py   11 tests (selection, registry validation)
â”‚       â”œâ”€â”€ test_routing.py        9 tests (end-to-end job routing)
â”‚       â”œâ”€â”€ test_workspace.py      12 tests (isolation + traversal)
â”‚       â”œâ”€â”€ test_tools.py          14 tests (tool behavior + validation)
â”‚       â”œâ”€â”€ test_agent.py          12 tests (agent loop + cancellation)
â”‚       â”œâ”€â”€ test_agent_demo.py     2 tests (demo + running-job cancellation)
â”‚       â”œâ”€â”€ test_sandbox.py        14 tests (code_execution + docker invocation)
â”‚       â”œâ”€â”€ test_sandbox_demo.py   3 tests (factorial + bug-fix-loop demos)
â”‚       â”œâ”€â”€ test_sandbox_docker.py 14 tests (docker-marked integration tests)
â”‚       â”œâ”€â”€ test_resources.py      19 tests (scheduler + provider + five-user scenario)
â”‚       â”œâ”€â”€ test_scheduler_worker.py 6 tests (worker + scheduler integration)
â”‚       â”œâ”€â”€ test_ingestion.py      11 tests (extraction + chunking)
â”‚       â”œâ”€â”€ test_vector_store.py   7 tests (upsert/search/delete/persistence/isolation)
â”‚       â”œâ”€â”€ test_knowledge.py      10 tests (KB + document_search tool + logs)
â”‚       â”œâ”€â”€ test_documents_api.py  11 tests (document APIs + isolation)
â”‚       â”œâ”€â”€ test_knowledge_demo.py 2 tests (synthetic industrial demo + no-results)
â”‚       â”œâ”€â”€ test_document_preparer.py 11 tests (PDF rendering, image prep, clean failures) (Phase 8)
â”‚       â”œâ”€â”€ test_ocr_provider.py   5 tests (fake + real RapidOCR) (Phase 8)
â”‚       â”œâ”€â”€ test_vision_provider.py 8 tests (fake + Ollama vision mapping) (Phase 8)
â”‚       â”œâ”€â”€ test_multimodal.py     20 tests (ingestion, tool, isolation, cleanup, scheduling, logs, health) (Phase 8)
â”‚       â”œâ”€â”€ test_multimodal_agent.py 3 tests (document_search vs document_vision + multi-step) (Phase 8)
â”‚       â”œâ”€â”€ test_multimodal_demo.py 1 test (synthetic industrial comparison) (Phase 8)
â”‚       â”œâ”€â”€ test_multimodal_integration.py 2 tests (real RapidOCR + real vision smoke) (Phase 8)
â”‚       â”œâ”€â”€ test_document_generator.py 10 tests (Word generation: title/headings/paragraphs/bullets/numbered/tables/sources/footer/validity) (Phase 9)
â”‚       â”œâ”€â”€ test_artifact_store.py 7 tests (create/get/update/list/delete/stats/summary) (Phase 9)
â”‚       â”œâ”€â”€ test_document_generation_tool.py 15 tests (validation, isolation, cleanup, scheduling, logs) (Phase 9)
â”‚       â”œâ”€â”€ test_artifact_api.py 9 tests (job artifacts, secure download, ownership, containment, health) (Phase 9)
â”‚       â”œâ”€â”€ test_document_generation_agent.py 2 tests (agent tool + trace + download) (Phase 9)
â”‚       â””â”€â”€ test_approval_note_demo.py 1 test (synthetic approval-note workflow) (Phase 9)
â”œâ”€â”€ frontend/                      Next.js + React + TypeScript workbench (Phase 10)
â”‚   â”œâ”€â”€ package.json               next/react/typescript + vitest/RTL dev deps
â”‚   â”œâ”€â”€ next.config.mjs, tsconfig.json, vitest.config.ts
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ app/
â”‚       â”‚   â”œâ”€â”€ layout.tsx         root layout (metadata)
â”‚       â”‚   â”œâ”€â”€ page.tsx           single-page workbench (client component)
â”‚       â”‚   â””â”€â”€ globals.css        layout/panel/badge/table/trace styles
â”‚       â”œâ”€â”€ components/
â”‚       â”‚   â”œâ”€â”€ Sidebar.tsx        New task / Chats / Documents / Artifacts / System + user footer
â”‚       â”‚   â”œâ”€â”€ Conversation.tsx   user+assistant messages, work console, artifact cards, errors
â”‚       â”‚   â”œâ”€â”€ WorkConsole.tsx    terminal-like log from real execution_trace
â”‚       â”‚   â”œâ”€â”€ Composer.tsx       large input + attach chips + send/cancel
â”‚       â”‚   â”œâ”€â”€ ArtifactCard.tsx / Markdown.tsx / SystemDrawer.tsx
â”‚       â”‚   â””â”€â”€ components.test.tsx, workbench.test.tsx   (Vitest)
â”‚       â”œâ”€â”€ lib/
â”‚       â”‚   â”œâ”€â”€ api.ts             typed API client (health/jobs/documents/artifacts/audit)
â”‚       â”‚   â”œâ”€â”€ console.ts         Work Console builder (pure, trace-driven)
â”‚       â”‚   â”œâ”€â”€ types.ts           TS interfaces mirroring backend schemas
â”‚       â”‚   â”œâ”€â”€ hooks.ts           polling hooks + useActiveUser
â”‚       â”‚   â””â”€â”€ api.test.ts, hooks.test.tsx
â”‚       â””â”€â”€ test-utils/factory.ts  fixtures + fetch mock helpers
â”œâ”€â”€ config/
â”‚   â””â”€â”€ models.yaml                task type â†’ local model registry (incl. vision=llava:7b + resources)
â”œâ”€â”€ data/
â”‚   â”œâ”€â”€ uploads/                   (empty â€” user uploads, gitignored)
â”‚   â”œâ”€â”€ outputs/                   (empty â€” generated deliverables, gitignored)
â”‚   â”œâ”€â”€ knowledge/                 (empty â€” local knowledge base, gitignored)
â”‚   â”œâ”€â”€ tmp/                       (empty â€” rendered page images, cleaned, gitignored)
â”‚   â””â”€â”€ workspaces/                (per-job agent workspaces, gitignored)
â”œâ”€â”€ logs/                          backend.log (gitignored, structured JSON)
â””â”€â”€ docker/                        (empty â€” reserved for sandbox/container images)
```

---


## Change Log

- **Phase 0 (2026-08-29)**: Created project scaffold â€” directory structure, CONTEXT.md,
  README.md, .gitignore. No application code yet.
- **Phase 1 (2026-08-29)**: Implemented FastAPI backend (`backend/`) that talks only to
  the local Ollama server â€” `GET /health`, `POST /api/chat`, env-driven config,
  structured JSON logging, typed Ollama error handling, 10 passing tests, live smoke
  test against real Ollama. See Architecture Decisions for the stack and runtime chosen.
- **Phase 2 (2026-08-29)**: Reworked the backend to a job queue architecture â€”
  `HTTP â†’ JobManager â†’ FIFO queue â†’ Worker â†’ Ollama`. `POST /api/chat` enqueues and
  returns a `job_id` immediately; new `GET /api/jobs`, `GET /api/jobs/{job_id}`,
  `DELETE /api/jobs/{job_id}` enforce per-user ownership via `X-User-ID`. 34 tests
  incl. a five-user concurrency scenario; live smoke test against real Ollama.
  Also initialized the git repo (`main`) and pushed to GitHub.
- **Phase 3 (2026-08-29)**: Added config-driven model routing â€”
  `config/models.yaml` model registry, deterministic TaskRouter (general/coding/
  document/vision), ModelRouter (task_type â†’ enabled model, no silent fallback),
  and worker integration (classify â†’ select â†’ call OllamaService with the selected
  model). `/health` reports per-task-type model availability; jobs expose
  `task_type`/`model`. 64 tests incl. routing unit + end-to-end; live smoke test
  verified general and coding routing and the disabled-model clean failure.
- **Phase 4 (2026-08-29)**: Added the agentic pipeline â€” a bounded, cancellation-aware
  Agent loop (strict JSON tool-calling protocol with plain-text fallback), a
  deny-by-default ToolRegistry with `list_files`/`read_file`/`write_file`, per-job
  workspace isolation (`data/workspaces/<user>/<job>/`), and an ordered execution
  trace exposed through the job API. Worker runs the agent after routing; cancel now
  stops running jobs. 104 tests incl. the end-to-end demo; live smoke test verified a
  real `list_files` tool call against real Ollama.
- **Phase 5 (2026-08-29)**: Added the secure Docker code-execution sandbox â€” a
  `code_execution` tool (registered only when `SANDBOX_ENABLED=true`) that runs
  generated Python ONLY inside an isolated container (`--network none`, no
  privileges, read-only root, resource limits, strict timeout, temp code dir only,
  guaranteed cleanup). Structured `code_execution_*` logging; 135 tests incl. 14
  real-Docker integration tests and deterministic factorial + bug-fix demos. Live
  killer test: real agent + Ollama + Docker ran factorial(10) (exit 0) and reported
  3628800; network-blocked and no-host-fs confirmed.
- **Phase 6 (2026-08-29)**: Added the resource scheduler â€” typed resource models,
  a `ResourceProvider` (in-memory + read-only local discovery), model-declared
  `resources` in `config/models.yaml`, and a FIFO `ResourceScheduler`
  (grant/wait/reject, clean release on completion/failure/cancellation/timeout,
  impossible/unknown-GPU jobs fail cleanly). Worker flow is now queue â†’ classify â†’
  select model â†’ schedule â†’ agent. `/health` reports scheduler state; jobs expose
  `resource_status`. 158 tests incl. the five-user scheduling scenario; live smoke
  test verified allocateâ†’runâ†’release and the exact 32 GB reject message.
- **Phase 7 (2026-08-29)**: Added the local document knowledge base â€” ingestion
  (txt/md/text-PDF; scanned PDFs â†’ "requires OCR"), deterministic chunking, local
  Ollama embeddings, a per-user persistent JSON vector store with cosine search, a
  `document_search` tool (the only gateway for the agent), and document APIs. The
  agent answers retrieval-grounded questions with source metadata. 184 tests incl.
  the synthetic industrial-doc demo; live demo with `llama3.1` + `nomic-embed-text`
  produced a grounded pump-inspection answer and confirmed cross-user isolation.
- **Phase 8 (2026-08-31)**: Added local multimodal document understanding â€”
  image-only PDF detection + png/jpg/jpeg support, a `DocumentPreparer`
  (pypdfium2 page rendering + Pillow image normalization, temp-file cleanup after
  success/failure), an `OCRProvider` abstraction with the fully local RapidOCR
  engine, a `VisionProvider` abstraction backed by the registry-configured local
  multimodal model (Ollama, default `llava:7b`), a `MultimodalService` that runs
  prepare â†’ OCR â†’ vision per page with OCR text as context and routes the vision
  model's declared resources through the `ResourceScheduler`, and a
  `document_vision` tool (the agent's only gateway to multimodal analysis) that
  returns `[OCR]`/`[VISION]`-labelled evidence. Scanned/image docs are OCR-indexed
  into the KB so `document_search` also finds them. `/health` gains a `multimodal`
  section. 231 tests incl. the synthetic industrial comparison demo and real
  RapidOCR integration; live smoke: real RapidOCR + real `llama3.1` agent answered
  a retrieval question grounded in OCR'd scanned-PDF content. Vision smoke test
  skipped until a multimodal model is pulled into Ollama.
- **Phase 9 (2026-08-31)**: Added office deliverable generation (Word first) â€”
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
  `document_search` â†’ `document_generation`.
- **Phase 10 (2026-08-31)**: Added the frontend workbench â€” a single-page
  Next.js + React + TypeScript client that operates the backend: typed API
  client, polling hooks (terminal-stop/reconnect/hidden-tab pause), components
  for jobs/trace/resources/documents/artifacts/sovereignty, a dev user selector
  (`user-001`â€¦`user-005`), and the flagship approval-note workflow UI (nothing
  hardcoded). Backend gained configurable CORS (`CORS_ORIGINS`) as the only
  backend change. 290 backend tests + 31 frontend Vitest tests (mocked backend);
  `tsc --noEmit` and `next build` pass. Live: backend + `next start` ran
  together with CORS verified; a live flagship run produced a downloadable
  `pump_approval_note.docx` (37 KB) via the exact endpoints the UI uses.
- **Phase 10 follow-up (2026-09-01)**: Added the CI pipeline
  (`.github/workflows/ci.yml`) â€” backend `pytest` + frontend typecheck/vitest/
  build run on every push and PR (green verified). Fixed a repo-level gitignore
  bug where the bare `lib/` rule silently excluded `frontend/src/lib/` from
  version control (now scoped to `backend/`).
- **Phase 10 follow-up (2026-09-01)**: Community/ops hardening â€” `CONTRIBUTING.md`
  + issue/PR templates (issue #7), `docs/ONBOARDING.md` developer runbook
  (issue #8), and an age-based local data cleanup tool + policy
  (`backend/app/services/data_cleanup.py`, CLI via `python -m
  app.services.data_cleanup`, `docs/CLEANUP.md`, 7 tests; issue #9). Enabled SSH
  commit signing (dedicated `sovereign_signing` ed25519 key; registration of the
  signing key on the GitHub account is required before commits show "Verified").
- **Phase 11 (2026-09-01)**: Added sovereignty hardening + audit evidence â€” an
  append-only JSONL `AuditStore` (logâ†’audit handler reusing existing events;
  non-sensitive metadata only) recording job/model/tool/ingestion/search/OCR/
  vision/sandbox/docgen/resource events; a `NetworkGuard` classifying local vs
  external HTTP and blocking external by default; a trustworthy
  `/api/sovereignty` + `/health.sovereignty` (real counts, UNKNOWN until traffic
  seen); user-scoped `GET /api/audit` + `GET /api/jobs/{id}/audit`; frontend
  Sovereignty panel + per-job Audit trail; onnxruntime telemetry disabled;
  `docs/SOVEREIGNTY.md` with the dependency/network review. 322 backend + 32
  frontend tests passing.
- **Phase 11 UX (2026-09-01)**: Redesigned the frontend into a conversation-first
  Claude/Cowork-style workbench (sidebar + conversation + composer +
  terminal-like Work Console built from real `execution_trace`; system facts in a
  secondary drawer; dark-first styling; responsive sidebar). Documented backend
  micro-additions: `ArtifactSummary.job_id`, `GET /api/artifacts`,
  `JobSummary.message`. Then split the product into **User workspace** (`/`) and a
  **development Admin/operations console** (`/admin[/section]`, 9 sections) fed
  by dev-only `/api/admin/*` endpoints (overview/jobs/users/models/resources/
  knowledge/audit/sovereignty/system) that return operational metadata only;
  clearly-labelled dev User/Admin role switch (not auth â€” backend enforces the
  `X-Role: admin` boundary). Applied UI refinements (sidebar row layout + hover
  actions, scroll fade, brand anchor, composer glow, assistant card, console
  accent). 330 backend + 46 frontend tests passing.

### Post-Phase 11 â€” SIH Workbench Adoption, Real-Data UI, and Multi-Model Pipelines (current)

> Phased numbering is retired; commits no longer carry phase numbers. This block
> is the authoritative memory for the most recent body of work.

#### UI: SIH-style workbench adopted (frontend)
- The polished SIH/POC React UI was ported into the Next.js app and is served at
  `/preview` (client-only, `dynamic ssr:false`). It is a single operator cockpit:
  Agent Chat, Live Logs, Model Routing, Knowledge Base, Vault, and Code Sandbox,
  plus a right rail (Audit / Network / Models) and login screen. Fully unbranded
  (no Rakshaka/MRPL/Sovereign strings, marks, or storage keys anywhere); topbar
  says "AI Workbench".
- Ported UI lives under `frontend/src/sih/` (self-contained, relative imports) and
  is now wired to the real backend â€” no demo data in the main flows:
  - Agent Chat submits real `POST /api/chat` jobs, polls ~1.1s, and reveals live
    steps (plan / tools / final) with the routed model; artifacts download the
    real generated file; uploads are ingested into the KB first; final answers
    render as Markdown; follow-ups carry session context (attached docs + last
    answer) so chained prompts keep working.
  - Knowledge Base lists/uploads/deletes real documents (chunks, status,
    `/health` index totals); Vault lists real artifacts with real downloads;
    Live Logs, Model Routing (real `/api/admin/models` registry + routing trace),
    the right rail (real sovereignty/health/models), and the Sandbox (real
    runs: submit â†’ terminal stream â†’ pass/fail) all read live backend data.
- New frontend deps: `tailwindcss` v4 (+ `@tailwindcss/postcss`, imported at the
  top of `globals.css`), `lucide-react`, `jszip`. `docx` retained for Word
  exports; Excel/PPTX deliverables are generated client-side with a small
  JSZip-based OOXML writer (exceljs/pptxgenjs dropped â€” they cannot bundle in
  Next because of `node:*` requires; `next.config.mjs` stubs the node: scheme).
- `Login.tsx` dev sign-in gate (sessionStorage `sovereign.session`) added at `/`;
  `/admin` console unchanged and unbranded to "Operations console". Design tokens
  refreshed to a neutral sage-on-black palette with light-theme support.
- Frontend suite: 63 tests pass; `tsc` clean; `next build` succeeds.

#### Backend: reliability + multi-model pipelines
- Code sandbox now enabled by default (`sandbox_enabled: bool = True`; `.env` and
  `.env.example` updated). python-docx is in requirements; the backend must run
  from `backend/.venv`.
- Agent hardening in `agent.py`: coding tasks cannot finish without a real
  `code_execution` call; document-creation requests cannot finish without a real
  `document_generation` call (both steered, bounded, and gated to the standalone
  single-model path via `enforce_contracts`). Worker re-fetches the job after
  classification so `task_type`/`model` are accurate at execution time.
- `task_router.py` only classifies explicit file-processing verbs to the reserved
  `document` type; `config/models.yaml` enables `document` â†’ `qwen2.5:7b` and adds
  an optional disabled `math` entry (`qwen2.5-math:7b`). `document_generation`
  accepts per-section `sources`.
- NEW **multi-model pipeline** (`app/services/pipeline.py` +
  `capability_router.py`):
  - Capability allowlist is server-side fixed:
    `{reasoning, math, coding, document, vision}`; the planner may not invent
    capabilities.
  - Flow: Worker (TaskRouter â†’ ModelRouter) â†’ `ComplexityGate` (only genuinely
    multi-capability requests, e.g. coding+document or coding+math) â†’
    `Planner` (reasoning-model LLM plan, validated against the allowlist and
    resolvable enabled models, with deterministic fallback templates) â†’
    `PipelineExecutor`.
  - Each stage runs its own bounded agent session on a **different** local model
    chosen by capability (`CapabilityRouter`: capability match â†’ general â†’ any
    enabled; never a silent crash). Prior stage outputs are chained with explicit
    truncation markers (`pipeline_max_stage_output_chars`/
    `pipeline_max_context_chars`). Stage resources are allocated
    (`<job_id>:<stage>`) and released one at a time. Retries happen only when a
    stage failed before any tool side effect. The whole plan is validated before
    any stage executes.
  - Trace gains `stage_started`/`stage_completed`/`stage_retry`/
    `pipeline_completed` entries carrying stage/label/capability/model/attempt;
    the UI renders each stage as a step with its model chip (also visible in the
    admin job trace).
  - Config: `PIPELINE_ENABLED`, `PIPELINE_PLANNER_CAPABILITY`,
    `PIPELINE_MAX_STAGES`, `PIPELINE_STAGE_MAX_ITERATIONS`,
    `PIPELINE_STAGE_MAX_TOOL_CALLS`, `PIPELINE_ATTEMPTS`,
    `PIPELINE_MIN_PROMPT_CHARS`, `PIPELINE_MAX_STAGE_OUTPUT_CHARS`,
    `PIPELINE_MAX_CONTEXT_CHARS`.
- Tests: `backend/tests/test_pipeline.py` (gate, allowlist validation, capability
  router fallback, planner fallback, end-to-end coding+document run). Full
  backend suite green (incl. preserved single-model paths); frontend 63/63.

#### Docs
- CONTEXT.md / README.md / frontend README / backend README updated to cover the
  adopted UI, the `/preview` workbench, and the multi-model pipeline.

#### Current / next
- Current: UI adoption + real-data wiring + multi-model pipeline (this block).
- Next candidates: pipeline summary card in the UI, per-stage verification
  outputs, real math model pull + enable, and further stage templates.

#### Cowork â€” persistent project AI-IDE (M1-M6)
- Backend: per-user persistent projects under `data/projects/<user>/<project>` with
  hidden `.cowork/` metadata. `api/projects.py` exposes project CRUD, file
  tree/read/write/delete (ownership + `resolve_within_workspace` containment,
  text-only, size-capped), `POST /api/cowork/chat`, and
  `GET /api/projects/{id}/history`.
- Jobs carry optional `project_id`; the worker executes the agent/pipeline
  against the project folder, so files persist across turns. A backend-enforced
  project lock returns 409 for file mutations while an agent job runs.
- M3/M4: per-project ContextManager (`.cowork/context/`) persists project
  summary, decisions, active task, capped recent turns with deterministic
  compaction, and bounded execution summaries (job/model/outcome/files touched).
  Requests are assembled filesystem-first (authoritative) then decisions/active
  task/recent+archived conversation/request. Raw chain-of-thought is never
  stored; only short plain-text summaries.
- UI: `/cowork` (Next) = project list + chat, file tree + editor (save disabled
  under the agent lock), create-file, and a live execution panel showing
  plan/tool/stage steps with model chips plus decisions/executions on completion.
- Integration tests: `test_cowork.py`, `test_cowork_context.py`,
  `test_cowork_e2e.py` (build -> inspect -> modify -> run in sandbox -> doc
  generation into the project).

### Local PowerPoint generation (Presenton-inspired planning + PptxGenJS)
- Renderer: small offline Node component `presentation/` (PptxGenJS, MIT). `src/render.cjs`
  reads a JSON presentation model (`--in`) and writes an editable `.pptx` (`--out`).
  Themes are fully local palettes: executive / technical / report / general. Slide
  types: title, content, bullets, two-column, table, sources. No images, no network.
- Backend model: `schemas/presentation.py` (AstraSovereign-owned intermediate model;
  the agent never sees PptxGenJS/Presenton objects). Tool: `presentation_generation`
  in the ToolRegistry validates the model, registers a `pptx` ArtifactStore artifact
  (creating -> completed/failed), requests a small CPU/memory allocation through the
  ResourceScheduler (`<job>:pptgen`), invokes the local renderer, then validates the
  package (zip + [Content_Types].xml + ppt/presentation.xml + expected slide parts)
  before registering the artifact. Workspace/path containment is reused; traversal
  filenames and malformed content fail cleanly without artifacts.
- Wiring: `app/services/presentation_renderer.py` (NodePresentationRenderer +
  FakePresentationRenderer for tests + `validate_pptx`). `create_app()` gains a
  `presentation_renderer` seam. Pipeline capability allowlist now includes
  `presentation`; agent prompt documents how to call presentation_generation and to
  close decks with a Sources slide. Audit events PRESENTATION_GENERATION_STARTED/
  COMPLETED/FAILED mapped metadata-only.
- Reference/attribution: Presenton (github.com/presenton/presenton, Apache-2.0) was
  inspected for planning/layout/theme concepts only â€” NO Presenton code is copied.
  PptxGenJS (github.com/gitbrent/PptxGenJS, MIT) is the local renderer. Both fully
  offline; no cloud/image/template providers are used.
- Frontend: no changes needed; `.pptx` artifacts appear in the existing artifact
  lists/downloads naturally.
- Tests: `backend/tests/test_presentation.py` â€” content validation, package
  validation, fake + real node renderer, agent -> tool end-to-end artifact, secure
  download + ownership, traversal rejection, malformed-slide failure. Word
  generation is unchanged and its tests still pass. Full backend suite green.
- Known limitations / next: renderer emits text/table slides only (no images by
  design); pipeline stage for presentation not yet exercised end-to-end against a
  real model; deeper layout control (auto columns from content density, per-slide
  theme accent) and a real model-driven industrial demo are next steps.

#### UI consolidation (latest)
- Removed the old ported SIH preview (`frontend/src/sih/` and the `/preview`
  route) and the root `preview-landing.html`. The unified workbench at `/`
  (Landing â†’ dashboard with AI Assistant, real Workspace Files, Sandbox, etc.),
  `/cowork` (project IDE), and `/admin` (operations console) are now the UI.
- Docs/README updated to reflect every current feature.

### Offline deck vendoring + office deliverables (Word/Excel)
- Offline PptxGenJS: the full runtime dependency closure (19 pure-JS packages,
  pinned `pptxgenjs@4.0.1`) is committed under `presentation/node_modules` and
  un-ignored in `.gitignore`; `presentation/scripts/install-offline.cjs` verifies
  it without npm or network. Validated from an index-only export (clean-clone
  stand-in) with no `npm install`: the check passed and a real deck rendered with
  the expected slides and title text.
- Real-renderer coverage: a new `node` marker + `test_presentation_renderer_node.py`
  runs the actual `render.cjs`, asserts slide parts and title/bullet text, and
  fails (does not skip) when the vendored tree is missing, so CI can no longer be
  green with a dead deck generator. `validate_pptx` now accepts at least the
  expected slide count; the render payload goes to a temp dir so a crash cannot
  leave document content in the artifacts folder.
- Word deliverables: an optional `approval` object renders a formal approval note
  (reference/date/originator/department/subject/background/recommendation +
  signature table); `DocumentSection.images` embeds workspace-contained
  png/jpg/jpeg via `add_picture()` with optional captions (absolute/traversal/
  absent paths rejected).
- Excel deliverables: `XlsxDocumentGenerator` (openpyxl, added to backend
  requirements) writes one worksheet per section table, treats `=`-prefixed cells
  as real formulas, preserves leading-zero IDs as text, adds a sources sheet,
  fixes timestamps for determinism, and validates by reopening. The
  `document_generation` tool now holds a `{word, excel}` generator map selected
  by `type`; artifact download serves the xlsx media type and preview reads cells.
- Tests: `test_xlsx_generator.py`, plus approval/image/excel cases in
  `test_document_generation_tool.py` and a frontend ArtifactCard label test.
  Backend 404 passed; frontend typecheck + 64 tests + build.
- Known limitations / next: `.xlsx` ingestion and spreadsheet read/compute are
  not implemented; policy-engine candidate filtering and a live egress monitor
  remain sequenced after ingestion.

#### Presentation geometry fix + speaker notes
- `render.cjs` set `LAYOUT_WIDE` (13.33in) but hardcoded every content block to a
  9.3in width, leaving ~3.4in (~26%) dead space on the right of every slide while
  the accent bar spanned 100%. All geometry is now derived from
  `SLIDE_W`/`MARGIN`/`CONTENT_W` (including the two-column widths, table column
  width, and bullet/sources insets); the title block moved down to `y: 2.6` for
  better vertical centring.
- `SlideContent.notes` now carries speaker notes through to PptxGenJS
  `addNotes()` (previously the schema had no notes field, so they were empty).
- The `node`-marked test now asserts the widest text shape on a content slide
  spans at least 85% of the actual slide width (read from `ppt/presentation.xml`),
  and that a slide with notes emits a `notesSlide` part with the note text.
  Backend 407 passed; frontend typecheck + 64 tests.

#### Deliverable consistency + office polish (fix/deliverable-consistency)
- Manual inspection of all three Tank 204 deliverables (docx/xlsx/pptx) caught
  three different verdicts for the same reading: Course 3 (11.2 mm vs 12.0 mm)
  was "Monitor" in the docx, "FAIL" in the xlsx and omitted from the pptx. The
  cause was authoring three independent payloads, so the fix is a binding
  constraint: one structured findings object (readings/limits, margin and status
  computed once in code) feeds every generator; no generator restates a verdict.
  Documented in `CONTEXT.md` for the week 5 scan → findings → approval-note chain.
- Word: A4 page size; removed the redundant "Approval Note" Heading 1 (the title
  carries it); findings/approval layout now orders recommendation + signature
  block after the findings sections; footer is optional `classification` plus a
  live "Page X of Y" (PAGE/NUMPAGES fields), replacing the hardcoded marketing
  line. `DocumentContent.classification` added and threaded through the tool and
  prompt.
- Excel: measured values and numeric formulas format to `0.0`; summary rows are
  labelled ("Min reading"/"Min margin"/"Failures") and the failure count no longer
  sits unlabelled under the Status column; the sources sheet gains a "Reference"
  header, width and freeze.
- QA: regenerated all three from one findings source and verified programmatically
  that every course verdict matches across docx, xlsx and pptx
  (Course 1 PASS, Course 2 FAIL, Course 3 FAIL, Course 4 PASS).
- Note recorded in `CONTEXT.md`: openpyxl writes no cached formula results
  (`data_only=True` → None); the preview intentionally shows formula strings and
  no LibreOffice recalculation dependency will be added.
- Tests updated for the changed footer/heading (explicit), plus new A4, number
  format, sources-sheet and approval-ordering assertions.
