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
| 1b — eval expectation corrected | 565 passed, 0 failed, 0 skipped | 20/20 (100%) | 0.7375 | 0/20 | 46 | 100% | 100% | unchanged from 1 |
| 2.1 — per-page scan detection, loud page loss | 574 passed, 0 failed, 0 skipped | 20/20 (100%) | 0.7375 | 0/20 | 46 | 100% | 100% | unchanged from 1b |

Row 1b is not a code change to the retriever: it corrects the *eval's* expected
substring (see Step 0.2 below). Chunk text is byte-identical to row 1, so the
extraction numbers are the same; only the measurement was wrong — which also
means its suite is unchanged from row 1's 565 (no test code was touched).
Row 2.1 adds nine tests and changes no chunk text: `ingest_pdf` and
`ingest_scanned` still hand `"\n".join(region.text ...)` to the chunker, so both
retrieval numbers and the extraction artifact are byte-identical to 1b. Its runs are
`bench/results/20260922T144645Z_retrieval_eval_phase2.1.json` and
`bench/results/20260922T144400Z_extraction_eval_phase2.1.json`.

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

## Phase 2.1 detail (2026-09-22) — per-page scan detection, and loud page loss

### The measured check behind `ocr_page_min_text_chars`

Per-page text-layer size measured with `pypdf` over every fixture PDF (scratch
probe, `PdfReader` only — no render):

| fixture | page | text-layer chars | embedded images | image px² | page pt² | px²/pt² |
|---|---|---|---|---|---|---|
| inspection_report_2026.pdf | 1–4 | 0 | 1 (1254×1764) | 2,212,056 | 509,658 | 4.3 |
| inspection_report_2021.pdf | 1–2 | 0 | 1 (1254×1764) | 2,212,056 | 509,658 | 4.3 |
| SOP-09_Rev2.pdf | 1 | 410 | 0 | 0 | 501,156 | 0 |
| SOP-09_Rev3.pdf | 1 | 1152 | 0 | 0 | 501,156 | 0 |

Two facts fall out, and the new default is derived from them rather than tuned:

- Every scanned fixture page has **0** chars of text layer and a page-scale
  raster; every typed fixture page has **410/1152** and no raster. So the
  deciding signal is *not* a character count alone — it is whether the page's
  visible content is a page-scale raster.
- `raster_dominant` = total embedded-image pixel area >= page area in points².
  A 150 dpi A4 scan measures 4.3; a rule, bullet, or logo is orders of magnitude
  below 1. The rule is a property of the file, not of these fixtures.

Routing rule (`page_requires_ocr`, pure): a raster-dominant page is OCR'd when
its text layer is under the threshold; a page with no text layer at all is
always OCR'd; a page that is *not* raster-dominant keeps its text layer however
short that layer is, because there is no raster to recognise. The default
`ocr_page_min_text_chars` is now **64** — an order of magnitude above a stamp
("Page 3" is 6 chars; a two-line stamped header ~40) and well below a real
paragraph (the shortest typed fixture page is 410). No fixture with a stamped
header exists to measure against, so the number is justified by the purpose and
by the measured gap (0 vs 410), not fitted to a fixture.

Neither retrieval number moved, and neither extraction number could: a fixture
page's routing decision is unchanged (0 chars on a raster page is still < 64;
410 chars on a typed page is still not raster-dominant).

### Loud page loss

A page routed to OCR that comes back with no text is named three ways, so it
cannot be mistaken for a page that was read and found empty:

1. **Audit event** `DOCUMENT_PAGES_UNREADABLE` (`document_pages_unreadable`),
   carrying `document_id`, `file_name`, `pages` and `status="partial"`. Emitted
   from the knowledge base — the only layer that knows the document id — before
   ingestion completes, so the fact survives even if ingestion then fails.
2. **Document status** `partial` (new `DocumentStatus.PARTIAL`), returned by the
   documents API both in `status` and as `unreadable_pages: [...]`. The page list
   is also persisted on the extraction artifact (`DocumentExtraction.unreadable_pages`).
3. **A visible prefix** on the text every reader sees: the extraction markdown
   (served by `read_document`, and the same text the attachment manifest hands
   the extract node) begins `WARNING: pages N, M of this document could not be
   read`, and `document_search` and `document_exact_search` print the same line
   above every result from that document. One wording, one helper
   (`unreadable_pages_notice`).

A partially-read document is still indexed and searchable (`_INDEXED_STATUSES`),
because it is the only evidence there is for the pages that *were* read; the
warning is what keeps that honest. The list is available to a node for a
deliverable notice; wiring an explicit notice into the deliverable is the
follow-up recorded in CONTEXT.md.

