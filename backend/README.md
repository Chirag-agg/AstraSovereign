# Backend — Phase 1: Local Backend & Model Connection

Minimal FastAPI backend that talks **only** to a locally running Ollama server. No
external AI services, no telemetry, no data leaves the machine.

```
Client ──HTTP──▶ FastAPI Backend ──localhost HTTP only──▶ Ollama ──▶ Local Model
```

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
ollama pull qwen2.5          # or any open-weight model you want to use
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

| Variable                 | Default               | Meaning                                        |
| ------------------------ | --------------------- | ---------------------------------------------- |
| `OLLAMA_BASE_URL`        | `http://localhost:11434` | Local Ollama endpoint (must stay local)      |
| `DEFAULT_MODEL`          | *(required)*          | Model used by `/api/chat` (must exist in Ollama) |
| `HOST` / `PORT`          | `127.0.0.1` / `8000`  | FastAPI bind address (localhost only)         |
| `OLLAMA_TIMEOUT_SECONDS` | `120`                 | Per-request timeout for Ollama calls          |
| `LOG_LEVEL` / `LOG_FILE` | `INFO` / `../logs/backend.log` | Structured JSON logging               |

## 4. Run FastAPI

```powershell
.\.venv\Scripts\python.exe -m app.main
# or
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Interactive API docs: http://127.0.0.1:8000/docs

## 5. Example requests

Health (reports backend + Ollama status):

```bash
curl http://127.0.0.1:8000/health
```

Chat:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Explain what a refinery heat exchanger does.\"}"
```

Example response:

```json
{
  "response": "...",
  "model": "qwen2.5:7b",
  "status": "success"
}
```

## Error responses

| Situation                          | HTTP status | `detail.error`              |
| ---------------------------------- | ----------- | --------------------------- |
| Ollama unreachable                 | `503`       | `ollama_unavailable`        |
| Ollama request timed out           | `504`       | `ollama_timeout`            |
| Configured model missing on Ollama | `502`       | `model_not_found`           |
| Ollama returned bad response       | `502`       | `ollama_request_error`      |
| Unexpected backend error           | `500`       | `internal_error`            |
| Invalid request body               | `422`       | (pydantic validation detail)|

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Tests mock the Ollama HTTP API via `httpx.MockTransport` — no live Ollama needed.
