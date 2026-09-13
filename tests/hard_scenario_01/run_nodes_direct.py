"""Run the hard scenario against NodeAgent directly (no queue), real models.

    backend\\.venv\\Scripts\\python.exe tests\\hard_scenario_01\\run_nodes_direct.py

Builds the real app services, ingests the fixtures, then runs the node sequence
in-process so the per-node routing records are isolated from the worker path.
Captures per-node iterations/tool calls, whether document_vision targeted the
nameplate, and what it returned for that image.
"""

import asyncio
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tests" / "hard_scenario_01"))

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
from app.services.log_context import set_job_context  # noqa: E402
from app.services.nodes import NodeAgent  # noqa: E402
import verify  # noqa: E402

FIXTURES = ROOT / "tests" / "fixtures" / "hard_scenario_01"
PROMPT = (
    "Assess Tank 204 for continued service using the current and previous inspection "
    "reports and our tank shell evaluation procedure. For every shell course, determine "
    "the corrosion rate, the remaining life, and the next inspection date. Produce an "
    "approval note recommending a course of action, a spreadsheet showing the "
    "calculations, and a short deck for the maintenance review meeting."
)

# Ordered marker -> node, used to attribute recorded agent calls to a node.
_NODE_MARKERS = (
    ("extract", "Extract a single JSON findings object"),
    ("retrieve", "MUST call document_search"),
    ("compute", "Compute corrosion rate"),
    ("draft", "Build ALL THREE deliverables"),
    ("draft", "Answer the request using the results below"),
)


def node_of(task_text: str) -> str:
    for node, marker in _NODE_MARKERS:
        if marker in (task_text or ""):
            return node
    return "unknown"


class RecordingAgent:
    """Delegates to the real Agent and records each node call's AgentResult."""

    def __init__(self, inner) -> None:
        self._inner = inner
        self.calls: list[dict] = []

    async def run(self, job, **kwargs):
        result = await self._inner.run(job, **kwargs)
        self.calls.append(
            {
                "node": node_of(kwargs.get("task_text", "")),
                "model": kwargs.get("model"),
                "iterations": result.iterations,
                "tool_calls": result.tool_calls,
                "status": result.status,
                "legacy_envelope_used": getattr(result, "legacy_envelope_used", 0),
                "argument_coercions": getattr(result, "argument_coercions", 0),
            }
        )
        return result

    async def record_trace(self, *args, **kwargs):
        return await self._inner.record_trace(*args, **kwargs)


async def reset_user_kb(app, user_id: str) -> None:
    """Drop the user's existing documents so a run starts from the fixtures only.

    The persistent KB accumulates duplicates and unrelated documents across runs;
    the manifest must be the job's attachments, not the whole user library.
    """
    kb = app.state.knowledge_base
    for document in await kb.list_documents(user_id):
        await kb.delete_document(user_id, document.document_id)


async def ingest(app, user_id: str) -> None:
    await reset_user_kb(app, user_id)
    kb = app.state.knowledge_base
    multimodal = app.state.multimodal_service
    for path in sorted(FIXTURES.glob("*")):
        document_type = document_type_for(path.name)
        if document_type in IMAGE_DOCUMENT_TYPES:
            await multimodal.ingest_scanned(user_id, path, path.name)
            continue
        if document_type == "pdf":
            try:
                extract_document_pages(path, "pdf")
            except DocumentRequiresOCR:
                await multimodal.ingest_scanned(user_id, path, path.name)
                continue
            except DocumentIngestionError:
                pass
        await kb.ingest_document(user_id, path, path.name)


def parse_nodes(trace: list[dict]) -> list[dict]:
    nodes: list[dict] = []

    def find(name: str) -> dict:
        for node in nodes:
            if node["node"] == name:
                return node
        node = {
            "node": name,
            "capability": None,
            "model": None,
            "confidence": None,
            "runner_up": None,
            "tool_calls": [],
            "iterations": None,
            "tool_calls_made": None,
            "outcome": None,
            "reason": "",
        }
        nodes.append(node)
        return node

    current = None
    for entry in trace:
        etype = entry.get("type")
        if etype == "node_started":
            current = find(entry["node"])
            current.update(
                capability=entry.get("capability"),
                model=entry.get("model"),
                confidence=entry.get("confidence"),
                runner_up=entry.get("runner_up"),
            )
        elif etype == "node_completed":
            find(entry["node"])["outcome"] = "completed"
        elif etype == "node_degraded":
            node = find(entry["node"])
            node["outcome"] = "degraded"
            node["reason"] = entry.get("reason", "")
        elif etype == "node_skipped":
            node = find(entry["node"])
            node["outcome"] = "skipped"
            node["reason"] = entry.get("reason", "")
        elif etype == "tool_call" and current is not None:
            current["tool_calls"].append(
                {"tool": entry.get("tool"), "arguments": entry.get("arguments")}
            )
    return nodes


