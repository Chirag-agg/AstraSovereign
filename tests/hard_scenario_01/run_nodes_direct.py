"""Run the hard scenario against NodeAgent directly (no queue), real models.

    backend\\.venv\\Scripts\\python.exe tests\\hard_scenario_01\\run_nodes_direct.py

Builds the real app services, ingests the fixtures, then runs the node sequence
in-process so the per-node routing records are isolated from the worker path.
"""

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.attachments import build_attachment_manifest  # noqa: E402
from app.services.capability_router import CapabilityRouter  # noqa: E402
from app.services.document_ingestion import (  # noqa: E402
    IMAGE_DOCUMENT_TYPES,
    DocumentIngestionError,
    DocumentRequiresOCR,
    document_type_for,
    extract_document_pages,
)
from app.services.nodes import NodeAgent  # noqa: E402

FIXTURES = ROOT / "tests" / "fixtures" / "hard_scenario_01"
PROMPT = (
    "Assess Tank 204 for continued service using the current and previous inspection "
    "reports and our tank shell evaluation procedure. For every shell course, determine "
    "the corrosion rate, the remaining life, and the next inspection date. Produce an "
    "approval note recommending a course of action, a spreadsheet showing the "
    "calculations, and a short deck for the maintenance review meeting."
)


async def ingest(app, user_id: str) -> None:
    kb = app.state.knowledge_base
    multimodal = app.state.multimodal_service
    for path in sorted(FIXTURES.glob("*")):
        document_type = document_type_for(path.name)
        if document_type in IMAGE_DOCUMENT_TYPES:
            await multimodal.ingest_scanned(user_id, path, path.name)
            print(f"ingested image/scan: {path.name}")
            continue
        if document_type == "pdf":
            try:
                extract_document_pages(path, "pdf")
            except DocumentRequiresOCR:
                await multimodal.ingest_scanned(user_id, path, path.name)
                print(f"ingested scanned pdf: {path.name}")
                continue
            except DocumentIngestionError:
                pass
        await kb.ingest_document(user_id, path, path.name)
        print(f"ingested text: {path.name}")


async def main() -> None:
    get_settings.cache_clear()
    app = create_app()
    user_id = "user-001"
    await ingest(app, user_id)

    job = await app.state.job_manager.create_job(user_id=user_id, message=PROMPT)
    workspace = await app.state.workspace_manager.create_workspace(user_id, job.job_id)
    documents = await app.state.knowledge_base.list_documents(user_id)
    manifest = build_attachment_manifest(documents)
    print("\n=== ATTACHMENT MANIFEST ===")
    for entry in manifest:
        print(" ", entry)
    node_agent = NodeAgent(
        agent=app.state.agent,
        capability_router=CapabilityRouter(app.state.model_registry),
        registry=app.state.model_registry,
    )
    result = await node_agent.run(job, workspace, task_text=PROMPT, attachments=manifest)

    final = await app.state.job_manager.get_job_for_worker(job.job_id)
    trace = final.execution_trace or []
    print("\n=== NODE EVENTS ===")
    for entry in trace:
        if entry.get("type") in ("node_started", "node_completed", "node_skipped", "node_degraded"):
            print(json.dumps(entry, default=str))

    print("\n=== TOOL CALLS ===")
    print([e.get("tool") for e in trace if e.get("type") == "tool_call"])

    artifacts = await app.state.artifact_store.list_for_job(job.job_id)
    print("\n=== ARTIFACTS ===")
    print([(a.filename, a.type, a.status) for a in artifacts])

    print("\n=== RESULT ===")
    print("status:", result.status, "| iterations:", result.iterations)
    print("response:", (result.response or "")[:600])
    retrieval = node_agent.last_retrieval or ""
    print("retrieval cites Rev2:", "rev 2" in retrieval.lower(), "| Rev3:", "rev 3" in retrieval.lower())
    assessment = node_agent.last_assessment
    if assessment:
        print("assessment:", [(c.course, c.status, c.reason_code) for c in assessment.courses])


if __name__ == "__main__":
    asyncio.run(main())
