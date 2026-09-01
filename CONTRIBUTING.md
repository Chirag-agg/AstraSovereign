# Contributing to AstraSovereign

The **Sovereign On-Premise Agentic AI Workbench** is an air-gapped, local-only
agentic AI system. Thanks for contributing!

Before you start:

- Read [CONTEXT.md](CONTEXT.md) — the authoritative project memory. Every
  significant change must update it.
- Read [AGENTS.md](AGENTS.md) — AI execution constraints (route initial
  scanning/boilerplate to `deepseek-v4-flash`, deep math/unit-test-loop/structural
  bugs to `gpt-5.6-sol`, and **do not add dependencies unless explicitly
  requested**).
- New to the machine? Follow the [onboarding runbook](docs/ONBOARDING.md).

## Branch workflow

1. Create a branch from `main`: `feat/<issue-num>-<short-name>` (or
   `fix/<issue-num>-<short-name>`).
2. Make small, focused commits. Commits are **signed** (SSH) — set up your
   signing key so your commits show as Verified.
3. Open a pull request to `main` using the PR template and reference the issue
   (e.g. "Closes #12").
4. CI (`.github/workflows/ci.yml`) runs backend `pytest` + frontend
   typecheck/tests/build on every push and PR — the PR must be green before
   merge.

## Development commands

Backend (Python 3.13):

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest        # full suite (docker-marked tests auto-skip)
.\.venv\Scripts\python.exe -m app.main      # run the server
```

Frontend (Node 22):

```powershell
cd frontend
npm run typecheck      # tsc --noEmit
npm test               # Vitest (mocked backend)
npm run build          # Next.js production build
npm run dev            # local dev server
```

## Rules of thumb

- Preserve existing behavior and tests. Add tests for new behavior (frontend
  tests mock the backend API).
- No new dependencies/NPM modules unless explicitly requested in the issue or by
  a maintainer.
- All processing stays local — no external AI APIs, no telemetry, no data leaving
  the machine.
- Never commit secrets or `.env` files.
- Keep changes scoped to an issue; for spikes/prototypes use the `spike` label
  and do not change default behavior.
- Significant changes update `CONTEXT.md` (and relevant READMEs).

## Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) (this file)
- [Onboarding runbook](docs/ONBOARDING.md)
- [Cleanup / retention policy](docs/CLEANUP.md)
- `CONTEXT.md` — authoritative project state and phase plan
