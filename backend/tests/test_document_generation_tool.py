"""DocumentGenerationTool tests: validation, workspace isolation, artifact
registration, failure cleanup, sources, resource scheduling, and log hygiene."""

import asyncio
import logging
from pathlib import Path

import pytest

from app.schemas.artifact import ArtifactStatus
from app.schemas.resources import ResourceCapacity, ResourceRequirements
from app.services.artifact_store import InMemoryArtifactStore
from app.services.document_generator import (
    DocumentGenerationError,
    DocumentGenerator,
    WordDocumentGenerator,
)
from app.services.log_context import set_job_context
from app.services.resource_provider import InMemoryResourceProvider
from app.services.resource_scheduler import InMemoryResourceScheduler
from app.services.tool_registry import ToolRegistry
from app.services.tools import DocumentGenerationTool, ToolError
from tests.conftest import default_capacity

VALID_ARGS = {
    "type": "word",
    "filename": "approval_note.docx",
    "title": "Inspection Approval Note",
    "document_type": "approval_note",
    "sections": [
        {"heading": "Inspection Summary", "paragraphs": ["Pump inspected on 2026-08-15."]},
        {"heading": "Key Findings", "bullets": ["Vibration 2.1 mm/s", "Seal leakage 3 ml/hr"]},
        {"heading": "Required Actions", "numbered": ["Monitor the seal"]},
    ],
    "sources": ["inspection_report.pdf, page 1", "pump_maintenance_manual.txt"],
}


def run(coro):
    return asyncio.run(coro)


def make_tool(tmp_path, requirements=None, capacity=None, generator=None, wait_rounds=3):
    store = InMemoryArtifactStore()
    scheduler = InMemoryResourceScheduler(
        InMemoryResourceProvider(capacity or default_capacity())
    )
    tool = DocumentGenerationTool(
        generator=generator or WordDocumentGenerator(),
        artifact_store=store,
        scheduler=scheduler,
        requirements=requirements,
        wait_rounds=wait_rounds,
    )
    return tool, store, scheduler


def docx_texts(path):
    from docx import Document

    return [p.text for p in Document(str(path)).paragraphs]


class FailingGenerator(DocumentGenerator):
    supported_types = ("word",)

    async def generate(self, content, output_dir, filename):
        (Path(output_dir) / filename).write_bytes(b"partial data")
        raise DocumentGenerationError("boom")

    def describe(self):
        return {"generator": "failing", "types": ["word"]}


def test_tool_generates_word_artifact(tmp_path):
    tool, store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t1")
    result = run(tool.execute(tmp_path, VALID_ARGS))
    assert result.ok
    assert "approval_note.docx" in result.content
    assert "Artifact ID:" in result.content

    artifact_file = tmp_path / "artifacts" / "approval_note.docx"
    assert artifact_file.is_file()
    assert artifact_file.stat().st_size > 0
    assert "Inspection Approval Note" in docx_texts(artifact_file)

    artifacts = run(store.list_for_job("job-t1"))
    assert len(artifacts) == 1
    artifact = artifacts[0]
    assert artifact.status == ArtifactStatus.COMPLETED
    assert artifact.type == "word"
    assert artifact.filename == "approval_note.docx"
    assert artifact.size_bytes == artifact_file.stat().st_size
    assert artifact.job_id == "job-t1"
    assert artifact.user_id == "user-001"


def test_tool_artifact_metadata(tmp_path):
    tool, store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t1")
    run(tool.execute(tmp_path, VALID_ARGS))
    artifacts = run(store.list_for_job("job-t1"))
    assert len(artifacts) == 1
    artifact = artifacts[0]
    assert artifact.status == ArtifactStatus.COMPLETED
    assert artifact.type == "word"
    assert artifact.job_id == "job-t1"
    assert artifact.user_id == "user-001"
    assert artifact.filename == "approval_note.docx"
    assert artifact.size_bytes > 0
    assert artifact.path.endswith("approval_note.docx")


