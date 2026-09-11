# AstraSovereign: On-Premise Sovereign AI Workbench

A completely **self-hosted, air-gapped** AI workbench engineered for high-security industrial, defense, legal, financial, and governmental operations. Everything runs strictly locally — open-weight models, dynamic task routers, agent tools, document intelligence, isolated code sandboxes, and native office deliverables — with **zero cloud APIs, zero telemetry, and zero data leaving the local network**.

---

## 🔒 Hard Constraints & Sovereign Principles

- **Zero Cloud APIs**: No data or inference requests ever leave the on-premise hardware.
- **Strict Egress Lockdown**: Outbound network connections outside local loopback and the configured Ollama host are blocked at the transport layer (`0 bytes egress`).
- **Multi-Model Orchestration**: Dynamic task routing across local open-weight LLMs, coding models, and multimodal vision backends (Ollama).
- **Multi-Tier Authorization (L1–L4)**: Cryptographic, hierarchical sign-off protocols governing confidential deliverables.
- **Isolated Code Sandbox**: Ephemeral Docker containers running untrusted code with `--network none`, read-only roots, and no host filesystem mounts.
- **Tamper-Evident Auditing**: Immutable append-only audit trail logging every model call, tool invocation, and clearance event.

---

## 🏛️ System Architecture

```
AstraSovereign/
├── backend/
│   ├── app/
│   │   ├── api/            # REST API (chat, jobs, documents, artifacts, audit, admin, cowork)
│   │   ├── services/       # Ollama, Task Router, Model Registry, Agent Loop, Sandbox, OCR, RAG
│   │   ├── config.py       # Pydantic environment configuration (.env)
│   │   └── main.py         # FastAPI application entrypoint (app.main:app)
│   ├── requirements.txt    # Production Python dependencies
│   └── tests/              # Pytest unit and integration test suite
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js 14 App Router (pages: /, /admin, /cowork)
│   │   ├── components/     # LandingPage, Login, TopBar, Sidebar, WorkConsole, Workbench views
│   │   └── lib/            # Typed API client, polling hooks, types
│   ├── package.json        # Next.js, React, Tailwind CSS, Lucide icons
│   └── vitest.config.ts    # Frontend testing suite
├── config/
│   └── models.yaml         # Config-driven task-type to local model mappings & VRAM limits
└── data/                   # Git-ignored local storage (uploads, workspaces, vectors, audit logs)
```

---

## 🌟 Core Features & Modules

### 1. Modern Public Landing Page & Passkey Authentication
- **Public Hero Portal**: Sleek dark/light theme with interactive terminal verification preview, defense-grade capability cards, and live air-gap status.
- **Secure Authentication**: Passkey/password verification with role-based identity switching (`admin-001`, `user-001` to `user-005`) and instant session persistence.

### 2. Customizable Top Bar for Workers
- **Custom Tab Pinning**: Clicking the **`+`** icon on the top navigation bar allows workers to pin custom workspace views (e.g. *Air-Gap OCR*, *Finance Audit*, *Docker Sandbox*, *Team Roster*) directly into their horizontal tab bar.
- **Client Persistence**: Custom tabs persist across sessions in `localStorage`.

### 3. Role Hierarchy & Task Delegation
- **System Administrators (`admin-001`)**:
  - Unrestricted cross-department work order dispatching across all 6 departments.
  - Staff onboarding via the **`+ Add Employee`** modal.
  - Granular security clearance and role delegation (`L1` to `L4`).
- **Department Managers & Leads (`user-001`, `user-002`, `user-003`, `user-005`)**:
  - Authorized to delegate work orders to junior specialists and operators within their specific department.
  - Review and sign off on completed deliverables.
- **Junior Operators & Contributors (`user-004`)**:
  - Work execution, self-assigned drafts, and deliverable submission for managerial authorization.

### 4. Department Coworking Space & L1–L4 Sign-Off Workflows
- **Hierarchical Clearance Badges**:
  - `L1: Contributor` (Operator task completion)
  - `L2: Reviewer` (Specialist technical check)
  - `L3: Dept Lead` (Department Head sign-off)
  - `L4: Sovereign Officer` (Cryptographic air-gap release)
