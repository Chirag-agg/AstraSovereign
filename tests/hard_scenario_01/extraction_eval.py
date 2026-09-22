"""Extraction-artifact metrics for Hard Scenario 01.

Per fixture document: element count, and the share of elements carrying a bbox
and a confidence — the provenance the structure-aware branch is about. Run
after any ingestion change:

    backend\\.venv\\Scripts\\python.exe tests\\hard_scenario_01\\extraction_eval.py --tag phase1

Writes bench/results/<stamp>_extraction_eval_<tag>.json and prints the summary.

A text-layer element legitimately has neither a bbox nor a confidence (a PDF
text layer exposes neither, and inventing them would be a lie), so a document
that is all text layer reports 0%/0% by design. The number this file exists to
move is the OCR one: recognised text used to be flattened into a page string
and arrived as a single element with no geometry at all.
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
from run_nodes_direct import FIXTURES, ingest  # noqa: E402


def _share(elements, has_value) -> str:
    if not elements:
        return "n/a"
    return f"{sum(1 for element in elements if has_value(element)) / len(elements):.0%}"


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", default="run")
    args = parser.parse_args()

    get_settings.cache_clear()
    app = create_app()
    user_id = "user-001"
    await ingest(app, user_id)
    kb = app.state.knowledge_base

    documents: list[dict] = []
    for path in sorted(FIXTURES.glob("*")):
        doc = next(
            (d for d in await kb.list_documents(user_id) if d.filename == path.name),
            None,
        )
        if doc is None:
            documents.append({"filename": path.name, "status": "not_ingested"})
            continue
        extraction = kb.get_extraction(user_id, doc.document_id)
        elements = list(extraction.elements) if extraction else []
        sources: dict[str, int] = {}
        for element in elements:
            key = element.source or "unknown"
            sources[key] = sources.get(key, 0) + 1
        documents.append(
            {
                "filename": path.name,
                "status": str(doc.status),
                "document_type": doc.document_type,
                "elements": len(elements),
                "with_bbox": sum(1 for element in elements if element.bbox),
                "with_confidence": sum(
                    1 for element in elements if element.confidence is not None
                ),
                "pct_bbox": _share(elements, lambda element: element.bbox),
                "pct_confidence": _share(
                    elements, lambda element: element.confidence is not None
                ),
                "sources": sources,
                "schema_version": extraction.schema_version if extraction else None,
                "markdown_chars": len(extraction.markdown) if extraction else 0,
            }
        )

    summary = {"tag": args.tag, "documents": documents}
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    results_dir = ROOT / "bench" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    out = results_dir / f"{stamp}_extraction_eval_{args.tag}.json"
    out.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")

    print(f"[{args.tag}] extraction artifacts")
    for entry in documents:
        if entry.get("status") == "not_ingested":
            print(f"  --     {entry['filename']}: not ingested")
            continue
        print(
            f"  {entry['status']:<7} {entry['filename']:<32} "
            f"n={entry['elements']:<4} bbox={entry['pct_bbox']:>4} "
            f"conf={entry['pct_confidence']:>4} sources={entry['sources']}"
        )
    print("record:", out)


if __name__ == "__main__":
    asyncio.run(main())