def test_tool_supports_content_string_sections(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    args = {
        "type": "word",
        "filename": "summary.docx",
        "title": "Summary",
        "sections": [{"heading": "Findings", "content": "Seal leakage 3 ml/hr observed."}],
    }
    set_job_context(user_id="user-001", job_id="job-t2")
    result = run(tool.execute(tmp_path, args))
    assert result.ok
    assert "Seal leakage 3 ml/hr observed." in docx_texts(tmp_path / "artifacts" / "summary.docx")


def test_tool_rejects_unsupported_type(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t3")
    with pytest.raises(ToolError, match="unsupported document type"):
        run(tool.execute(tmp_path, {**VALID_ARGS, "type": "excel"}))


def test_tool_rejects_invalid_filenames(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t4")
    for bad in ("../evil.docx", "/abs/path.docx", "dir\\evil.docx", ".hidden.docx", "note.doc", "note"):
        with pytest.raises(ToolError):
            run(tool.execute(tmp_path, {**VALID_ARGS, "filename": bad}))


def test_tool_rejects_malformed_sections(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t5")
    with pytest.raises(ToolError, match="unknown section field"):
        run(tool.execute(tmp_path, {**VALID_ARGS, "sections": [{"heading": "X", "bogus": 1}]}))
    with pytest.raises(ToolError, match="paragraphs"):
        run(tool.execute(tmp_path, {**VALID_ARGS, "sections": [{"paragraphs": "not-a-list"}]}))
    with pytest.raises(ToolError, match="at least one"):
        run(tool.execute(tmp_path, {**VALID_ARGS, "sections": [{"heading": ""}]}))


def test_tool_rejects_oversized_content(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t6")
    huge = {"heading": "Huge", "paragraphs": ["x" * 200_001]}
    with pytest.raises(ToolError, match="maximum"):
        run(tool.execute(tmp_path, {**VALID_ARGS, "sections": [huge]}))


def test_tool_requires_user_and_job_context(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context()
    with pytest.raises(ToolError, match="user context"):
        run(tool.execute(tmp_path, VALID_ARGS))
    set_job_context(user_id="user-001")
    with pytest.raises(ToolError, match="job context"):
        run(tool.execute(tmp_path, VALID_ARGS))


def test_tool_writes_only_inside_workspace(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t7")
    run(tool.execute(tmp_path, VALID_ARGS))
    artifact_file = tmp_path / "artifacts" / "approval_note.docx"
    assert artifact_file.is_file()
    # nothing outside the workspace or the artifacts subdir
    assert set(tmp_path.iterdir()) == {tmp_path / "artifacts"}
    assert set((tmp_path / "artifacts").iterdir()) == {artifact_file}


def test_generation_failure_cleans_partial_file(tmp_path):
    tool, store, _scheduler = make_tool(tmp_path, generator=FailingGenerator())
    set_job_context(user_id="user-001", job_id="job-t8")
    with pytest.raises(ToolError, match="document_generation failed"):
        run(tool.execute(tmp_path, VALID_ARGS))
    assert not (tmp_path / "artifacts" / "approval_note.docx").exists()
    artifacts = run(store.list_for_job("job-t8"))
    assert len(artifacts) == 1
    assert artifacts[0].status == ArtifactStatus.FAILED


def test_tool_sources_preserved_in_document(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-t9")
    run(tool.execute(tmp_path, VALID_ARGS))
    texts = docx_texts(tmp_path / "artifacts" / "approval_note.docx")
    assert "inspection_report.pdf, page 1" in texts
    assert "pump_maintenance_manual.txt" in texts


def test_registry_validates_document_generation_args(tmp_path):
    tool, _store, _scheduler = make_tool(tmp_path)
    registry = ToolRegistry([tool])
    set_job_context(user_id="user-001", job_id="job-reg")
    result = run(registry.execute("document_generation", VALID_ARGS, tmp_path))
    assert result.ok
    with pytest.raises(ToolError, match="array of objects"):
        run(registry.execute("document_generation", {**VALID_ARGS, "sections": ["nope"]}, tmp_path))
    with pytest.raises(ToolError, match="array of strings"):
        run(registry.execute("document_generation", {**VALID_ARGS, "sources": [1, 2]}, tmp_path))


def test_resource_scheduling_grant_and_release(tmp_path):
    tool, _store, scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-res")
    result = run(tool.execute(tmp_path, VALID_ARGS))
    assert result.ok
    assert scheduler.stats()["running_jobs"] == 0
    assert scheduler.provider().allocated() == []


def test_resource_scheduling_rejection_fails_cleanly(tmp_path):
    capacity = ResourceCapacity(cpu_cores=0.5, memory_mb=100, gpus=[])
    tool, store, _scheduler = make_tool(tmp_path, capacity=capacity)
    set_job_context(user_id="user-001", job_id="job-reject")
    with pytest.raises(ToolError, match="resources rejected"):
        run(tool.execute(tmp_path, VALID_ARGS))
    artifacts = run(store.list_for_job("job-reject"))
    assert artifacts and artifacts[0].status == ArtifactStatus.FAILED


def test_no_sensitive_content_in_logs(tmp_path, caplog):
    marker = "TOP-SECRET-CONTENT-99"
    args = {
        "type": "word",
        "filename": "secret_note.docx",
        "title": "Secret",
        "sections": [{"heading": "Hidden", "content": marker + " classified findings"}],
    }
    tool, _store, _scheduler = make_tool(tmp_path)
    set_job_context(user_id="user-001", job_id="job-log")
    with caplog.at_level(logging.INFO, logger="app"):
        result = run(tool.execute(tmp_path, args))
    assert result.ok
    record_text = " ".join(
        str(v) for r in caplog.records for v in r.__dict__.values()
        if not str(v).startswith("<") and "LogRecord" not in str(type(v))
    )
    assert marker not in record_text
    assert "classified findings" not in record_text
    assert "document_generation_started" in record_text
    assert "document_generation_completed" in record_text
    assert "artifact_created" in record_text
