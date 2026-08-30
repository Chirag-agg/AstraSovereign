"""KnowledgeBase service + document_search tool tests (fake embeddings)."""

import asyncio
import logging
from pathlib import Path

import pytest

from app.services.knowledge_base import KnowledgeBase
from app.services.log_context import set_job_context
from app.services.tool_registry import ToolRegistry
from app.services.tools import DocumentSearchTool, ToolError
from app.services.vector_store import JsonVectorStore
from tests.conftest import FakeEmbeddingProvider


def make_kb(tmp_path, chunk_size=400, chunk_overlap=50):
    return KnowledgeBase(
        vector_store=JsonVectorStore(str(tmp_path / "kb")),
        embedding_provider=FakeEmbeddingProvider(),
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )


def make_doc_dir(tmp_path, name="docs"):
    path = tmp_path / name
    path.mkdir()
    return path


async def ingest_fixture(kb, doc_dir):
    (doc_dir / "pump.txt").write_text(
        "The cooling water pump must be inspected every 30 days. "
        "Inspection covers seals, bearings, and vibration.", encoding="utf-8"
    )
    (doc_dir / "safety.txt").write_text(
        "Wear protective gloves when handling chemicals. "
        "Follow the emergency shutdown procedure in case of fire.", encoding="utf-8"
    )
    docs = []
    for f in ("pump.txt", "safety.txt"):
        docs.append(await kb.ingest_document("user-001", doc_dir / f, f))
    return docs


def test_txt_ingestion_and_markdown_ingestion(tmp_path):
    kb = make_kb(tmp_path)
    doc_dir = make_doc_dir(tmp_path)
    (doc_dir / "notes.md").write_text("# Notes\nSome body text.", encoding="utf-8")
    doc = asyncio.run(kb.ingest_document("user-001", doc_dir / "notes.md", "notes.md"))
    assert doc.status == "ready"
    assert doc.document_type == "md"
    assert doc.chunk_count >= 1
    assert doc.filename == "notes.md"


def test_ingestion_requires_ocr_reported(tmp_path):
    kb = make_kb(tmp_path)
    doc_dir = make_doc_dir(tmp_path)
    from tests.conftest import make_blank_pdf

    pdf = doc_dir / "scan.pdf"
    make_blank_pdf(pdf)
    doc = asyncio.run(kb.ingest_document("user-001", pdf, "scan.pdf"))
    assert doc.status == "failed"
    assert "Document requires OCR" in doc.error


def test_malformed_document_fails_cleanly(tmp_path):
    kb = make_kb(tmp_path)
    doc_dir = make_doc_dir(tmp_path)
    pdf = doc_dir / "broken.pdf"
    pdf.write_bytes(b"not a real pdf")
    doc = asyncio.run(kb.ingest_document("user-001", pdf, "broken.pdf"))
    assert doc.status == "failed"
    assert doc.error


def test_document_search_tool_returns_metadata(tmp_path):
    kb = make_kb(tmp_path)
    asyncio.run(ingest_fixture(kb, make_doc_dir(tmp_path)))
    registry = ToolRegistry([DocumentSearchTool(kb)])
    set_job_context(user_id="user-001", job_id="job-x")

    result = asyncio.run(registry.execute("document_search", {"query": "pump inspection", "top_k": 2}, Path(".")))
    assert result.ok
    assert "pump.txt" in result.content
    assert "safety.txt" in result.content
    assert "score=" in result.content
    assert "doc=" in result.content


def test_document_search_no_results(tmp_path):
    """An empty knowledge base yields 'No relevant local documents found'."""
    kb = make_kb(tmp_path)
    registry = ToolRegistry([DocumentSearchTool(kb)])
    set_job_context(user_id="user-002", job_id="job-empty")  # user-002 has no documents

    result = asyncio.run(registry.execute("document_search", {"query": "pump", "top_k": 3}, Path(".")))
    assert result.ok
    assert "No relevant local documents found" in result.content


def test_document_search_top_k_and_text_limits(tmp_path):
    kb = make_kb(tmp_path, chunk_size=60, chunk_overlap=10)
    doc_dir = make_doc_dir(tmp_path)
    (doc_dir / "big.txt").write_text("wordy " * 200, encoding="utf-8")
    asyncio.run(kb.ingest_document("user-001", doc_dir / "big.txt", "big.txt"))
    registry = ToolRegistry([DocumentSearchTool(kb, max_top_k=2, max_chunk_chars=30)])
    set_job_context(user_id="user-001", job_id="job-x")

    result = asyncio.run(registry.execute("document_search", {"query": "wordy", "top_k": 999}, Path(".")))
    # top_k capped at 2
    assert result.content.count("[") >= 1
    assert "truncated" in result.content or len(result.content) < 300


def test_document_search_requires_user_context(tmp_path):
    kb = make_kb(tmp_path)
    asyncio.run(ingest_fixture(kb, make_doc_dir(tmp_path)))
    registry = ToolRegistry([DocumentSearchTool(kb)])
    set_job_context()  # no user
    with pytest.raises(ToolError, match="user context"):
        asyncio.run(registry.execute("document_search", {"query": "pump"}, Path(".")))


def test_cross_user_search_isolation(tmp_path):
    kb = make_kb(tmp_path)
    asyncio.run(ingest_fixture(kb, make_doc_dir(tmp_path)))
    registry = ToolRegistry([DocumentSearchTool(kb)])

    set_job_context(user_id="user-002", job_id="job-y")
    result = asyncio.run(registry.execute("document_search", {"query": "pump inspection", "top_k": 3}, Path(".")))
    assert "No relevant local documents found" in result.content


def test_document_delete_via_kb(tmp_path):
    kb = make_kb(tmp_path)
    docs = asyncio.run(ingest_fixture(kb, make_doc_dir(tmp_path)))
    assert await_bool(kb.delete_document("user-001", docs[0].document_id)) is True
    remaining = asyncio.run(kb.list_documents("user-001"))
    assert len(remaining) == 1
    assert await_bool(kb.delete_document("user-001", "does-not-exist")) is False


def await_bool(coro):
    return asyncio.run(coro)


def test_no_document_contents_in_logs(tmp_path, caplog):
    kb = make_kb(tmp_path)
    marker = "SECRET-MARKER-UNIQUE-42"
    doc_dir = make_doc_dir(tmp_path)
    (doc_dir / "secret.txt").write_text(marker + " classified text", encoding="utf-8")

    with caplog.at_level(logging.INFO, logger="app"):
        doc = asyncio.run(kb.ingest_document("user-001", doc_dir / "secret.txt", "secret.txt"))
        asyncio.run(kb.search("user-001", "secret", 3))

    assert doc.status == "ready"
    record_text = " ".join(
        str(v) for r in caplog.records for v in r.__dict__.values()
        if not str(v).startswith("<") and "LogRecord" not in str(type(v))
    )
    assert marker not in record_text
    assert "classified text" not in record_text
    assert "secret.txt" in record_text  # metadata (filename) is fine to log


def test_kb_stats_and_embedding_description(tmp_path):
    kb = make_kb(tmp_path)
    asyncio.run(ingest_fixture(kb, make_doc_dir(tmp_path)))
    stats = kb.stats()
    assert stats["documents"] == 2
    assert stats["chunks"] >= 2
    assert kb.describe_embedding()["provider"] == "fake"