async def main() -> None:
    get_settings.cache_clear()
    app = create_app()
    user_id = "user-001"
    await ingest(app, user_id)

    job = await app.state.job_manager.create_job(user_id=user_id, message=PROMPT)
    workspace = await app.state.workspace_manager.create_workspace(user_id, job.job_id)
    documents = await app.state.knowledge_base.list_documents(user_id)
    fixture_names = {path.name for path in FIXTURES.glob("*")}
    manifest = build_attachment_manifest(
        [doc for doc in documents if doc.filename in fixture_names]
    )
    doc_names = {item["doc_id"]: item["filename"] for item in manifest}
    print("=== ATTACHMENT MANIFEST ===")
    for entry in manifest:
        print(" ", entry)

    recorder = RecordingAgent(app.state.agent)
    node_agent = NodeAgent(
        agent=recorder,
        capability_router=CapabilityRouter(app.state.model_registry),
        registry=app.state.model_registry,
    )
    result = await node_agent.run(job, workspace, task_text=PROMPT, attachments=manifest)

    final = await app.state.job_manager.get_job_for_worker(job.job_id)
    trace = final.execution_trace or []
    nodes = parse_nodes(trace)

    # Merge recorded per-node iterations/tool counts (skipped nodes make no call).
    unmatched = list(recorder.calls)
    for node in nodes:
        for call in list(unmatched):
            if call["node"] == node["node"]:
                node["iterations"] = call["iterations"]
                node["tool_calls_made"] = call["tool_calls"]
                unmatched.remove(call)
                break

    vision_targets = [
        {
            "node": node["node"],
            "doc_id": (call["arguments"] or {}).get("document_id"),
            "filename": doc_names.get((call["arguments"] or {}).get("document_id"), "?"),
        }
        for node in nodes
        for call in node["tool_calls"]
        if call["tool"] == "document_vision"
    ]
    vision_on_nameplate = any(t["filename"] == "tank204_nameplate.jpg" for t in vision_targets)

    # Direct read of the nameplate to record what the vision model returns.
    set_job_context(job_id=job.job_id, user_id=user_id)
    nameplate_id = next(
        (m["doc_id"] for m in manifest if m["filename"] == "tank204_nameplate.jpg"), None
    )
    nameplate_vision = None
    if nameplate_id:
        tool = app.state.tool_registry.get("document_vision")
        vr = await tool.execute(
            workspace,
            {
                "document_id": nameplate_id,
                "question": (
                    "Read the tank geometry from this nameplate: diameter, height, "
                    "design specific gravity, allowable stress, joint efficiency, material."
                ),
            },
        )
        nameplate_vision = {"summary": vr.summary, "content": (vr.content or "")[:2000]}

    # Score the deliverables (copy them out of the workspace first).
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    results_dir = ROOT / "bench" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    score_dir = results_dir / f"{stamp}_hard_scenario_01_nodes_artifacts"
    if score_dir.exists():
        shutil.rmtree(score_dir)
    score_dir.mkdir(parents=True)
    artifacts = await app.state.artifact_store.list_for_job(job.job_id)
    for artifact in artifacts:
        if artifact.status == "completed":
            source = Path(artifact.path)
            if source.is_file():
                shutil.copy2(source, score_dir / artifact.filename)
    trace_path = score_dir / "job_trace.json"
    trace_path.write_text(json.dumps(final.model_dump(), indent=2, default=str), encoding="utf-8")
    verdict = verify.score(score_dir, trace_path)

    legacy_by_model: dict[str, int] = {}
    for call in recorder.calls:
        if call["legacy_envelope_used"]:
            legacy_by_model[call["model"]] = (
                legacy_by_model.get(call["model"], 0) + call["legacy_envelope_used"]
            )
    coercions_by_model: dict[str, int] = {}
    for call in recorder.calls:
        if call.get("argument_coercions"):
            coercions_by_model[call["model"]] = (
                coercions_by_model.get(call["model"], 0) + call["argument_coercions"]
            )

    record = {
        "scenario": "Hard Scenario 01 (node-direct)",
        "timestamp": stamp,
        "job_id": job.job_id,
        "score": verdict["score"],
        "max": verdict["max"],
        "trap_passed": verdict["trap_passed"],
        "rubric": verdict["items"],
        "nodes": nodes,
        "vision_targets": vision_targets,
        "vision_called_on_nameplate": vision_on_nameplate,
        "nameplate_vision_result": nameplate_vision,
        "legacy_envelope_used_by_model": legacy_by_model,
        "argument_coercions_by_model": coercions_by_model,
        "artifacts": [(a.filename, a.type, a.status) for a in artifacts],
        "response": (result.response or "")[:800],
    }
    record_path = results_dir / f"{stamp}_hard_scenario_01_nodes.json"
    record_path.write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")

    print("\n=== NODES ===")
    for node in nodes:
        print(json.dumps(node, default=str))
    print("\n=== VISION TARGETS ===", vision_targets)
    print("vision called on nameplate:", vision_on_nameplate)
    if nameplate_vision:
        print("nameplate summary:", nameplate_vision["summary"])
        print("nameplate content:", nameplate_vision["content"][:600])
    print("\n=== SCORE ===", verdict["score"], "/", verdict["max"], "trap_passed:", verdict["trap_passed"])
    print("legacy_envelope_used_by_model:", legacy_by_model)
    print("argument_coercions_by_model:", coercions_by_model)
    print("record:", record_path)


if __name__ == "__main__":
    asyncio.run(main())
