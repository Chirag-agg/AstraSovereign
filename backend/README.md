# Backend — Phase 2: Job Manager & Multi-User Queue

FastAPI backend that talks **only** to a locally running Ollama server. No
external AI services, no telemetry, no data leaves the machine.

Every request becomes a **job** with its own id and state, processed
asynchronously by a single background worker:

```
Client ──HTTP──▶ FastAPI ──▶ Job Manager ──▶ Queue ──▶ Worker ──▶ Ollama ──▶ Local Model
```

- `POST /api/chat` returns a `job_id` immediately (202); it never blocks on the model.
- One worker → one active Ollama request at a time; jobs are processed FIFO.
- Multi-user safe: each job retains its `user_id` and only its owner can read/cancel it.
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
| `DEFAULT_MODEL`          | *(required)*          | Model used by jobs (must exist in Ollama)     |
| `HOST` / `PORT`          | `127.0.0.1` / `8000`  | FastAPI bind address (localhost only)         |
| `OLLAMA_TIMEOUT_SECONDS` | `120`                 | Per-request timeout for Ollama calls          |
| `LOG_LEVEL` / `LOG_FILE` | `INFO` / `../logs/backend.log` | Structured JSON logging            |

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
  "error": null
}
```

Job states: `queued`, `running`, `completed`, `failed`, `cancelled`.

### List your jobs

```bash
curl "http://127.0.0.1:8000/api/jobs?status=completed&limit=10&offset=0" -H "X-User-ID: user-001"
```

### Cancel a queued job

```bash
curl -X DELETE http://127.0.0.1:8000/api/jobs/job-... -H "X-User-ID: user-001"
```

### Health / runtime status

```bash
curl http://127.0.0.1:8000/health
```

Includes queue size, job counts by state, and worker state/active job.

## HTTP error responses

| Situation                        | HTTP status | `detail.error`   |
| -------------------------------- | ----------- | ---------------- |
| Invalid request body             | `422`       | (pydantic detail)|
| Job not found                    | `404`       | `job_not_found`  |
| Accessing another user's job     | `403`       | `forbidden`      |
| Cancelling a non-queued job      | `409`       | `invalid_state`  |

Ollama-side failures (unreachable, timeout, model missing, bad payload) are **not**
HTTP errors — the job transitions to `failed` and carries a useful `error` message.
Poll `GET /api/jobs/{job_id}` to see the terminal state.

## Logging

Structured JSON to console and `logs/backend.log` (see `LOG_FILE`). Lifecycle
events (`job_created`, `job_started`, `job_completed`, `job_failed`,
`job_cancelled`) include `job_id`, `user_id`, and `status`. Confidential prompts
and generated responses are never logged.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Ollama is mocked via `httpx.MockTransport` — no live Ollama needed. Coverage
includes the low-level Ollama client, job API/ownership, worker failure states,
and a five-user concurrency scenario.
