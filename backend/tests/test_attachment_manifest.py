"""Attachment manifest: rendering into nodes, and content-hash dedupe."""

import asyncio
import json

from app.schemas.document import DocumentRecord, DocumentStatus
from app.services.agent import AgentResult, AgentStatus
from app.services.attachments import (
    build_attachment_manifest,
    media_type_for,
    render_attachment_block,
)
from app.services.knowledge_base import KnowledgeBase
from app.services.vector_store import JsonVectorStore
from tests.conftest import FakeEmbeddingProvider
from tests.test_nodes import FINDINGS, FakeJob, make_agent


def record(doc_id, filename, document_type, metadata=None):
    return DocumentRecord(
        document_id=doc_id,
        user_id="user-001",
        filename=filename,
        document_type=document_type,
        status=DocumentStatus.READY,
        metadata=metadata or {},
    )


def test_manifest_classifies_mixed_image_and_scanned_pdf():
    manifest = build_attachment_manifest(
        [
            record("doc-img1", "tank204_nameplate.jpg", "jpg"),
            record("doc-pdf1", "inspection_report_2026.pdf", "pdf", {"ocr": True, "page_count": 4}),
            record("doc-txt1", "SOP-09_Rev3.pdf", "pdf"),
        ]
    )
    assert manifest[0]["doc_id"] == "doc-img1"
    assert manifest[0]["media_type"] == "image/jpeg"
    assert manifest[0]["kind"] == "image"
    assert manifest[1]["kind"] == "scanned_pdf"
    assert manifest[1]["pages"] == 4
    assert manifest[2]["kind"] == "text_pdf"
    assert media_type_for("pdf") == "application/pdf"


def test_render_block_is_structured_not_prose():
    block = render_attachment_block(build_attachment_manifest([record("doc-img1", "n.jpg", "jpg")]))
    assert block.startswith("attachments:")
    assert "doc_id: doc-img1" in block
    assert "filename: n.jpg" in block
    assert "kind: image" in block


def test_extract_and_retrieve_get_manifest_but_compute_and_draft_do_not():
    results = [
        AgentResult(status=AgentStatus.COMPLETED, response=json.dumps(FINDINGS), iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="sop", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="computed", iterations=1),
        AgentResult(status=AgentStatus.COMPLETED, response="deliverables", iterations=1),
    ]
    node_agent = make_agent(results)
    manifest = [
        {
            "doc_id": "doc-img1",
            "filename": "tank204_nameplate.jpg",
            "media_type": "image/jpeg",
            "kind": "image",
            "pages": None,
        }
    ]
    asyncio.run(
        node_agent.run(FakeJob(), "/workspace", task_text=FakeJob.message, attachments=manifest)
    )
    calls = node_agent._agent.calls
    assert len(calls) == 4
    assert "attachments:" in calls[0]["task_text"] and "doc-img1" in calls[0]["task_text"]
    assert "attachments:" in calls[1]["task_text"]
    assert "attachments:" not in calls[2]["task_text"]
    assert "attachments:" not in calls[3]["task_text"]


def make_kb(tmp_path):
    return KnowledgeBase(
        vector_store=JsonVectorStore(str(tmp_path / "kb")),
        embedding_provider=FakeEmbeddingProvider(),
    )


def test_reingesting_identical_bytes_reuses_document_id(tmp_path):
    kb = make_kb(tmp_path)
    file = tmp_path / "note.txt"
    file.write_text("identical bytes", encoding="utf-8")
    first = asyncio.run(kb.ingest_document("user-001", file, "note.txt"))
    second = asyncio.run(kb.ingest_document("user-001", file, "note.txt"))
    assert first.document_id == second.document_id
    assert len(asyncio.run(kb.list_documents("user-001"))) == 1


def test_reingesting_identical_bytes_via_pages_reuses_document_id(tmp_path):
    kb = make_kb(tmp_path)
    file = tmp_path / "scan.png"
    file.write_bytes(b"same-image-bytes")
    first = asyncio.run(
        kb.ingest_pages("user-001", file, "scan.png", [(1, "ocr text")], metadata={"ocr": True})
    )
    second = asyncio.run(
        kb.ingest_pages("user-001", file, "scan.png", [(1, "ocr text")], metadata={"ocr": True})
    )
    assert first.document_id == second.document_id
    assert len(asyncio.run(kb.list_documents("user-001"))) == 1
