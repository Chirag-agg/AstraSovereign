"""Offline eval for the semantic capability classifier (real local embeddings).

    backend\\.venv\\Scripts\\python.exe bench\\classifier_eval.py

Reports per-case predictions and a threshold sweep so the routing threshold can
be chosen from data. Always exits 0 (it is a report), but flags the known miss.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.capability_classifier import SemanticCapabilityClassifier  # noqa: E402
from app.services.embedding import OllamaEmbeddingProvider  # noqa: E402

EVAL_CASES: list[tuple[str, str]] = [
    # coding
    ("Change the helper so it computes 21 times 2 and run it.", "coding"),
    ("Run the code and tell me what it prints.", "coding"),
    ("Fix the bug in this function.", "coding"),
    ("Write a Python function that reads a CSV and returns the mean.", "coding"),
    ("Refactor the parser so it handles empty lines.", "coding"),
    ("Why does this loop go out of bounds?", "coding"),
    # document
    ("Compare the inspection report with the maintenance procedure.", "document"),
    ("Summarize the attached vessel report.", "document"),
    ("Create an approval note from the current and previous inspections.", "document"),
    ("Extract the survey dates from these inspection reports.", "document"),
    ("Produce a spreadsheet of the calculated corrosion rates.", "document"),
    ("Build a short deck summarizing the findings for the review meeting.", "document"),
    # vision
    ("What does the handwritten note on page 2 say?", "vision"),
    ("Read the gauge in this photo.", "vision"),
    ("Describe what is shown in this image.", "vision"),
    ("Look at the screenshot and tell me the error message.", "vision"),
    # --- held-out paraphrases (NOT in the exemplar set): real generalisation ---
    ("My script crashes when the input file is empty - can you sort it out?", "coding"),
    ("Add a function that computes the average and cover it with tests.", "coding"),
    ("Turn this pseudocode into working Python.", "coding"),
    ("The program prints the wrong total; track down why.", "coding"),
    ("Go through the two inspection PDFs and pull out the thickness readings.", "document"),
    ("Draft the approval note for the maintenance review.", "document"),
    ("What do the attached reports say about the next inspection date?", "document"),
    ("Put the findings into a spreadsheet for the team.", "document"),
    ("Can you make out what is written on the nameplate photo?", "vision"),
    ("The gauge picture is blurry - what does it read?", "vision"),
    ("There is a photo of a handwritten tag; what does it say?", "vision"),
    # general (held-out)
    ("Give me the history of pressure vessels.", "general"),
    ("Thanks, that helps.", "general"),
    # general (hard negatives: must NOT be captured by coding/document/vision)
    ("Explain the difference between API 650 and API 653.", "general"),
    ("Hello, what can you do?", "general"),
    ("What is the weather like today?", "general"),
    ("Tell me a joke.", "general"),
    ("Who are you?", "general"),
    ("Give me a high-level overview of fitness-for-service.", "general"),
    ("What does corrosion allowance mean?", "general"),
    ("Plan my day.", "general"),
]

THRESHOLDS = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60]


def predict_at(scores: dict[str, float], threshold: float) -> str:
    if not scores:
        return "general"
    label = max(scores, key=scores.get)
    return label if scores[label] >= threshold else "general"


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:11434")
    parser.add_argument("--model", default="nomic-embed-text")
    args = parser.parse_args()

    provider = OllamaEmbeddingProvider(base_url=args.base_url, model=args.model)
    try:
        classifier = SemanticCapabilityClassifier(provider, threshold=0.0)
        await classifier.preload()
        rows = []
        for message, expected in EVAL_CASES:
            classification = await classifier.classify(message)
            rows.append((message, expected, classification))
    finally:
        await provider.aclose()

    total = len(rows)
    sweep = {
        threshold: sum(
            1 for _, expected, c in rows if predict_at(c.scores, threshold) == expected
        )
        for threshold in THRESHOLDS
    }
    chosen = max(THRESHOLDS, key=lambda t: (sweep[t], t))

    print(f"cases={total}  chosen_threshold={chosen:.2f}  model={args.model}")
    print("threshold sweep:")
    for threshold in THRESHOLDS:
        correct = sweep[threshold]
        print(f"  {threshold:.2f}  {correct}/{total}  ({correct / total:.0%})")

    print("\nper-case at chosen threshold:")
    per_label: dict[str, list[int]] = {}
    for message, expected, classification in rows:
        predicted = predict_at(classification.scores, chosen)
        ok = predicted == expected
        per_label.setdefault(expected, [0, 0])
        per_label[expected][1] += 1
        per_label[expected][0] += int(ok)
        print(
            f"  {'OK  ' if ok else 'MISS'} expected={expected:<8} pred={predicted:<8} "
            f"best={classification.confidence:.3f}  {message}"
        )

    print("\naccuracy by expected label:")
    for label, (correct, count) in sorted(per_label.items()):
        print(f"  {label:<8} {correct}/{count}")

    known_miss = EVAL_CASES[0][0]
    known_scores = next(c.scores for m, _, c in rows if m == known_miss)
    known_pred = predict_at(known_scores, chosen)
    if known_pred != "coding":
        print(f"\nWARNING: known miss still misroutes: {known_miss!r} -> {known_pred}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
