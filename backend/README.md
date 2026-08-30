# Backend — Phase 7: Local Document Ingestion & Knowledge Base

FastAPI backend that talks **only** to locally running services (Ollama, Docker).
No external AI APIs, no hosted vector stores, no telemetry, no data leaves the
machine.

Every request becomes a **job** with its own id and state, processed
asynchronously by a single background worker. Each job is classified by task
type, routed to the configured local model, scheduled against declared resource
capacity, and executed by a **local agent** that may call workspace-scoped tools,
run generated code in an isolated Docker sandbox, and search the user's **local
knowledge base** of ingested documents:

```
Document Upload -> Ingestion -> Text Extraction -> Chunking
   -> Local Embeddings (Ollama) -> Local Vector Store -> Knowledge Base
   -> document_search tool -> Agent -> grounded answer
```

- `POST /api/chat` returns a `job_id` immediately (202); it never blocks on the model.
- One worker → one active model request at a time; jobs are processed FIFO.
- Multi-user safe: each job retains its `user_id` and only its owner can read/cancel it.
- Model selection is **config-driven** (`config/models.yaml`).
- The **agent loop** is bounded (max iterations / max tool calls), cancellation-aware,
  and records a serializable **execution trace** on the job.
- **Tools** are deny-by-default and operate only inside the job's isolated workspace.
- Generated code runs **only** inside an isolated Docker container — never on the host.
- All state is in-memory (single process). A `JobStore` abstraction is the seam for
  swapping in Redis/Postgres/etc. later.

## Requirements

