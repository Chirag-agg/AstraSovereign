# Hard Scenario 01 — structure-aware ingestion metrics

One row per phase on branch `feat/structure-aware-ingestion`. Raw JSON stays in
the gitignored `bench/results/`; this file is the durable summary (same
convention as `baseline.md`).

Acceptance for every phase: **recall@5 >= 19/20 AND MRR >= baseline MRR AND
superseded appearances = 0/20**, and no existing test may break.

`2026 elements` / `% bbox` / `% confidence` are `inspection_report_2026.pdf`
(a 4-page scanned report ingested through the OCR path), measured by
`extraction_eval.py`. `extraction_eval` summarises every fixture document.

## Metrics

| Phase | pytest | recall@5 | MRR | superseded | 2026 elements | % bbox | % confidence | extraction_eval |
|---|---|---|---|---|---|---|---|---|
| 0 — baseline | 556 passed, 0 failed, 0 skipped | 19/20 (95%) | 0.6875 | 0/20 | 4 | 0% | 0% | n/a |
| 1 — provenance through the seam | 565 passed, 0 failed, 0 skipped | 19/20 (95%) | 0.6875 | 0/20 | 46 | 100% | 100% | ocr 100%/100%, text layer 0%/0% |

## Phase 1 detail (2026-09-22)

Commit: provenance through the ingestion seam. OCR regions stop being flattened
into one page string: each region becomes its own element carrying its own
`bbox` and `confidence` with `source="ocr"`, while a PDF text layer keeps
`None` for both (it exposes neither). OCR is now decided **per page**, so a
mixed PDF keeps the typed pages it has and renders only the pages that need
recognising; the threshold is `ocr_page_min_text_chars`.

Both retrieval numbers are identical to baseline — as expected, since Phase 1
changes the extraction artifact, not the index. The index text is byte-identical
for OCR pages (`"\n".join(region.text ...)` is untouched) and for text pages
(unchanged path).

| fixture | elements (before) | elements (after) | bbox | confidence | sources |
|---|---|---|---|---|---|
| inspection_report_2026.pdf | 4 | 46 | 100% | 100% | ocr: 46 |
| inspection_report_2021.pdf | — | 27 | 100% | 100% | ocr: 27 |
| tank204_nameplate.jpg | — | 10 | 100% | 100% | ocr: 10 |
| tank204_pid_extract.png | — | 6 | 100% | 100% | ocr: 6 |
| SOP-09_Rev2.pdf | — | 1 | 0% | 0% | text_layer: 1 |
| SOP-09_Rev3.pdf | — | 1 | 0% | 0% | text_layer: 1 |

The baseline's `4` elements for `inspection_report_2026.pdf` was one element per
page with no geometry; the `0%` was the flattening, not a missing signal. The
text-layer `0%` is correct and stays: a PDF text layer exposes no bbox and no
confidence, so neither is invented.

`run_nodes_direct.ingest()` was also brought in line with the upload endpoint
(mixed PDFs route per page) so this harness indexes what the app indexes.
Neither fixture PDF is mixed, so no measured number moved.

### Test coverage added

`backend/tests/test_structure_ingestion.py` (9 tests): element-id stability and
content-addressing; `from_elements` ordered/non-mutating; a v1 artifact loading;
OCR regions keeping their own bbox/confidence/`source`; a text-layer page
reporting neither; a mixed PDF OCR-ing only its blank page (`ocr.calls == [2]`);
a fully scanned PDF still routing through OCR; an unreadable PDF failing
cleanly; and the whole ingestion path run with external sockets denied (loopback
allowed only for the event loop's own self-pipe).

## Baseline detail (2026-09-22)

Branch point: `fix/model-routing-and-compute-verification`.
Machine: Intel i5-12450HX (8C/12T), 15.7 GB RAM, NVIDIA RTX 3050 6 GB Laptop
GPU + Intel UHD. Ollama-local models present: `llama3.1:latest`, `llava:7b`,
`qwen2.5-coder:3b`, `qwen2.5:1.5b`, `qwen3:1.7b`, `nomic-embed-text`.

`run_scenario.py --tag` (queue path, live backend): **score 1/20**, job
`failed`, `trap_passed: true`, `auto_fail: false`, `external_connection_attempts: 0`,
timing upload 22.87 s / generation 224.14 s, reported `peak_vram_mb: 4096`
(that is the declared resource requirement from `models.yaml`, not a measurement).

| node | capability | model | iters | tool calls | outcome |
|---|---|---|---|---|---|
| extract | document | llama3.1:latest | 4 | 2 | completed |
| retrieve | document | llama3.1:latest | 1 | 0 | degraded — "document_search was not invoked" |
| compute | coding | qwen2.5-coder:7b | — | — | never ran |

Only rubric item scored: `grounding_never_rev2`.

**The 1/20 is confounded and is not a usable acceptance signal for this branch.**
The job died at the model call — `OllamaModelNotFoundError: Model
'qwen2.5-coder:7b' is not available` — because `config/models.yaml` routes
`coding` (the `compute` node) to a model that is not pulled locally, and every
`fallback_to` chain is empty. Phases 1-6 do not touch model routing (out of
scope), so the score will stay ~1/20 regardless of extraction quality. A CPU/
laptop score is in any case **not comparable** to the GPU demo box.

## Step 0.2 — the single recall miss is a fixture defect, not a retrieval failure

Query `'Course 5 not accessible scaffold'` expects the substring
`'scaffold unavailable'`, asserted case-sensitively (`expected in text`).

- Raw OCR of `inspection_report_2021.pdf` page 2: `'Scaffold unavailable; defer
  to next survey.'`, confidence **0.9166** — intact, capital S.
- Page 1 OCR glued three fields into one region: `'notaccessible-scaffoldunavailable'`
  (confidence 0.9116, bbox `[721, 659, 1002, 680]`) — the only all-lowercase copy,
  and it has no space.
- The chunk holding the intact page-2 text ranks **dense #1, BM25 #1, fused #1**
  and **is returned as the top result**. Nothing was dropped by `per_page_cap`,
  duplicate suppression, or the superseded penalty.
- `_tokenize('Course 5')` -> `['course','5']`; `_tokenize('C5')` -> `['c5']`.
  Confirmed: **"Course 5" can never token-match "C5"** under `_TOKEN_RE`. This is
  relevant to the Phase 6 course->thickness queries.

So the baseline is substantively **20/20**; the recorded 19/20 is one
case-sensitive false negative. This branch does not change it (fixture, not
code) — reported only, per the task.

## Step 0.1 — auth note

`run_scenario.py` authenticates with `X-User-ID` headers only, so it requires
`dev_header_auth=True`; the production-shaped app would 401 it. The bench should
create a user via the CLI and log in with a session cookie instead (see
CONTEXT.md Known Issues).