- **Deliverable Submissions**: Attach Word (`.docx`), Excel (`.xlsx`), or PDF files with memos routed up the authorization chain.
- **Monthly Analytics Chart**: Track completed vs. in-progress deliverables across departments.
- **Active Staff Directory**: Real-time presence indicators and immutable live authorization feeds.

### 5. Conversational Assistant for Non-Technical Users
- **Home Page Inline Chatbot**: Non-technical team members can type natural-language requests into the Home prompt box and receive formatted answers directly below the search bar without navigating into the technical workspace.
- **Features**: Live step indicators, clean text rendering, one-click copy, conversation history, and an *"Open in Technical AI Assistant"* jump button for power users.

### 6. Claude Code / Antigravity Live Terminal
- **Real-Time Technical Stream**: Designed after modern live engineering terminals (macOS traffic dots, live process timers, air-gap tags).
- **Execution Tracking**: Shows model routing, stage decomposition, live command invocations (`$ tool:exec`), duration counters, and terminal status pills (`RUNNING`, `DONE`, `FAILED`).

### 7. Isolated Docker Code Execution Sandbox
- **Zero-Egress Container Runtime**: Executes model-generated Python code in short-lived, isolated Docker containers with `--network none` and read-only filesystems.
- **Terminal Streaming**: Real-time console logs, execution presets, and automatic container teardown on completion or timeout.

### 8. Local Document Intelligence & OCR
- **Offline Multimodal Vision**: Scanned PDF pages and images rendered via `pypdfium2` and normalized with Pillow.
- **RapidOCR Engine**: Fully local OCR extraction with bounding box coordinates and confidence scoring.
- **Encrypted Local RAG**: Deterministic text chunking and local embeddings (`nomic-embed-text` / `bge-large`) backed by a per-user cosine vector store.

### 9. Native Office Deliverables (.docx, .xlsx, .pptx)
- **Word Generation (`.docx`)**: Structured documents with formatted headings, tables, bulleted lists, and citations via `python-docx`.
- **PowerPoint Generation (`.pptx`)**: Multi-slide executive briefings created using `PptxGenJS`.
- **Excel Ledgers (`.xlsx`)**: Structured calculation sheets with formulas.

### 10. Regulatory Compliance & Downloadable Audit Reports
- **Immutable JSONL Audit Trail**: Every request, model call, tool execution, and deliverable sign-off is logged with metadata and cryptographic IDs.
- **One-Click Exports**: Download filtered or full audit reports in **`Export CSV`** or **`Export JSON`** formats for compliance inspections.

---

## 🚀 Quickstart Guide

### Prerequisites
1. **Python 3.11+** (Python 3.12 or 3.13 recommended)
2. **Node.js 18+** (Node 20 or 22 recommended)
3. **Ollama** installed locally (`http://localhost:11434`) with desired models:
   ```bash
   ollama pull qwen2.5:7b
   ollama pull qwen2.5-coder:7b
   ollama pull llama3:latest
   ollama pull llava:7b
   ```
4. **Docker Desktop** (optional, required only for Phase 5 code sandbox execution)

---

### Step 1: Start the Backend Service

```powershell
# Navigate to the backend directory
cd backend

# Activate your virtual environment (or create with python -m venv venv)
.\venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r requirements.txt

# Start the FastAPI Uvicorn server on port 8000
python -m uvicorn app.main:app --reload --port 8000
```

*The backend health endpoint is available at `http://localhost:8000/health`.*

---

### Step 2: Start the Frontend Workbench

In a separate terminal:

```powershell
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Next.js development server on port 3000
npm run dev
```

*Open your browser and navigate to **`http://localhost:3000`**.*

---

## 🔑 Pre-Configured Department Profiles

For testing and demonstration, pre-configured roles are available at login:

