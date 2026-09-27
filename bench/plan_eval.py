"""Offline eval for the job plan: does the model layer earn its place?

    backend\\.venv\\Scripts\\python.exe bench\\plan_eval.py --model qwen3:1.7b

Scores the 40 hand-labelled requests in ``bench/plan_eval/requests.jsonl`` in
three cuts, because the only number that decides anything is the middle one:

- **stage (a) deterministic** — the classifier's label widened by every explicit
  regex signal. This is today's behaviour.
- **stage (b) + model** — the same base with ``PlanFiller`` filling the fields
  stage (a) left unset.
- the split **by whether stage (a) settled the field**, so the real question is
  visible: accuracy on the fields the deterministic layer *could not* settle (the
  implicit phrasings that caused the bug), old vs new. A model that only agrees
  with the regexes on cases the regexes already got right has earned nothing.

The model is chosen by this number, not by a hunch — run it once per candidate.
Exits 0 on a completed run (the comparison is printed); exits 1 only when the
harness itself could not run (Ollama unreachable), which is a different thing
from a model scoring badly.

MEASURED 2026-09-26 (all three at threshold 0.55, greedy + seed 7), implicit
fields only, stage (a) -> stage (b):

    qwen3:1.7b   98/110 (89%) ->  90/110 (82%)   delta  -8    <- the ~1B premise
    qwen3:8b     98/110 (89%) -> 101/110 (92%)   delta  +3

So the ~1B model the layer was designed around does not hold up: it loses more
than it adds, and the losses are in the harmful direction — it invents a
deliverable for plain chat questions ("what does corrosion allowance mean?" ->
`slides`, "write 1000 words on merge sort" -> `word`) and a document requirement
for almost everything. Because ``JobPlan.merge`` is escalation-only, a wrong
ADDITION cannot be withdrawn by any later layer, which is why a plan worse than
the regexes is worse than no model layer at all. An 8B does clear the baseline
by +3, but still makes the same wrong-adds on the most common operator phrasings
(D01/D03 "write N words", E03 a coding request that names an output file), and
at ~5 GB it cannot stay resident the way the 1.4 GB model was supposed to on a
16 GB host. ``PLANNER_ENABLED`` therefore stays false; the typed ``JobPlan``
stays, because the single-home decision object is worth having regardless of who
fills it.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.services.capability_classifier import SemanticCapabilityClassifier  # noqa: E402
from app.services.embedding import OllamaEmbeddingProvider  # noqa: E402
from app.services.model_registry import ModelRegistry  # noqa: E402
from app.services.ollama_service import OllamaService  # noqa: E402
from app.services.plan import JobPlan  # noqa: E402
from app.services.plan_defaults import resolve  # noqa: E402
from app.services.plan_filler import PlanFiller  # noqa: E402

# Fields the requests are labelled with. ``capability`` is deliberately absent:
# it is the classifier's own output and is scored by bench/classifier_eval.py.
SCORED_FIELDS = ("deliverable", "length_words", "needs_documents", "needs_code")

REQUESTS_PATH = ROOT / "bench" / "plan_eval" / "requests.jsonl"
CHOSEN_THRESHOLD = 0.55
BENCH_SEED = 7


def load_requests(path: Path) -> list[dict]:
    cases = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                cases.append(json.loads(line))
    return cases


def field_matches(plan: JobPlan, expected: dict[str, Any], field: str) -> bool:
    return getattr(plan, field) == expected.get(field)


class Tally:
    """Correct/total per field, for one stage over one subset of rows."""

    def __init__(self) -> None:
        self.correct: dict[str, int] = {f: 0 for f in SCORED_FIELDS}
        self.total: dict[str, int] = {f: 0 for f in SCORED_FIELDS}

    def add(self, matched: dict[str, bool]) -> None:
        for field_name, ok in matched.items():
            self.total[field_name] += 1
            self.correct[field_name] += int(ok)

    @property
    def correct_all(self) -> int:
        return sum(self.correct.values())

    @property
    def total_all(self) -> int:
        return sum(self.total.values())

    def pct(self, correct: int, total: int) -> str:
        return " n/a " if total == 0 else f"{correct / total:4.0%}"


def score(rows: list[dict], stage: str, subset: str) -> Tally:
    """``subset`` is "all", "settled" (stage a had it) or "implicit" (it did not)."""
    tally = Tally()
    for row in rows:
        matched = {}
        for field_name in SCORED_FIELDS:
            if subset == "settled" and not row["settled"][field_name]:
                continue
            if subset == "implicit" and row["settled"][field_name]:
                continue
            matched[field_name] = row[f"{stage}_ok"][field_name]
        tally.add(matched)
    return tally


def print_field_table(title: str, rows: list[dict]) -> None:
    a_all = score(rows, "a", "all")
    b_all = score(rows, "b", "all")
    print(f"\n{title}")
    print(f"  {'field':<16}{'stage a':>14}{'stage b':>14}")
    for field_name in SCORED_FIELDS:
        a_hit = f"{a_all.correct[field_name]}/{a_all.total[field_name]}"
        b_hit = f"{b_all.correct[field_name]}/{b_all.total[field_name]}"
        a_pct = a_all.pct(a_all.correct[field_name], a_all.total[field_name])
        b_pct = b_all.pct(b_all.correct[field_name], b_all.total[field_name])
        print(f"  {field_name:<16}{a_hit:>8}{a_pct:>6}{b_hit:>8}{b_pct:>6}")


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:11434")
    parser.add_argument("--model", default="qwen3:1.7b")
    parser.add_argument("--embedding-model", default="nomic-embed-text")
    parser.add_argument("--requests", default=str(REQUESTS_PATH))
    parser.add_argument("--seed", type=int, default=BENCH_SEED)
    args = parser.parse_args()

    cases = load_requests(Path(args.requests))
    provider = OllamaEmbeddingProvider(
        base_url=args.base_url, model=args.embedding_model
    )
    # Greedy + fixed seed: an eval must measure the system, not sampling noise.
    # The context window and per-model overrides come from the same settings and
    # registry production uses — an eval run with different generation options is
    # measuring a different system and its numbers would not transfer.
    settings = get_settings()
    registry = ModelRegistry.from_file(
        settings.models_config, profile=settings.model_profile or None
    )
    ollama = OllamaService(
        base_url=args.base_url,
        default_model=args.model,
        options={
            "temperature": 0.0,
            "seed": args.seed,
            "num_ctx": settings.ollama_num_ctx,
            "num_predict": settings.ollama_num_predict,
        },
        model_options=registry.model_options(),
        min_num_predict=settings.ollama_num_predict_min,
    )
    filler = PlanFiller(ollama, model=args.model)

    try:
        classifier = SemanticCapabilityClassifier(provider, threshold=CHOSEN_THRESHOLD)
        try:
            await classifier.preload()
            ollama_models = set(await ollama.list_models())
        except Exception as exc:  # harness could not run — distinct from a bad score
            print(f"ERROR: could not reach Ollama at {args.base_url}: {exc}")
            return 1

        if args.model not in ollama_models:
            print(
                f"ERROR: model '{args.model}' is not pulled locally: "
                f"{sorted(ollama_models)}"
            )
            return 1

        rows: list[dict] = []
        for case in cases:
            task = case["task"]
            expected = case["expected"]
            label = (await classifier.classify(task)).task_type
            base = resolve(task, label)
            stage_a = base.with_defaults()
            stage_b = (await filler.fill(task, base)).with_defaults()
            rows.append(
                {
                    "id": case["id"],
                    "case": case["case"],
                    "task": task,
                    "expected": expected,
                    "label": label,
                    "settled": {f: base.is_set(f) for f in SCORED_FIELDS},
                    "a": stage_a,
                    "b": stage_b,
                    "a_ok": {f: field_matches(stage_a, expected, f) for f in SCORED_FIELDS},
                    "b_ok": {f: field_matches(stage_b, expected, f) for f in SCORED_FIELDS},
                    "b_sources": {
                        f: stage_b.source_of(f).value for f in SCORED_FIELDS
                    },
                }
            )
    finally:
        await provider.aclose()
        await ollama.aclose()

    print(f"plan_eval  model={args.model}  requests={len(rows)}  "
          f"classifier_threshold={CHOSEN_THRESHOLD:.2f}")

    print_field_table("per-field accuracy (all 40 requests):", rows)

    settled_a = score(rows, "a", "settled")
    settled_b = score(rows, "b", "settled")
    print("\nfields stage (a) SETTLED deterministically "
          "(the regexes' own turf - a regression here is a bug):")
    print(f"  stage a {settled_a.correct_all}/{settled_a.total_all} "
          f"({settled_a.pct(settled_a.correct_all, settled_a.total_all)} of settled fields)")
    print(f"  stage b {settled_b.correct_all}/{settled_b.total_all} "
          f"({settled_b.pct(settled_b.correct_all, settled_b.total_all)} of settled fields)")

    implicit_a = score(rows, "a", "implicit")
    implicit_b = score(rows, "b", "implicit")
    print("\nfields stage (a) LEFT UNSET - the implicit cases this is for  [headline]:")
    print(f"  stage a deterministic-only {implicit_a.correct_all}/{implicit_a.total_all} "
          f"({implicit_a.pct(implicit_a.correct_all, implicit_a.total_all)})")
    print(f"  stage b + model            {implicit_b.correct_all}/{implicit_b.total_all} "
          f"({implicit_b.pct(implicit_b.correct_all, implicit_b.total_all)})")
    delta = implicit_b.correct_all - implicit_a.correct_all
    print(f"  delta: {delta:+d} fields")

    print("\nimplicit-field detail (stage b):")
    for row in rows:
        for field_name in SCORED_FIELDS:
            if row["settled"][field_name] or row["b_ok"][field_name]:
                continue
            got = getattr(row["b"], field_name)
            want = row["expected"].get(field_name)
            print(
                f"  MISS {row['id']} {field_name}: got {got!r} want {want!r} "
                f"(src={row['b_sources'][field_name]})  {row['task']!r}"
            )

    print("\nstage-b source breakdown (which layer settled each scored field):")
    for field_name in SCORED_FIELDS:
        counts = {"explicit": 0, "model": 0, "default": 0}
        for row in rows:
            counts[row["b_sources"][field_name]] += 1
        print(f"  {field_name:<16} explicit={counts['explicit']:<3} "
              f"model={counts['model']:<3} default={counts['default']}")

    if delta > 0:
        print(f"\nVERDICT: the model layer is worth enabling on this evidence "
              f"(+{delta} implicit fields).")
    elif delta == 0:
        print("\nVERDICT: no gain on the implicit fields — keep the layer off.")
    else:
        print(f"\nVERDICT: the model layer makes it worse ({delta} implicit fields) "
              "— keep it off.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
