# Developer Onboarding Runbook

Goal: go from a fresh clone to running the flagship demo in under 30 minutes.

## 1. Prerequisites

- **Git** (2.50+) — set your identity and commit signing (see
  [CONTRIBUTING.md](../CONTRIBUTING.md)).
- **Python 3.13**
- **Node.js 22** (with npm)
- **Ollama** running locally at `http://localhost:11434`
- Optional: **Docker** (only needed for the code-execution sandbox and the
  docker-marked integration tests; the rest of the suite skips them if absent)

## 2. Clone and install

```powershell
git clone https://github.com/Chirag-agg/AstraSovereign.git
cd AstraSovereign
```

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
Copy-Item .env.example .env        # then edit DEFAULT_MODEL (see below)
```

### Frontend

```powershell
cd frontend
npm install
```

## 3. Local models

Pull the models your config needs (see `config/models.yaml`) plus an embedding
model:

```powershell
ollama pull llama3.1        # general/reasoning
ollama pull llama3           # coding
ollama pull nomic-embed-text # embeddings (required for the knowledge base)
# optional, for vision (document_vision tool):
ollama pull llava:7b
```

Set `DEFAULT_MODEL` in `backend/.env` to the general model you pulled. The
backend never auto-downloads models — a job for a missing model fails cleanly.

## 4. Run

```powershell
# backend (from backend/)
.\.venv\Scripts\python.exe -m app.main          # http://127.0.0.1:8000

# frontend (from frontend/)
npm run dev                                      # http://localhost:3000
```

Check the stack: `curl http://127.0.0.1:8000/health` (Ollama reachable, models
available, multimodal/document-generation status).

## 5. Tests

```powershell
# backend
cd backend; .\.venv\Scripts\python.exe -m pytest

# frontend
cd frontend; npm run typecheck; npm test; npm run build
```

CI runs the same checks on every push/PR.

## 6. Flagship demo (inspection → approval note)

1. Open `http://localhost:3000`, select a dev user (`user-001`).
2. Under **Documents**, upload a scanned inspection report (PDF/PNG — it will be
   OCR'd) and a maintenance procedure (`.txt`/`.md`). Or generate demo files with
   the synthetic generator (issue #11, when implemented).
3. Submit this task:

   > Review the inspection report against the maintenance procedure, identify any
   > issues requiring attention, and create an approval note.

4. Watch `QUEUED → RUNNING → COMPLETED` and the agent trace
   (`document_search` → `document_vision` → `document_generation`).
5. Download the generated `approval_note.docx` from the job's **Generated files**.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/health` shows models unavailable | `ollama pull <model>` (names come from `config/models.yaml`) |
| Jobs fail with `model_routing_error` | model name/`enabled` in `config/models.yaml` or a missing model |
| Frontend can't reach backend | backend running on `:8000` and `CORS_ORIGINS` includes `http://localhost:3000` |
| `document_vision` fails | no vision model pulled / not enabled in config (clean failure is expected) |

More detail: [`backend/README.md`](../backend/README.md),
[`frontend/README.md`](../frontend/README.md), [`CONTEXT.md`](../CONTEXT.md).