| User ID | Name | Department | Role & Clearance | Task Assignment Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`admin-001`** | Security Officer & Admin | Security & Directorate | System Administrator (`L4`) | **Full Cross-Department Allocation** |
| **`user-001`** | Senior Legal Counsel | Legal & Contracts | Department Lead (`L3`) | **Legal Junior Staff Delegation** |
| **`user-002`** | Lead Financial Analyst | Finance & Accounting | Finance Lead (`L4`) | **Finance Junior Staff Delegation** |
| **`user-003`** | Chief Compliance Auditor | HR & Compliance | Compliance Lead (`L2`) | **Compliance Delegation** |
| **`user-004`** | Supply Operations Specialist | Operations & Supply | Operations Specialist (`L1`) | **Operator Self-Assignment Drafts** |
| **`user-005`** | Infrastructure Lead | AI & Engineering | AI Architect (`L4`) | **Engineering Delegation** |

> **Default Passkey**: `sovereign2026`

---

## 🧪 Verification & Testing

### Frontend Typecheck & Build:
```powershell
cd frontend
npm run typecheck
npm run build
```

### Backend Test Suite:
```powershell
cd backend
pytest tests/
```

---

## 📄 License & Confidentiality

This software is designed exclusively for on-premise, air-gapped sovereign installations. No components communicate with public internet services.

---

## Current project state (authoritative)

> The marketing copy above describes the vision; this section is the accurate,
> up-to-date description of what actually ships in this repository.

### Stack
- **Backend**: FastAPI + Uvicorn + Pydantic-settings (Python). Local model runtime: Ollama.
- **Frontend**: Next.js 16 (Turbopack) + React + TypeScript + Tailwind CSS v4 + lucide-react.
- **PowerPoint renderer**: local Node/PptxGenJS component under `presentation/`.

### Pages (routes)
- `/` — Landing page → sign-in → the unified workbench with sections:
  Home, Coworking Space, AI Assistant (with real **Workspace Files** from the job
  workspace), Code Sandbox, Task History, Knowledge Base, Deliverables,
  Models & Routing, Local Tools, Agent Pipelines, Compute & VRAM, System Health,
  Audit Trail, Team & Roles, Security.
- `/cowork` — persistent project IDE (files, editor, chat, live execution).
- `/admin` — operations console (admin role).

### Backend features
- Jobs: `JobManager`/queue/worker with typed lifecycle (queued→running→completed/
  failed/cancelled), cancellation, per-user isolation, durable snapshots.
- Routing: `TaskRouter` (rule-based) → `ModelRouter`/`CapabilityRouter` (config
  from `config/models.yaml`). Multi-model **pipeline** decomposes complex requests
  into capability stages (reasoning, math, coding, document, vision, presentation),
  each on a different local model.
- Agent + ToolRegistry tools: `list_files/read_file/write_file`,
  `document_search` (RAG KB), `document_vision` (local OCR+vision),
  `code_execution` (isolated Docker sandbox, `--network none`),
  `document_generation` (Word .docx), `presentation_generation` (PptxGenJS .pptx).
- `ResourceScheduler` (CPU/memory/GPU accounting), `ArtifactStore` + secure
  artifact download, `NetworkGuard` (default-deny external egress) + sovereignty
  reporting, append-only audit trail, `RapidOCR` + Ollama vision, per-user
  knowledge base, Cowork projects + persistent context manager, `POST /api/sandbox/run`
  (user-scoped, 503 when sandbox disabled), artifact/document preview endpoints,
  and a dev admin API (`/api/admin/*`).

### Running it
- Backend: `cd backend` then `\.venv\Scripts\python -m uvicorn app.main:app`
  (Ollama up; Docker up for code sandbox; `cd presentation && npm install` for
  PowerPoint generation).
- Frontend: `cd frontend && npm install && npm run dev` → http://localhost:3000.

### Tests & checks
- Backend: `pytest` (full suite, incl. sandbox docker-marked, cowork, presentation).
- Frontend: `npm run typecheck`, `npm test` (63), `npm run build`.
- CI runs backend pytest + frontend typecheck/tests/build on every push.

### Notes
- `/preview` and the old ported `sih/` preview UI were removed in favor of the
  unified workbench.
- The repository shows a high TypeScript percentage because the frontend is a
  large TypeScript codebase, not because of stale/duplicate pages.
