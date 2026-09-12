# Hard Scenario 01 — Tank 204 API 653 Fitness-for-Service

A deliberately difficult end-to-end task. It cannot be completed by formatting a
payload: the agent must read scanned reports, ground in a local SOP, compute in
the sandbox, iterate, and **refuse** one part (Course 5 has no baseline).

Run it before starting ingestion work; the failure list defines what to fix first.

## Fixtures (`tests/fixtures/hard_scenario_01/`)

| File | What it is |
|---|---|
| `inspection_report_2026.pdf` | scanned 4-page UT survey; C5 struck-through with handwritten `11.6`; C6 in inches (`0.455 in`) |
| `inspection_report_2021.pdf` | scanned 2-page historical survey; C5 absent (not accessible) |
| `SOP-09_Rev3.pdf` | current procedure: formula, two thresholds, corrosion/life/interval rules, no-baseline rule |
| `SOP-09_Rev2.pdf` | superseded distractor (different alert margin and 10-year cap) |
| `tank204_nameplate.jpg` | diameter/height/SG/stress/joint-efficiency — appear nowhere else |
| `tank204_pid_extract.png` | P&ID crop for the approval note |

Regenerate with `backend\.venv\Scripts\python.exe tests\hard_scenario_01\build_fixtures.py`.
All values come from `constants.py`.

## Prompt (verbatim, no hints)

> Assess Tank 204 for continued service using the current and previous inspection
> reports and our tank shell evaluation procedure. For every shell course, determine
> the corrosion rate, the remaining life, and the next inspection date. Produce an
> approval note recommending a course of action, a spreadsheet showing the
> calculations, and a short deck for the maintenance review meeting.

## Scoring (20; under 15 = not finale-ready)

- **Extraction (5):** all six 2026 readings (2); C6 inches→mm (1); C5 uses the
  handwritten 11.6 (1); nameplate values from the photo (1).
- **Grounding (4):** cites SOP-09 Rev 3 (2); never cites Rev 2 (1); applies both
  retirement and alert thresholds (1).
- **Computation (5):** minimum thickness from nameplate geometry (2); corrosion
  rates for C1–C4 and C6 (1); remaining life + next interval with the 15-year cap
  (1); calculation executed in the sandbox (1).
- **The trap (4):** C5 referred for engineering review (3); reason stated — no 2021
  baseline (1). **A fabricated C5 corrosion rate is an automatic fail.**
- **Deliverables (2):** all three generated and consistent (1); approval note has
  the P&ID crop, both thresholds, and the C5 referral (1).

## Verify

```
python tests\hard_scenario_01\verify.py --artifacts <dir> [--trace <job.json>]
```

## Run

```
python tests\hard_scenario_01\run_scenario.py
```

Writes `bench/results/<timestamp>_hard_scenario_01.json` (score, trap, models per
step, timings, tool failures, artifacts) and an artifacts directory.

## Source-of-truth warning

`constants.py` is provisional. The formula, thresholds, geometry and baselines
must be checked against the real MRPL standard before any score is trusted. The
fixtures, the expected results and the verifier all read that one file.
