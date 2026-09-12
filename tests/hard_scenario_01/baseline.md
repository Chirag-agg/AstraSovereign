# Hard Scenario 01 — baseline (first full run)

- Run: 2026-09-12T13:17Z, job `job-a8aa917691ac`
- Model: `qwen2.5-coder:3b` only (task classified `general`)
- **Score 3/20 — not finale-ready.** Trap not tripped (Course 5 was never mentioned,
  so nothing was fabricated for it) but the whole chain failed.
- Artifacts: one `.docx` only; no `.xlsx`, no `.pptx`.
- 6 iterations, 5 tool calls, 2 failed.

Transient run outputs (result JSON, job trace, generated deliverables) are written
to `bench/results/` which is gitignored; this file keeps the durable summary.

## What happened

**Routing — the auto-selection claim is not demonstrated.** The job used a single
model (`general`/`qwen2.5-coder:3b`). No vision step, no document model, no coding
model. The scanned reports and nameplate were never passed to `document_vision`.

**Extraction — zero.** No thickness readings, no inch→mm conversion, no handwritten
Course 5 value, no nameplate geometry. The agent called `document_search` once but
never read the scanned material, so it had no numbers to work from.

**Retrieval — the distractor won.** `document_search` returned chunks from three
documents including `SOP-09_Rev2.pdf`, and the approval note cites **both Rev 2 and
Rev 3**. Supersession is not enforced.

**Computation — hallucinated.** The note states "Corrosion Rate = 10 mm/year" for
courses 1–3 with no basis, and applies the Rev 2 **10-year** interval cap. Two
`code_execution` calls failed (unterminated f-strings in generated code); the one
that succeeded never fed the document. `code_execution` did run in the sandbox, so
the sandbox itself works — the wiring of its output into the deliverable does not.

**Planning — one deliverable.** Only a Word file; no spreadsheet, no deck. The final
step leaked a `tool_call` JSON as the final response.

**The trap — 0/4.** Course 5 is not addressed at all: no referral, no reason. No
fabricated Course 5 rate, but inventing 10 mm/year for courses 1–3 is the same class
of failure.

**Approval note quality — wrong.** Wrong reference/date, "no signs of deterioration"
and "no action required", no thresholds, no P&ID image, no Course 5 referral.

## Ingestion-week specification (priority order)

1. **Extraction / vision first.** Route scanned reports and the nameplate to
   `document_vision` (or a findings extractor) and ground every number in OCR/vision
   output. Without extraction nothing downstream can succeed. This is OCR quality
   plus the ingest → findings contract.
2. **Retrieval ranking second.** Rev 2 must not surface or be cited when Rev 3 is
   present: record supersession at ingestion and rank the current revision first.
3. **Grounded computation and planning third.** One findings object → sandbox
   calculation → three deliverables; no number may enter a deliverable except from
   the findings object. Reject ungrounded prose values.
4. **Generalise the verifier guard.** The automatic fail currently covers Course 5
   only; extend the "no invented number" rule to every course.

## Reproduce

```
backend\.venv\Scripts\python.exe tests\hard_scenario_01\build_fixtures.py
backend\.venv\Scripts\python.exe tests\hard_scenario_01\run_scenario.py
```

The fixtures are generated (gitignored) and the results land in `bench/results/`
(gitignored).

## Run series — do not read as regression

| Run | Path exercised | Score | Note |
|---|---|---|---|
| 2026-09-12 (queue) | worker + single agent | 3/20 | scored points for fabricated corrosion rates and a note built from nothing |
| 2026-09-12 (node-direct) | `NodeAgent` in-process | 0/20 | produced nothing, and said why: explicit `node_degraded` (no vision tool, no search) |

The score went **down** because the node engine refuses to produce ungrounded
deliverables. An honest 0 that names the failure is the right direction from a 3
that fabricated; read the trace, not just the number. Subsequent entries in
`bench/results/` should record the same path and note so the series is legible.

