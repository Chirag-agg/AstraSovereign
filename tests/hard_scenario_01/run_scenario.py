"""Run Hard Scenario 01 end-to-end against a running AstraSovereign backend.

    python run_scenario.py [--base-url http://127.0.0.1:8000] [--user user-001]

Uploads the fixtures, submits the prompt, polls the job, downloads the artifacts,
runs verify.py, and writes a record to bench/results/. Expect this to fail
against the current system; the failure list is the ingestion-week specification.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import verify  # noqa: E402

FIXTURES = ROOT / "tests" / "fixtures" / "hard_scenario_01"
PROMPT = (
    "Assess Tank 204 for continued service using the current and previous inspection "
    "reports and our tank shell evaluation procedure. For every shell course, determine "
    "the corrosion rate, the remaining life, and the next inspection date. Produce an "
    "approval note recommending a course of action, a spreadsheet showing the "
    "calculations, and a short deck for the maintenance review meeting."
)
TERMINAL = {"completed", "failed", "cancelled"}


def run(base_url: str, user_id: str, timeout_seconds: float) -> dict:
    import constants as C

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    results_dir = ROOT / "bench" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir = results_dir / f"{stamp}_hard_scenario_01_artifacts"
    if artifacts_dir.exists():
        shutil.rmtree(artifacts_dir)
    artifacts_dir.mkdir(parents=True)

    headers = {"X-User-ID": user_id}
    client = httpx.Client(base_url=base_url, headers=headers, timeout=180.0)

    health = client.get("/health")
    health.raise_for_status()

    # Start from a clean user library so the run matches the direct harness.
    existing = client.get("/api/documents")
    if existing.status_code == 200:
        for document in existing.json():
            client.delete(f"/api/documents/{document['document_id']}")

    upload_start = time.monotonic()
    uploaded = []
    document_ids = []
    for path in sorted(FIXTURES.glob("*")):
        with path.open("rb") as handle:
            response = client.post("/api/documents", files={"file": (path.name, handle)})
        response.raise_for_status()
        metadata = response.json()
        document_ids.append(metadata["document_id"])
        uploaded.append(
            {
                "file": path.name,
                "status": response.status_code,
                "document_id": metadata.get("document_id"),
            }
        )
    upload_seconds = time.monotonic() - upload_start

    submit = client.post(
        "/api/chat", json={"message": PROMPT, "document_ids": document_ids}
    )
    submit.raise_for_status()
    job_id = submit.json()["job_id"]

    generation_start = time.monotonic()
    job = {}
    while time.monotonic() - generation_start < timeout_seconds:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job.get("status") in TERMINAL:
            break
        time.sleep(2)
    generation_seconds = time.monotonic() - generation_start

    for artifact in job.get("artifacts", []):
        if artifact.get("status") != "completed":
            continue
        response = client.get(
            f"/api/jobs/{job_id}/artifacts/{artifact['artifact_id']}"
        )
        if response.status_code == 200:
            (artifacts_dir / artifact["filename"]).write_bytes(response.content)

    trace_path = artifacts_dir / "job_trace.json"
    trace_path.write_text(json.dumps(job, indent=2, default=str), encoding="utf-8")

    verdict = verify.score(artifacts_dir, trace_path)
    trace = job.get("execution_trace", [])
    tool_results = [step for step in trace if step.get("type") == "tool_result"]
    models = sorted(
        {
            step.get("model")
            for step in trace
            if isinstance(step, dict) and step.get("model")
        }
    )

    record = {
        "scenario": C.NAME,
        "timestamp": stamp,
        "job_id": job_id,
        "job_status": job.get("status"),
        "job_error": job.get("error"),
        "prompt": PROMPT,
        "uploaded": uploaded,
        "score": verdict["score"],
        "max": verdict["max"],
        "rubric": verdict["items"],
        "trap_passed": verdict["trap_passed"],
        "auto_fail": verdict["auto_fail"],
        "passed": verdict["passed"],
        "models_used": models,
        "routing": [
            {"step": step.get("step"), "type": step.get("type"), "model": step.get("model")}
            for step in trace
            if isinstance(step, dict) and step.get("model")
        ],
        "agent_iterations": job.get("iteration_count"),
        "tool_calls": len([s for s in trace if isinstance(s, dict) and s.get("type") == "tool_call"]),
        "tool_failures": len([s for s in tool_results if not s.get("ok")]),
        "timing_seconds": {
            "upload": round(upload_seconds, 2),
            "generation": round(generation_seconds, 2),
        },
        "peak_vram_mb": None,
        "external_connection_attempts": None,
        "artifacts_dir": str(artifacts_dir),
    }
    (results_dir / f"{stamp}_hard_scenario_01.json").write_text(
        json.dumps(record, indent=2, default=str), encoding="utf-8"
    )
    return record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--user", default="user-001")
    parser.add_argument("--timeout", type=float, default=1800.0)
    args = parser.parse_args()
    record = run(args.base_url, args.user, args.timeout)
    print(json.dumps({k: record[k] for k in ("job_status", "score", "max", "trap_passed", "passed")}, indent=2))
    return 0 if record["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
