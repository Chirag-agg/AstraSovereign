"""Offline eval for the semantic capability classifier (real local embeddings).

    backend\\.venv\\Scripts\\python.exe bench\\classifier_eval.py

The headline number is HELD-OUT accuracy: the exemplars are scored only as a
sanity check (they are guaranteed nearest hits at similarity 1.0 and measure
nothing). Held-out cases are paraphrases and hard negatives that are NOT in the
exemplar set, so they measure generalisation. Always exits 0 (a report), but
flags the known miss.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.capability_classifier import (  # noqa: E402
    CAPABILITY_EXEMPLARS,
    SemanticCapabilityClassifier,
)
from app.services.embedding import OllamaEmbeddingProvider  # noqa: E402

# The project decision: over-triggering is cheap (a spurious `compute` degrades),
# under-triggering is the recorded failure, so take the lower threshold.
CHOSEN_THRESHOLD = 0.55
THRESHOLDS = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60]

# Held-out: paraphrases and hard negatives, NONE of which are exemplars.
HOLDOUT_CASES: list[tuple[str, str]] = [
    # coding
    ("My script crashes when the input file is empty - can you sort it out?", "coding"),
    ("Add a function that computes the average and cover it with tests.", "coding"),
    ("Convert this Java snippet into Python.", "coding"),
    ("Reimplement this function in Rust.", "coding"),
    ("The program prints the wrong total; track down why.", "coding"),
    # document
    ("Go through the two inspection PDFs and pull out the thickness readings.", "document"),
    ("Draft the approval note for the maintenance review.", "document"),
    ("What do the attached reports say about the next inspection date?", "document"),
    ("Put the findings into a spreadsheet for the team.", "document"),
    # vision
    ("Can you make out what is written on the nameplate photo?", "vision"),
    ("The gauge picture is blurry - what does it read?", "vision"),
    ("There is a photo of a handwritten tag; what does it say?", "vision"),
    # general hard negatives
    ("What does corrosion allowance mean?", "general"),
    ("Give me the history of pressure vessels.", "general"),
    ("Thanks, that helps.", "general"),
    ("Explain the difference between API 650 and API 653.", "general"),
    ("Give me a high-level overview of fitness-for-service.", "general"),
]

EXEMPLAR_CASES: list[tuple[str, str]] = [
    (text, label) for label, texts in CAPABILITY_EXEMPLARS.items() for text in texts
]


def predict_at(scores: dict[str, float], threshold: float) -> str:
    if not scores:
        return "general"
    label = max(scores, key=scores.get)
    return label if scores[label] >= threshold else "general"


def accuracy(rows, threshold: float, kind: str) -> tuple[int, int]:
    subset = [row for row in rows if row[2] == kind]
    correct = sum(1 for _, expected, _, c in subset if predict_at(c.scores, threshold) == expected)
    return correct, len(subset)


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:11434")
    parser.add_argument("--model", default="nomic-embed-text")
    args = parser.parse_args()

    cases = [(m, e, "exemplar") for m, e in EXEMPLAR_CASES]
    cases += [(m, e, "holdout") for m, e in HOLDOUT_CASES]

    provider = OllamaEmbeddingProvider(base_url=args.base_url, model=args.model)
    try:
        classifier = SemanticCapabilityClassifier(provider, threshold=0.0)
        await classifier.preload()
        rows = []
        for message, expected, kind in cases:
            classification = await classifier.classify(message)
            rows.append((message, expected, kind, classification))
    finally:
        await provider.aclose()

    held_correct, held_total = accuracy(rows, CHOSEN_THRESHOLD, "holdout")
    ex_correct, ex_total = accuracy(rows, CHOSEN_THRESHOLD, "exemplar")
    print(
        f"model={args.model}  chosen_threshold={CHOSEN_THRESHOLD:.2f}  "
        f"exemplars={ex_total}  held-out={held_total}"
    )
    print(
        f"HELD-OUT accuracy: {held_correct}/{held_total} "
        f"({held_correct / held_total:.0%})   [headline]"
    )
    print(f"exemplar sanity:   {ex_correct}/{ex_total} (expected 100%)")

    print("\nheld-out threshold sweep:")
    for threshold in THRESHOLDS:
        correct, total = accuracy(rows, threshold, "holdout")
        marker = "  <- chosen" if abs(threshold - CHOSEN_THRESHOLD) < 1e-9 else ""
        print(f"  {threshold:.2f}  {correct}/{total}  ({correct / total:.0%}){marker}")

    print("\nheld-out per-case at chosen threshold:")
    per_label: dict[str, list[int]] = {}
    for message, expected, kind, classification in rows:
        if kind != "holdout":
            continue
        predicted = predict_at(classification.scores, CHOSEN_THRESHOLD)
        ok = predicted == expected
        per_label.setdefault(expected, [0, 0])
        per_label[expected][1] += 1
        per_label[expected][0] += int(ok)
        print(
            f"  {'OK  ' if ok else 'MISS'} expected={expected:<8} pred={predicted:<8} "
            f"best={classification.confidence:.3f}  {message}"
        )

    print("\nheld-out accuracy by expected label:")
    for label, (correct, count) in sorted(per_label.items()):
        print(f"  {label:<8} {correct}/{count}")

    known_miss = "Change the helper so it computes 21 times 2 and run it."
    known = next((c for m, _, _, c in rows if m == known_miss), None)
    if known is not None and predict_at(known.scores, CHOSEN_THRESHOLD) != "coding":
        print(f"\nWARNING: known miss still misroutes: {known_miss!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
