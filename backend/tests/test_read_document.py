"""read_document: the per-document extraction artifact and whole-document reads."""

import asyncio

import pytest

from app.schemas.extraction import DocumentExtraction, ExtractionElement
from app.services.extraction_store import JsonExtractionStore
from app.services.extractor import DocumentExtractor
from app.services.log_context import set_job_context
from app.services.tools import ReadDocumentTool, ToolError


def _artifact(document_id="doc-1", markdown="Course C1 13.4\nCourse C2 10.9"):
    return DocumentExtraction(
        document_id=document_id,
        filename="report.txt",
        document_type="txt",
        page_count=1,
        elements=[ExtractionElement(type="text", page=1, text=markdown)],
        markdown=markdown,
    )


def test_extractor_builds_elements_and_markdown():
    extraction = DocumentExtractor().from_pages(
        "doc-1", "report.txt", "txt", [(None, "Course C1 13.4\nCourse C2 10.9")]
    )
    assert extraction.document_id == "doc-1"
    assert extraction.elements and "C1 13.4" in extraction.elements[0].text
    assert "Course C2 10.9" in extraction.markdown


def test_extraction_store_roundtrip_and_user_isolation(tmp_path):
    store = JsonExtractionStore(tmp_path)
    store.put("user-001", _artifact())
    assert store.get("user-001", "doc-1").markdown.startswith("Course C1")
    assert store.get("user-002", "doc-1") is None


def test_read_document_tool_returns_the_markdown(tmp_path):
    store = JsonExtractionStore(tmp_path)
    store.put("user-001", _artifact())
    tool = ReadDocumentTool(store, max_chars=1000)
    set_job_context(job_id="job-1", user_id="user-001")
    result = asyncio.run(tool.execute(tmp_path, {"document_id": "doc-1"}))
    assert result.ok is True
    assert "Course C2 10.9" in result.content


def test_read_document_reports_a_missing_artifact(tmp_path):
    tool = ReadDocumentTool(JsonExtractionStore(tmp_path), max_chars=1000)
    set_job_context(job_id="job-1", user_id="user-001")
    result = asyncio.run(tool.execute(tmp_path, {"document_id": "doc-missing"}))
    assert result.ok is False
    assert result.error == "not_found"


def test_read_document_truncates_to_the_budget(tmp_path):
    store = JsonExtractionStore(tmp_path)
    store.put("user-001", _artifact(markdown="x" * 500))
    tool = ReadDocumentTool(store, max_chars=100)
    set_job_context(job_id="job-1", user_id="user-001")
    result = asyncio.run(tool.execute(tmp_path, {"document_id": "doc-1"}))
    assert result.ok is True
    assert result.content.endswith("...[truncated]")
    assert "truncated" in result.summary


def test_read_document_requires_user_context(tmp_path):
    tool = ReadDocumentTool(JsonExtractionStore(tmp_path), max_chars=1000)
    set_job_context()
    with pytest.raises(ToolError):
        asyncio.run(tool.execute(tmp_path, {"document_id": "doc-1"}))


def test_upload_persists_an_extraction_artifact(client_factory):
    from tests.conftest import make_scripted_handler

    with client_factory(make_scripted_handler([])) as c:
        resp = c.post(
            "/api/documents",
            files={"file": ("notes.txt", b"C1 13.4\nC2 10.9", "text/plain")},
            headers={"X-User-ID": "user-001"},
        )
        assert resp.status_code == 201, resp.text
        document_id = resp.json()["document_id"]
        extraction = c.app.state.knowledge_base.get_extraction("user-001", document_id)
    assert extraction is not None
    assert "C1 13.4" in extraction.markdown


def test_upload_extraction_is_user_scoped(client_factory):
    from tests.conftest import make_scripted_handler

    with client_factory(make_scripted_handler([])) as c:
        resp = c.post(
            "/api/documents",
            files={"file": ("notes.txt", b"C1 13.4", "text/plain")},
            headers={"X-User-ID": "user-001"},
        )
        document_id = resp.json()["document_id"]
        kb = c.app.state.knowledge_base
        assert kb.get_extraction("user-001", document_id) is not None
        assert kb.get_extraction("user-002", document_id) is None
