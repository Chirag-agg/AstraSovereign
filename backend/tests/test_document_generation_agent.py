"""Agent + document_generation integration tests (scripted model, real generator).

Covers: the agent calling document_generation as its final action, the execution
trace containing the generation step, the final response mentioning the
artifact, and artifact exposure/download through the job API.
"""

import json
from io import BytesIO

from tests.conftest import make_mutable_scripted_handler, wait_for_job


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


DOC_ARGS = {
    "type": "word",
    "filename": "inspection_summary.docx",
    "title": "Inspection Summary",
    "document_type": "approval_note",
    "sections": [
        {"heading": "Findings", "bullets": ["Vibration 2.1 mm/s", "Seal leakage 3 ml/hr"]},
    ],
    "sources": ["inspection_report.pdf, page 1"],
}


def test_agent_uses_document_generation_tool(client_factory):
    script = [
        tool_call("document_generation", DOC_ARGS, "Create the Word deliverable"),
        final(
            "Created inspection_summary.docx (Word artifact, art-demo).",
            "The document was generated from the findings.",
        ),
    ]
    with client_factory(make_mutable_scripted_handler(script)) as c:
        resp = c.post(
            "/api/chat",
            json={"message": "Create a Word deliverable summarizing the inspection findings."},
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed", job
    assert "inspection_summary.docx" in job["response"]

    trace = job["execution_trace"]
    tool_calls = [t for t in trace if t["type"] == "tool_call"]
    assert [t["tool"] for t in tool_calls] == ["document_generation"]
    assert tool_calls[0]["arguments"]["filename"] == "inspection_summary.docx"
    results = [t for t in trace if t["type"] == "tool_result"]
    assert results and results[-1]["tool"] == "document_generation"
    assert results[-1]["ok"] is True
    assert "Generated word artifact" in results[-1]["result_summary"]

    assert len(job["artifacts"]) == 1
    artifact = job["artifacts"][0]
    assert artifact["filename"] == "inspection_summary.docx"
    assert artifact["type"] == "word"
    assert artifact["status"] == "completed"
    assert artifact["size_bytes"] > 0


def test_agent_generated_artifact_is_downloadable(client_factory, app_settings):
    script = [
        tool_call("document_generation", DOC_ARGS, "Create the Word deliverable"),
        final("Created inspection_summary.docx.", "done"),
    ]
    with client_factory(make_mutable_scripted_handler(script)) as c:
        resp = c.post(
            "/api/chat",
            json={"message": "Create a Word deliverable summarizing the inspection findings."},
            headers={"X-User-ID": "user-001"},
        )
        job_id = resp.json()["job_id"]
        job = wait_for_job(c, job_id, "user-001", timeout=10)
        artifact_id = job["artifacts"][0]["artifact_id"]
        download = c.get(
            f"/api/jobs/{job_id}/artifacts/{artifact_id}",
            headers={"X-User-ID": "user-001"},
        )

    assert job["status"] == "completed", job

    assert download.status_code == 200
    from docx import Document

    doc = Document(BytesIO(download.content))
    texts = [p.text for p in doc.paragraphs]
    assert "Inspection Summary" in texts
    assert "Vibration 2.1 mm/s" in texts
    assert "inspection_report.pdf, page 1" in texts
