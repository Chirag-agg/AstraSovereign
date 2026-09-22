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

Table reconstruction is scored the same way — against ``constants.py``, the
file the fixtures themselves are drawn from — and reported as it measured, not
as it was hoped: a misread cell is listed with the confidence the engine gave
it, and the accuracy is the real fraction. Nothing here tunes a threshold to
make a fixture pass; a threshold that had to be tuned would be a finding, and
this file is where it would show up.
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
import constants  # noqa: E402


def _share(elements, has_value) -> str:
    if not elements:
        return "n/a"
    return f"{sum(1 for element in elements if has_value(element)) / len(elements):.0%}"


def _normalize(text) -> str:
    """Whitespace- and case-insensitive compare; nothing else is rewritten."""
    return "".join((text or "").split()).lower()


def expected_table_rows(filename: str):
    """The key -> thickness values each table should hold, from the constants.

    ``None`` for a document that has no table, which is a fact worth recording:
    a table found there is a false positive, and this file counts it.
    """
    if filename == "inspection_report_2026.pdf":
        expected = {}
        for course, raw in constants.READINGS_2026.items():
            if "handwritten_mm" in raw:
                # The struck-through printed value and the handwritten correction
                # are both in that cell, and both must survive.
                expected[f"C{course}"] = [str(raw["struck_mm"]), str(raw["handwritten_mm"])]
            elif "printed_in" in raw:
                expected[f"C{course}"] = [f"{raw['printed_in']} in"]
            else:
                expected[f"C{course}"] = [str(raw["printed_mm"])]
        return expected
    if filename == "inspection_report_2021.pdf":
        # Course 5 was not accessible, so it has no reading — and must not gain one.
        return {
            f"C{course}": [str(value)] for course, value in constants.READINGS_2021.items()
        }
    return None


def table_metrics(elements, expected_rows) -> dict:
    """Tables, rows, cells and values recovered, scored against the constants."""
    rows = [
        row
        for element in elements
        if element.type == "table"
        for row in element.table.rows
    ]
    cells = [cell for row in rows for cell in row]
    with_bbox = sum(1 for cell in cells if cell.bbox)

    metrics = {
        "tables": sum(1 for element in elements if element.type == "table"),
        "data_rows": len(rows),
        "cells": len(cells),
        "cells_with_bbox": with_bbox,
        "pct_cells_with_bbox": f"{with_bbox / len(cells):.0%}" if cells else "n/a",
        "ambiguous_cells": sum(1 for cell in cells if len(cell.candidates) > 1),
        "ambiguous_cells_kept": all(
            len(cell.candidates) > 1 for cell in cells if len(cell.candidates) > 1
        ),
        "expected_rows": None if expected_rows is None else len(expected_rows),
        "rows_recovered": None,
        "values_expected": None,
        "values_recovered": None,
        "value_accuracy": None,
        "misread": [],
    }
    if expected_rows is None:
        return metrics

    keyed = {}
    for row in rows:
        keys = [cell for cell in row if cell.col == 0 and cell.candidates]
        if keys:
            keyed[_normalize(keys[0].candidates[0].text)] = row

    expected_values = 0
    recovered = 0
    for key, wanted in expected_rows.items():
        expected_values += len(wanted)
        row = keyed.get(_normalize(key))
        if row is None:
            metrics["misread"].append(
                {"row": key, "expected": wanted, "got": [], "confidence": None}
            )
            continue
        cell = next((cell for cell in row if cell.col == 1), None)
        got = [candidate.text for candidate in cell.candidates] if cell else []
        confidence = cell.confidence if cell else None
        unmatched = [_normalize(text) for text in got]
        for want in wanted:
            if _normalize(want) in unmatched:
                unmatched.remove(_normalize(want))
                recovered += 1
            else:
                metrics["misread"].append(
                    {"row": key, "expected": [want], "got": got, "confidence": confidence}
                )
        for spare in unmatched:
            metrics["misread"].append(
                {"row": key, "expected": [], "got": [spare], "confidence": confidence}
            )

    metrics["rows_recovered"] = sum(
        1 for key in expected_rows if _normalize(key) in keyed
    )
    metrics["values_expected"] = expected_values
    metrics["values_recovered"] = recovered
    metrics["value_accuracy"] = (
        f"{recovered / expected_values:.0%}" if expected_values else "n/a"
    )
    return metrics


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
                "table": table_metrics(elements, expected_table_rows(path.name)),
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
    print(f"[{args.tag}] reconstructed tables")
    for entry in documents:
        if entry.get("status") == "not_ingested":
            continue
        table = entry["table"]
        print(
            f"  {entry['filename']:<32} tables={table['tables']} "
            f"rows={table['data_rows']}"
            + (
                ""
                if table["expected_rows"] is None
                else (
                    f" (expected {table['expected_rows']}, "
                    f"recovered {table['rows_recovered']}) "
                    f"cells={table['cells']} cell_bbox={table['pct_cells_with_bbox']} "
                    f"ambiguous={table['ambiguous_cells']} "
                    f"values={table['values_recovered']}/{table['values_expected']} "
                    f"accuracy={table['value_accuracy']}"
                )
            )
        )
    print(f"[{args.tag}] misread cells (empty is the good case)")
    any_misread = False
    for entry in documents:
        for miss in entry.get("table", {}).get("misread", []):
            any_misread = True
            print(
                f"  {entry['filename']} row={miss['row']} "
                f"expected={miss['expected']} got={miss['got']} "
                f"confidence={miss['confidence']}"
            )
    if not any_misread:
        print("  (none)")
    print("record:", out)


if __name__ == "__main__":
    asyncio.run(main())