**Behaviour change to note:** a document whose OCR page yields nothing is now
`partial` instead of `ready`. One Phase 1 assertion
(`test_page_text_layer_yields_no_bbox_and_no_confidence`, which ingests a blank
page 2 through a fake OCR that recognises nothing) was updated from `"ready"` to
`"partial"` — the page genuinely was not read, and saying so is the point. No
assertion was weakened or deleted.

### Entry-point audit (2.1(iv))

| entry point | path used | extraction path | do OCR regions reach `from_elements`? |
|---|---|---|---|
| `POST /api/documents` — image (png/jpg/jpeg) | `MultimodalService.ingest_scanned` | per-region elements | **yes** (`elements=`) |
| `POST /api/documents` — PDF, no text layer anywhere | `ingest_scanned` | per-region elements | **yes** |
| `POST /api/documents` — PDF, some page needs OCR | `ingest_pdf` | per-page: OCR regions as elements, typed pages as `text_layer` elements | **yes** |
| `POST /api/documents` — PDF, all pages typed | `KnowledgeBase.ingest_document` → `from_pages` | `(page, text)` adapter | n/a (no OCR) |
| `POST /api/documents` — txt/md | `ingest_document` → `from_pages` | `(page, text)` adapter | n/a (no OCR) |
| `ingest_pdf` on an unreadable PDF | falls back to `ingest_document` | `from_pages` | n/a (nothing was read) |
| Job attachments / composer | none — the composer uploads through `POST /api/documents`, then attaches by `doc_id` (`build_attachment_manifest`) | as above | as above |
| Cowork projects, workspace, chat | no ingestion path into the KB (verified: no `ingest_*` caller) | — | — |
| `import_legacy.py` | jobs + artifacts only, never documents | — | — |
| `admin.py` | reads KB stats/health; no ingestion | — | — |
| `run_nodes_direct.ingest` (harness) | mirrors the API branch for branch | as the API | **yes** |

One path produced OCR regions without passing them through in Phase 1 and was
fixed there (the flattened `ingest_scanned`). This audit found no remaining
path that produces OCR regions and drops them: every OCR-bearing entry point
calls `KnowledgeBase.ingest_pages(..., elements=...)`.

**Test coverage added** (`backend/tests/test_structure_ingestion.py`, 9 new
tests, 18 in the file): the pure routing rule at every boundary (no text, a
stamp on a raster, a short typed page, a long raster-borne text layer); a raster
page carrying only "Page 3" routed to OCR at the service level *and* through the
upload endpoint; a lost page marking the document `partial` with the page named
in metadata and on the artifact; the audit event with its document id, filename
and page list; the `read_document` prefix; the `document_search` prefix; the
`document_exact_search` prefix and that a partial document is still found; and a
fully-read document carrying no warning anywhere.



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

## Step 0.2 — the single recall miss was the eval's expectation, not the retriever

Query `'Course 5 not accessible scaffold'` expected the substring
`'scaffold unavailable'`, asserted case-sensitively (`expected in text`).

- Raw OCR of `inspection_report_2021.pdf` page 2: `'Scaffold unavailable; defer
  to next survey.'`, confidence **0.9166** — intact, capital S.
- Page 1 OCR glued three fields into one region: `'notaccessible-scaffoldunavailable'`
  (confidence 0.9116, bbox `[721, 659, 1002, 680]`) — the only all-lowercase copy,
  and it has no space.
- The chunk holding the intact page-2 text ranked **dense #1, BM25 #1, fused #1**
  and **was returned as the top result**. Nothing was dropped by `per_page_cap`,
  duplicate suppression, or the superseded penalty.

**Corrected in Phase 2.1(i).** The retriever was right and the measurement was
wrong: the fixture generator writes the sentence with a capital S, so the eval's
lowercased expectation could never match the top-ranked chunk. The expectation is
now the document's actual case (`'Scaffold unavailable'`), which is also what
keeps the eval honest — it now asserts a substring that exists verbatim in the
source, so a future *retrieval* regression on this query would be visible
instead of being masked by a permanently-failing expectation. Re-measured as row
1b: **recall@5 20/20, MRR 0.7375** (the one miss was at rank 1).

`_tokenize('Course 5')` -> `['course','5']`; `_tokenize('C5')` -> `['c5']`.
Confirmed: **"Course 5" can never token-match "C5"** under `_TOKEN_RE`. This is
relevant to the Phase 6 course->thickness queries.

## Step 0.1 — auth note

`run_scenario.py` authenticates with `X-User-ID` headers only, so it requires
`dev_header_auth=True`; the production-shaped app would 401 it. The bench should
create a user via the CLI and log in with a session cookie instead (see
CONTEXT.md Known Issues).
