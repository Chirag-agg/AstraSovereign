"""Retrieval eval set for Hard Scenario 01.

Twenty queries against the scenario fixtures with an expected source substring.
Scores recall@5 and reports whether any superseded document (SOP-09 Rev 2)
appeared. Run BEFORE and AFTER any retrieval change:

    backend\\.venv\\Scripts\\python.exe tests\\hard_scenario_01\\retrieval_eval.py --tag baseline

Writes bench/results/<stamp>_retrieval_eval_<tag>.json and prints the summary.
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tests" / "hard_scenario_01"))

from app.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from run_nodes_direct import ingest  # noqa: E402

# (query, expected substring in a retrieved chunk)
EVAL_QUERIES = [
    ("shell course thickness readings", "13.4"),
    ("Course 2 thickness", "10.9"),
    ("Course 5 re-shot after probe fault", "re-shot after probe fault"),
    ("minimum required thickness formula", "t_min = 4.9"),
    ("retirement thickness", "Retirement thickness"),
    ("alert thickness monitoring", "Alert thickness"),
    ("corrosion rate calculation", "CR = (previous"),
    ("remaining life calculation", "RL = (current"),
    ("next inspection interval cap", "15 years"),
    ("no previous reading shall not be assumed", "shall not be assumed"),
    ("tank diameter fill height symbols", "nominal tank diameter"),
    ("welded joint efficiency symbol", "welded joint efficiency"),
    ("Course 6 thickness 0.455 in", "0.455"),
    ("nameplate design specific gravity", "DESIGNSG:0.85"),
    ("nameplate diameter 25 m", "DIAMETERD:25.0m"),
    ("2021 survey readings", "14.1"),
    ("Course 5 not accessible scaffold", "scaffold unavailable"),
    ("P and ID tank 204", "TANK-204"),
    ("inspector initials K Menon", "K. Menon"),
    ("scope full shell spot grid", "Scope: full shell"),
]

SUPERSEDED_FILENAME = "SOP-09_Rev2.pdf"


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", default="run")
    args = parser.parse_args()

    get_settings.cache_clear()
    app = create_app()
    user_id = "user-001"
    await ingest(app, user_id)
    kb = app.state.knowledge_base

    hits = 0
    superseded_appearances = 0
    details = []
    for query, expected in EVAL_QUERIES:
        results = await kb.search(user_id, query, top_k=5)
        texts = [r.text for r in results]
        files = [r.filename for r in results]
        hit = any(expected in text for text in texts)
        superseded = SUPERSEDED_FILENAME in files
        hits += 1 if hit else 0
        superseded_appearances += 1 if superseded else 0
        details.append(
            {
                "query": query,
                "expected": expected,
                "hit": hit,
                "superseded": superseded,
                "top": [{"filename": r.filename, "page": r.page} for r in results],
            }
        )

    total = len(EVAL_QUERIES)
    summary = {
        "tag": args.tag,
        "queries": total,
        "recall_at_5": round(hits / total, 3),
        "hits": hits,
        "superseded_appearances": superseded_appearances,
        "details": details,
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    results_dir = ROOT / "bench" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    out = results_dir / f"{stamp}_retrieval_eval_{args.tag}.json"
    out.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")

    print(f"[{args.tag}] recall@5 = {hits}/{total} ({hits / total:.0%})")
    print(f"[{args.tag}] superseded appearances = {superseded_appearances}/{total}")
    for detail in details:
        mark = "hit " if detail["hit"] else "MISS"
        sup = " SUPERSEDED" if detail["superseded"] else ""
        print(f"  {mark} {detail['query']!r} -> {detail['expected']!r}{sup}")
    print("record:", out)


if __name__ == "__main__":
    asyncio.run(main())