- Python 3.10+ (developed on 3.13)
- [Ollama](https://ollama.com) running locally with at least one model pulled.
- **Docker** (daemon running) with a local Python image **only if** you enable the
  sandbox (`SANDBOX_ENABLED=true`). The backend never pulls images.

## 1. Install dependencies

From this directory (`backend/`):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows
pip install -r requirements.txt       # runtime deps
pip install -r requirements-dev.txt   # test deps (pytest)
```

## 2. Start Ollama and pull a model

```bash
ollama serve                 # start the server (usually runs automatically)
ollama pull llama3.1         # or any open-weight model you want to use
ollama list                  # confirm the model name
```

Ollama must be reachable at `http://localhost:11434` (default). The backend never
talks to anything else.

## 3. Configure the environment

Copy the example and edit it:

```powershell
Copy-Item .env.example .env
```

Key variables (all optional; defaults shown):

| Variable                 | Default               | Meaning                                       |
| ------------------------ | --------------------- | --------------------------------------------- |
| `OLLAMA_BASE_URL`        | `http://localhost:11434` | Local Ollama endpoint (must stay local)     |
| `DEFAULT_MODEL`          | *(required)*          | Fallback model (see routing below)            |
| `MODELS_CONFIG`          | `../config/models.yaml` | Task-type → model mapping (registry)       |
| `MAX_AGENT_ITERATIONS`   | `10`                  | Max model decisions per job (hard stop)       |
| `MAX_AGENT_TOOL_CALLS`   | `20`                  | Max tool executions per job (hard stop)       |
| `WORKSPACES_ROOT`        | `../data/workspaces`  | Per-job workspace root                       |
| `SANDBOX_ENABLED`        | `false`               | Register the `code_execution` tool           |
| `SANDBOX_PYTHON_IMAGE`   | `python:3.12-alpine`  | Local image used for executions              |
| `SANDBOX_TIMEOUT_SECONDS`| `10`                  | Max execution time (runaway code is killed)  |
| `SANDBOX_CPU_LIMIT`      | `0.5`                 | Docker `--cpus` limit                        |
| `SANDBOX_MEMORY_LIMIT`   | `128m`                | Docker `--memory` limit                      |
| `SANDBOX_MAX_STDOUT_CHARS` / `SANDBOX_MAX_STDERR_CHARS` | `4096` | Output caps per execution    |
| `RESOURCE_CAPACITY_MODE`| `configured`           | `configured` (values below) or `auto` (local discovery) |
| `RESOURCE_CPU_CORES`    | `8`                    | Scheduler CPU capacity                       |
| `RESOURCE_MEMORY_MB`    | `16384`                | Scheduler memory capacity                    |
| `RESOURCE_GPU_VRAM_MB`  | `16384`                | VRAM per GPU (`GPU-0`, `GPU-1`, ...)         |
| `RESOURCE_GPU_COUNT`    | `1`                    | Number of GPUs in capacity                   |
| `KNOWLEDGE_BASE_ROOT`   | `../data/knowledge`    | Per-user KB vector store location            |
| `UPLOADS_ROOT`          | `../data/uploads`      | Uploaded document files (per user)           |
| `CHUNK_SIZE`            | `800`                  | Chunk size (characters)                      |
| `CHUNK_OVERLAP`         | `100`                  | Chunk overlap (characters)                   |
| `EMBEDDING_MODEL`       | `nomic-embed-text`     | Local embedding model on Ollama              |
| `DOCUMENT_SEARCH_DEFAULT_TOP_K` | `5`         | Default results per search                   |
| `DOCUMENT_SEARCH_MAX_TOP_K` | `10`           | Hard cap on results per search               |
| `DOCUMENT_SEARCH_MAX_CHUNK_CHARS` | `1000`   | Chunk text cap fed to the agent              |
| `HOST` / `PORT`          | `127.0.0.1` / `8000`  | FastAPI bind address (localhost only)         |
| `OLLAMA_TIMEOUT_SECONDS` | `120`                 | Per-request timeout for Ollama calls          |
| `LOG_LEVEL` / `LOG_FILE` | `INFO` / `../logs/backend.log` | Structured JSON logging            |

## 3b. Model routing (`config/models.yaml`)

The model registry maps **task types** to **local models**. Edit
`config/models.yaml` — no code changes are needed to add or change a model.

```yaml
models:
  general:
    provider: ollama
    model: qwen2.5:7b
    enabled: true
    capabilities: [general, reasoning, summarization]
    resources:
      gpu_vram_mb: 8000
      cpu_cores: 2
      memory_mb: 4096

  coding:
    provider: ollama
    model: qwen2.5-coder:7b
    enabled: true
    capabilities: [coding, debugging, code_review]
    resources:
      gpu_vram_mb: 8000
      cpu_cores: 2
      memory_mb: 4096

  document:
    provider: ollama
    model: <placeholder>
    enabled: false
    capabilities: [document, summarization]

  vision:
    provider: ollama
    model: <placeholder>
    enabled: false
    capabilities: [vision, image, document]
```

**Task types:** `general` (explanations, reasoning, summaries), `coding`
(programming/scripting/debug requests, code blocks), `document` (reserved for
future file inputs), `vision` (reserved for future image inputs).

**Routing behavior:** the worker classifies each message with **deterministic
rules only** (no LLM is used to classify), then selects the configured **enabled**
model for that task type. The job records both `task_type` and `model`, so the
client can see which model handled its job.

**Adding a model:** pull it into Ollama (`ollama pull <model>`), then add/edit an
entry in `models.yaml`. `enabled: false` entries are never selected.

**Availability:** `/health` reports each task type's configured/enabled/available
status. Startup and job execution never fail just because a model is missing
locally — a job routed to an unavailable model enters the normal lifecycle and
fails cleanly with a useful `error` (the backend never auto-downloads models).

**Failure without fallback:** if a task type has no configured model, or its
model is disabled, the job fails cleanly with a `model_routing_error` — it never
silently falls back to another task type.

## 3c. Agent & local tools

After routing, the **Agent** runs a controlled loop: decide → (optionally call a
tool) → observe → decide again → complete. Termination is deterministic
(`MAX_AGENT_ITERATIONS`, `MAX_AGENT_TOOL_CALLS`); the job is failed cleanly if a
limit is hit. A cancelled job stops the loop as soon as practical.

**Model ↔ tool protocol:** the model is asked (with Ollama `format: json`) to
respond with strict JSON — either `{"type":"final","response":"..."}` or
`{"type":"tool_call","tool":"<name>","arguments":{...}}`. If the model returns
plain (non-JSON) text, it is treated as a final response. Tool name, argument
schema, and workspace path are all validated before anything runs.

**Available tools (Phase 5):**

| Tool            | Description                                              |
| --------------- | -------------------------------------------------------- |
| `list_files`    | List files in the current job workspace.                 |
| `read_file`     | Read a text file from the job workspace.                 |
| `write_file`    | Write text content to a file in the workspace.           |
| `code_execution`| Run generated code in an isolated Docker sandbox (python).|

`code_execution` arguments: `{"language": "python", "code": "...", "stdin": "..."}`.
Only `python` is supported; anything else is rejected. The result surfaces in the
execution trace as `tool_result` (exit code, duration, and stdout/stderr summary),
so the agent can observe and react to it.

## 3d. Docker code-execution sandbox

Generated code runs **only** inside a short-lived Docker container, never on the
host. Enable it with `SANDBOX_ENABLED=true`; the configured image must already be
pulled locally (`docker pull python:3.12-alpine`) — the backend never pulls.

**Security controls (verified by integration tests):**

- `--network none` — no outbound network access
- no `--privileged`; `--cap-drop ALL`; `--security-opt no-new-privileges`
- `--read-only` root filesystem with a writable `tmpfs` for temporary files
- only a temporary directory (containing the generated source) is mounted,
  read-only — never the app workspace, host filesystem, or Docker socket
- CPU (`--cpus`) and memory (`--memory`) limits
- strict execution timeout — runaway loops are killed
- container is removed after every run (`--rm`, plus an explicit `docker rm -f`
  on timeout) — no orphaned containers

**Result:** a structured `ExecutionResult` (`success`, `exit_code`, `stdout`,
`stderr`, `timed_out`, `duration_ms`) with stdout/stderr capped at
`SANDBOX_MAX_STDOUT_CHARS` / `SANDBOX_MAX_STDERR_CHARS`.

**Failure handling:** Docker unavailable, image missing, container-creation
failure, and timeouts all fail cleanly through the existing job lifecycle —
nothing hangs, nothing is auto-downloaded.

**Workspace isolation:** each job gets `data/workspaces/<user>/<job>/`. Tools
reject `..` traversal, absolute paths, and symlink escapes — they can never read
or write outside the job's workspace, reach another user's workspace, or touch
application/system files. Path components are sanitized so a crafted `X-User-ID`
cannot escape the root. Deny-by-default: only registered tools may be executed.

**Execution trace:** every job records an ordered trace on the job object
(`execution_trace`) with entries like `plan`, `tool_call`, `tool_result`, `final`
(step-numbered). Tool results store only a summary, never raw file contents.
`agent_stage`, `iteration_count`, and `tool_call_count` are also exposed via
`GET /api/jobs/{job_id}`.

## 3e. Resource scheduler (Phase 6)

Between routing and execution, a **resource scheduler** decides whether a job can
run based on the selected model's **declared resource requirements** and currently
allocated capacity:

```
queued job → classify → select model → determine requirements → scheduler
           → grant or wait (FIFO) or reject → agent execution → release
```

**Resource model:** a job's requirements come from the model's `resources` block
in `config/models.yaml` (`cpu_cores`, `memory_mb`, `gpu_id`, `gpu_vram_mb`). The
scheduler tracks an allocation per running job and **never exceeds configured
capacity**.

**Capacity** is configured via `RESOURCE_*` env vars (default: 8 cores, 16 GB
RAM, one `GPU-0` with 16 GB VRAM). Set `RESOURCE_CAPACITY_MODE=auto` to use
read-only **local hardware discovery** (CPU count, system memory, and
`nvidia-smi` GPUs when present — no NVIDIA tooling required for tests).

**Behavior:**
- **Grant** — requirements fit; the job runs and records `resource_status:
  allocated`.
- **Wait** — capacity is busy; the job waits **in FIFO order** (no starvation: the
  oldest waiter is granted first when capacity frees).
- **Reject** — a request can never fit (e.g. `Requested 32768 MB VRAM, system
  capacity is 16384 MB`) or references an unknown GPU; the job **fails cleanly**
  instead of waiting forever.
- **Release** — resources are returned on completion, failure, cancellation, or
  timeout; after all jobs finish, allocated resources return to zero (verified by
  tests). A waiting job that is cancelled never receives resources.

The job exposes `resource_status` (`not_required`, `waiting`, `allocated`,
`released`, `rejected`), and `/health` reports a `scheduler` section with queued/
running jobs and allocated CPU/memory/VRAM per GPU. Note: with the current single
worker, jobs execute one at a time, so the scheduler's multi-job concurrency is
primarily enforced at the accounting layer and is exercised deterministically by
the scheduler unit tests (e.g. the five-user scenario: two 8 GB jobs share a
16 GB GPU, the rest wait in FIFO order).

## 3f. Local document knowledge base (Phase 7)

The agent can answer questions grounded in **local organizational documents**
(text-based PDFs, `.txt`, `.md`) without anything leaving the machine:

```
upload → ingest → extract text → chunk → embed (local Ollama) → vector store
       → document_search tool → agent → grounded answer with sources
```

**Ingestion** (`KnowledgeBase`): `pypdf` extracts text from text-based PDFs
(per page); `.txt`/`.md` are read directly. Image-only (scanned) PDFs are
detected and reported as `Document requires OCR` (OCR is a later phase);
malformed/unreadable PDFs fail cleanly.

**Chunking**: deterministic, order-preserving, character-window chunks with
configurable size/overlap (`CHUNK_SIZE`/`CHUNK_OVERLAP`); every chunk keeps its
source `document_id`, `filename`, and page.

**Embeddings**: `EmbeddingProvider` abstraction backed by the local Ollama
server (`/api/embed`, `EMBEDDING_MODEL`) — no external embedding API. A
deterministic fake provider is used in tests.

**Vector store**: per-user JSON files under `KNOWLEDGE_BASE_ROOT/<user>/store.json`
with cosine similarity search — fully local, persistent across restarts, behind
a `VectorStore` abstraction so a real vector DB can be swapped in later.

**Ownership**: the knowledge base is strictly **per-user**. A user's documents
and chunks are never visible to, or searchable by, another user.

**`document_search` tool**: the only gateway the agent has to the knowledge base
(it never touches the vector store directly). Arguments: `{"query": "...",
"top_k": N}`. Returns structured results with `filename`, `document_id`, page,
and similarity score; text is capped (`DOCUMENT_SEARCH_MAX_CHUNK_CHARS`) and
result count is capped (`DOCUMENT_SEARCH_MAX_TOP_K`). When nothing is relevant it
reports `No relevant local documents found`.

**APIs**: `POST /api/documents` (multipart upload → ingest, returns `document_id`,
`filename`, `status`), `GET /api/documents`, `GET /api/documents/{document_id}`,
`DELETE /api/documents/{document_id}`. There is deliberately **no public search
endpoint** — the agent reaches the KB only through the `document_search` tool.

## 4. Run FastAPI

```powershell
.\.venv\Scripts\python.exe -m app.main
# or
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Interactive API docs: http://127.0.0.1:8000/docs

## 5. API

All endpoints accept an optional `X-User-ID` header (development identity). If
absent, the fallback id `user-001` is used. Ownership is enforced: users can only
see/cancel their own jobs.

### Submit a chat job

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d "{\"message\": \"Explain what a refinery heat exchanger does.\"}"
```

Response (job accepted into the queue):

```json
{ "job_id": "job-567589986ecc", "status": "queued" }
```

### Check a job

```bash
curl http://127.0.0.1:8000/api/jobs/job-567589986ecc -H "X-User-ID: user-001"
```

Response (terminal example):

```json
{
  "job_id": "job-567589986ecc",
  "user_id": "user-001",
  "message": "Explain what a refinery heat exchanger does.",
  "task_type": "general",
  "status": "completed",
  "priority": 0,
  "created_at": "2026-08-29T14:57:12.414083Z",
  "started_at": "2026-08-29T14:57:12.414562Z",
  "completed_at": "2026-08-29T14:57:28.017370Z",
  "model": "llama3.1:latest",
  "response": "...",
  "error": null,
  "agent_stage": "completed",
  "iteration_count": 2,
  "tool_call_count": 1,
  "execution_trace": [
    { "step": 1, "type": "agent_started", "task_type": "general", "model": "llama3.1:latest" },
    { "step": 2, "type": "tool_call", "tool": "list_files", "arguments": {} },
    { "step": 3, "type": "tool_result", "tool": "list_files", "result_summary": "1 file(s) found" },
    { "step": 4, "type": "final", "response_summary": "..." }
  ]
}
```

Job states: `queued`, `running`, `completed`, `failed`, `cancelled`.

### List your jobs

```bash
curl "http://127.0.0.1:8000/api/jobs?status=completed&limit=10&offset=0" -H "X-User-ID: user-001"
```

### Cancel a job

```bash
curl -X DELETE http://127.0.0.1:8000/api/jobs/job-... -H "X-User-ID: user-001"
```

Queued **or running** jobs can be cancelled; a running job stops its agent loop
as soon as practical. Terminal jobs cannot be cancelled (409).

### Health / runtime status

```bash
curl http://127.0.0.1:8000/health
```

Includes queue size, job counts by state, worker state/active job, per-task-type
model availability, and a **scheduler** section with queued/running jobs and
allocated CPU/memory/VRAM per GPU:

```json
{
  "ollama": { "reachable": true },
  "models": {
    "general": { "configured": "qwen2.5:7b", "available": true, "enabled": true },
    "coding":  { "configured": "qwen2.5-coder:7b", "available": true, "enabled": true },
    "document": { "configured": "<placeholder>", "available": false, "enabled": false }
  },
  "scheduler": {
    "queued_jobs": 1,
    "running_jobs": 1,
    "allocated": {
      "cpu_cores": 2,
      "memory_mb": 4096,
      "gpu": { "GPU-0": { "allocated_vram_mb": 8192, "capacity_vram_mb": 16384 } }
    }
  },
  "knowledge_base": {
    "documents": 3,
    "chunks": 4,
    "embedding": { "provider": "ollama", "model": "nomic-embed-text" },
    "vector_store": "json"
  }
}
```

## HTTP error responses

| Situation                        | HTTP status | `detail.error`   |
| -------------------------------- | ----------- | ---------------- |
| Invalid request body             | `422`       | (pydantic detail)|
| Job not found                    | `404`       | `job_not_found`  |
| Accessing another user's job     | `403`       | `forbidden`      |
| Cancelling a terminal job        | `409`       | `invalid_state`  |

Ollama/routing/agent failures (unreachable, timeout, model missing, bad payload,
agent limits) are **not** HTTP errors — the job transitions to `failed` and
carries a useful `error` message. Poll `GET /api/jobs/{job_id}` to see the
terminal state.

## Logging

Structured JSON to console and `logs/backend.log` (see `LOG_FILE`). Lifecycle
events (`job_created`, `job_started`, `job_completed`, `job_failed`,
`job_cancelled`), routing events (`registry_loaded`, `model_availability`,
`task_classified`, `model_selected`, `routing_failure`), agent events
(`agent_started`, `agent_completed`, `agent_failed`, `agent_cancelled`,
`tool_call_started`, `tool_call_completed`, `tool_call_failed`), sandbox events
(`code_execution_started`, `code_execution_completed`, `code_execution_failed`,
`code_execution_timeout`, `code_execution_cleanup`), scheduler events
(`resource_requested`, `resource_waiting`, `resource_allocated`,
`resource_released`, `resource_rejected`), and knowledge-base events
(`document_ingestion_started/completed/failed`, `document_deleted`,
`document_search_started/completed/failed`) include `job_id`, `user_id`, `model`,
`task_type`, `tool`, `language`, duration, exit code, resource amounts, and
document metadata where applicable. Confidential prompts, generated responses,
generated source code, full stdout/stderr, file contents, and search chunks are
never logged — only short summaries and metadata are.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest                 # unit + demo tests
.\.venv\Scripts\python.exe -m pytest -m docker       # Docker integration tests
```

Ollama is mocked via `httpx.MockTransport` — no live Ollama needed. Coverage
includes the low-level Ollama client, task classification, model routing and
registry validation, job API/ownership, worker failure states, routing through
the API, workspace isolation and path traversal, the tool system, the agent loop
(limits, cancellation, trace order), end-to-end agent demos (including the
factorial "killer test" and a bug-fix loop), the `code_execution` tool with a
fake runner, a Docker-invocation security test, the resource scheduler (grant/
wait/reject, five-user scenario, release/cleanup, no leaks), scheduler worker
integration, the local knowledge base (ingestion, chunking, OCR detection,
vector store, document_search tool, cross-user isolation, no-contents-in-logs),
a synthetic industrial-document demo, a five-user concurrency scenario, and
**Docker integration tests** (network-blocked, no host fs, no socket, no
privileged, timeout/cleanup) that are skipped explicitly when Docker is
unavailable.
