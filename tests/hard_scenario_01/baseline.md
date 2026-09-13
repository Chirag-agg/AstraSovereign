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
| 2026-09-12 (node-direct v2) | per-node tool scoping + system/user split | 0/20 | retrieve in scope (no generator misuse); extract fires `document_search` but never chains to `document_vision`, so no findings |

The score went **down** because the node engine refuses to produce ungrounded
deliverables. An honest 0 that names the failure is the right direction from a 3
that fabricated; read the trace, not just the number. Subsequent entries in
`bench/results/` should record the same path and note so the series is legible.

## Node-direct run — attachment manifest end to end (Task C)

Run 2026-09-13T07:49Z, job `job-b5cb78dbc315`. **Score 1/20**, trap passed
(vacuously; Course 5 was never reached). `legacy_envelope_used = {}` — native tool
calling only, no fallback.

| node | capability | model | conf | iters | tool calls | outcome | reason |
|---|---|---|---|---|---|---|---|
| extract | document | llama3.1:latest | 1.0 | 3 | 1 (`document_search`, query "previous reply") | degraded | no typed findings were produced |
| retrieve | document | llama3.1:latest | 1.0 | 1 | 0 | degraded | document_search was not invoked |
| compute | — | — | — | — | — | skipped | no typed findings to compute from |
| draft | — | — | — | — | — | skipped | nothing grounded to draft from |

**Nameplate (the point of Task A).** The manifest reached extract (extract ran
because attachments exist), but **no `document_vision` call targeted
`tank204_nameplate.jpg`** (`vision_targets` empty). A *direct* `document_vision`
call on the nameplate succeeded: RapidOCR read the full geometry — **D 25.0 m,
H 13.0 m, SG 0.85, S 137 MPa, E 0.85** — while llava's observation was vague. So
the nameplate is readable and the vision tool works; the failure is the agent
*choosing* to call it, not the tool or the OCR (a week-5 model/noise question,
not plumbing).

**Against the task's expectation:** expected vision-on-nameplate with the
readings table still missing (page-2 retrieval). Actual: vision not called, and
retrieve degraded without searching. So extract remains the gap — the model emits
a junk search query and never chains — and retrieval did not run at all this time.

Record: `bench/results/20260913T074930Z_hard_scenario_01_nodes.json` (gitignored).

## Node-direct re-run — clean job-scoped manifest (Task C follow-up)

A raw dump of the `messages` sent to `extract` and `retrieve` disproved the
"dangling reference" hypothesis: the task text is present in the user message
(`REQUEST: Assess Tank 204 …`), and there is no reference to a previous step.

The real fault was the **manifest**. It listed *every* document the user had (65
entries) — the fixtures duplicated many times over plus unrelated `EXPERIMENT.pdf`
/ `quickSort.pdf` from earlier runs. The KB had accumulated duplicates before
content-hash dedupe existed, and the manifest was assembled per user library, not
per job. `run_nodes_direct.py` now resets the user KB and scopes the manifest to
the job's fixtures (6 entries).

Re-run 2026-09-13T08:07Z (job `job-65805ca4d679`):

| node | iters | tool calls | outcome | reason |
|---|---|---|---|---|
| extract | 2 | `document_search` (relevant query, `top_k: "5"`) | degraded | no typed findings |
| retrieve | 2 | `document_search` (`top_k: 3`) | **completed** | — |
| compute | — | — | skipped | no typed findings |
| draft | — | — | skipped | nothing grounded to draft from |

Score 1/20, trap vacuous, `legacy_envelope_used = {}`.

**The extract blocker is now precise:** the model sent `top_k` as the **string**
`"5"` against an integer schema, and the tool call was rejected —
`Argument 'top_k' must be an integer`. No results → no `document_id` → no
`document_vision` call; the model then finalized in prose and extract degraded.
`retrieve` sent `top_k: 3` (integer) and worked.

Nameplate: a direct `document_vision` call reads the geometry via RapidOCR
(`D 25.0 m, H 13.0 m, SG 0.85, S 137 MPa, E 0.85`); llava returned structured but
vague observations. Week-5 decision recorded: make the vision path **OCR-first**
with the VLM as fallback, not VLM-first.

Actionable: (1) assemble the manifest per job, not per user library; (2) weak
models emit numeric arguments as strings — coerce (or the tool rejects the call
and the model does not recover).

## Node-direct run — coercion (Task C follow-up 2)

Weak models emit numeric arguments as strings; `extract`'s `document_search` was
rejected over `top_k: "5"`. Added lenient scalar coercion at the agent boundary
(`coerce_arguments`): `"5"`→5, `"true"`→True, JSON-string arrays; non-parseable
values still fail. Every coercion is recorded on the trace
(`tool_argument_coerced`) and counted (`AgentResult.argument_coercions`), tallied
by model. Verified rejection-then-retry separately: a validation error returns as
a `tool` message and the model gets another iteration (test).

Re-run 2026-09-13T08:29Z (job in `bench/results/20260913T082903Z_…`):

| node | iters | tool calls | outcome | reason |
|---|---|---|---|---|
| extract | 4 | `document_search`, `document_vision` (nameplate), `document_vision` (2021 report) | degraded | no typed findings |
| retrieve | 2 | `document_search` | completed | — |
| compute | — | — | skipped | no typed findings |
| draft | — | — | skipped | nothing grounded to draft from |

**`vision called on nameplate: True`** — the Task C expectation is met. Score
1/20, trap vacuous. `argument_coercions_by_model = {llama3.1:latest: 3}`;
`legacy_envelope_used = {}`. The remaining extract gap is producing the typed
findings JSON (instruction/model), not plumbing.

