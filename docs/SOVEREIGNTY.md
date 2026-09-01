# Sovereignty, Audit, and Network Evidence (Phase 11)

The system's sovereign claim is "confidential data and AI processing remain
on-premise and external network access is prevented." This document explains
**exactly** what is enforced, what is verified, and what cannot be verified
automatically — without overclaiming.

```
User ──► Sovereign Workbench ──► Network boundary ──► Internet: BLOCKED
            │  Models     LOCAL (Ollama, localhost)
            │  OCR        LOCAL (RapidOCR/ONNX, telemetry disabled)
            │  RAG        LOCAL (per-user JSON vector store)
            │  Vision     LOCAL (Ollama multimodal model, localhost)
            │  Sandbox    OFFLINE (Docker --network none)
            │  Files      LOCAL (workspaces / uploads / artifacts / audit)
            └─► Audit trail (append-only JSONL) + NetworkGuard evidence
```

## What is enforced (architecture)

- **Every outbound HTTP request** the backend makes goes through a
  `NetworkGuard` (`backend/app/services/network_guard.py`) via a guarded httpx
  transport. Loopback and the configured local service endpoint (Ollama) are
  permitted; **any other destination is recorded and blocked** by default
  (`ExternalNetworkBlocked`), so no external request can succeed.
- The **Docker sandbox** runs generated code with `--network none` and no
  privileges — outbound connections from sandboxed code fail.
- **Startup never downloads**: no AI models, no Docker images, no remote config,
  no telemetry are fetched automatically. Locally installed models/images are
  required (documented in the READMEs).
- **onnxruntime telemetry is disabled** (`ORT_TELEMETRY_ENABLED=0`) so the local
  OCR engine makes no outbound call.

## What is verified (evidence)

- **Audit trail** (`data/audit/audit.jsonl`): every meaningful operation emits a
  non-sensitive audit event — job lifecycle, model selection, model calls,
  tool calls, document ingestion/search, OCR, vision, sandbox, document
  generation, resource allocation/release. Events carry only identifiers and
  small metadata (never prompts, responses, document contents, OCR/vision text,
  source code, or secrets).
- **`/api/sovereignty`** and `/health.sovereignty` report real state:
  - `local_model_calls` — count of `MODEL_CALL_COMPLETED` audit events.
  - `external_connections.status` — `VERIFIED_LOCAL` when the guarded clients
    have made calls and none were external; `VERIFIED_EXTERNAL` only if an
    external call actually succeeded (possible only if the guard is configured
    not to block); `UNKNOWN` when no traffic has been observed yet. No value is
    fabricated.
  - `external_connections.count` — external calls that succeeded (0 with the
    default blocking policy); `blocked_attempts` — external attempts blocked.
- The UI shows only these verified values.

## What cannot be verified automatically

- **OS-level packet capture is not used** (requires privileged tooling). The
  NetworkGuard proves the *application's own HTTP clients* cannot reach external
  hosts; it does not instrument third-party libraries that do not use the
  guarded clients.
- Dependencies are reviewed (below) for known outbound behavior; telemetry is
  disabled where present. This is a documented review, not a sandbox guarantee
  for every transitive package.

## Dependency / startup review

| Component | Network behavior | Mitigation |
| --- | --- | --- |
| `httpx` (Ollama/embedding/vision clients) | HTTP | only the guarded localhost client is used; external blocked by `NetworkGuard` |
| `fastapi` / `uvicorn` | inbound HTTP server only | no outbound |
| `pypdf`, `pillow`, `pypdfium2`, `reportlab`, `python-docx` | none | — |
| `rapidocr-onnxruntime` / `onnxruntime` | usage telemetry | disabled via `ORT_TELEMETRY_ENABLED=0` |
| `pydantic`, `pyyaml`, `numpy`, `opencv-python` | none | — |
| Next.js / React (frontend) | browser fetch to the local backend only | no telemetry added |
| Ollama (external binary) | listens on localhost; called by the guarded client | allowed endpoint is localhost |

## How to inspect audit evidence

- File: `data/audit/audit.jsonl` (append-only; one JSON object per line).
- API (user-scoped): `GET /api/audit?job_id=...&limit=...&offset=...` and
  `GET /api/jobs/{job_id}/audit`.
- Status: `GET /api/sovereignty` or `/health`.

## How to run the sovereignty demo

1. Start the backend and frontend (see `docs/ONBOARDING.md`).
2. Open the workbench, upload a scanned inspection report + a maintenance
   procedure, submit the approval-note task.
3. Watch the job's **Audit trail** (Job created → Model selected → Local
   inference → document_search → OCR → document_vision → document_generation →
   Job completed) and the **Sovereignty** panel (Network policy LOCAL_ONLY,
   External network VERIFIED_LOCAL · 0 external, Audit logging ENABLED).
4. Verify the sandbox: the docker-marked integration test
   (`backend/tests/test_sandbox_docker.py`) proves `--network none` blocks an
   outbound attempt from generated code.
