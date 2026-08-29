# Backend — Phase 4: Agentic Pipeline & Local Tool Calling

FastAPI backend that talks **only** to a locally running Ollama server. No
external AI services, no telemetry, no data leaves the machine.

Every request becomes a **job** with its own id and state, processed
asynchronously by a single background worker. Each job is classified by task
type, routed to the configured local model, and executed by a **local agent**
that may call workspace-scoped tools:

```
Client ──HTTP──▶ FastAPI ──▶ Job Manager ──▶ Queue ──▶ Worker ──▶ Task Router
                                                                    │
                                                                    ▼
                                                               Model Router
                                                                    │
                                                                    ▼
                                                                  Agent
                                                          ┌───────┼───────┐
                                                          ▼       ▼       ▼
                                                     ToolRegistry (list_files / read_file / write_file)
                                                          │
                                                          ▼
                                                     Job Workspace (data/workspaces/<user>/<job>/)
                                                                    │
                                                                    ▼
                                                          OllamaService ──▶ Local Model
```

- `POST /api/chat` returns a `job_id` immediately (202); it never blocks on the model.
- One worker → one active model request at a time; jobs are processed FIFO.
- Multi-user safe: each job retains its `user_id` and only its owner can read/cancel it.
- Model selection is **config-driven** (`config/models.yaml`).
- The **agent loop** is bounded (max iterations / max tool calls), cancellation-aware,
  and records a serializable **execution trace** on the job.
- **Tools** are deny-by-default and operate only inside the job's isolated workspace.
- All state is in-memory (single process). A `JobStore` abstraction is the seam for
  swapping in Redis/Postgres/etc. later.

## Requirements

- Python 3.10+ (developed on 3.13)
- [Ollama](https://ollama.com) running locally with at least one model pulled.

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

  coding:
    provider: ollama
    model: qwen2.5-coder:7b
    enabled: true
    capabilities: [coding, debugging, code_review]

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

**Available tools (Phase 4):**

| Tool         | Description                                    |
| ------------ | ---------------------------------------------- |
| `list_files` | List files in the current job workspace.       |
| `read_file`  | Read a text file from the job workspace.       |
| `write_file` | Write text content to a file in the workspace. |

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

Includes queue size, job counts by state, worker state/active job, and per-task-type
model availability:

```json
{
  "ollama": { "reachable": true },
  "models": {
    "general": { "configured": "qwen2.5:7b", "available": true, "enabled": true },
    "coding":  { "configured": "qwen2.5-coder:7b", "available": true, "enabled": true },
    "document": { "configured": "<placeholder>", "available": false, "enabled": false }
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
`task_classified`, `model_selected`, `routing_failure`), and agent events
(`agent_started`, `agent_completed`, `agent_failed`, `agent_cancelled`,
`tool_call_started`, `tool_call_completed`, `tool_call_failed`) include
`job_id`, `user_id`, `task_type`, `model`, `tool`, and iteration counts where
applicable. Confidential prompts, generated responses, and file contents are
never logged.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Ollama is mocked via `httpx.MockTransport` — no live Ollama needed. Coverage
includes the low-level Ollama client, task classification, model routing and
registry validation, job API/ownership, worker failure states, routing through
the API, workspace isolation and path traversal, the tool system, the agent loop
(limits, cancellation, trace order), an end-to-end agent demo, and a five-user
concurrency scenario.
