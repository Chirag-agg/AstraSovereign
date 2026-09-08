"""Phase 9 synthetic industrial demonstration: the approval-note workflow.

User asks the agent to review a scanned inspection report against a text
maintenance procedure and create an approval note. The agent combines
document_search (maintenance requirements), document_vision (scanned findings),
and document_generation (approval_note.docx). The generated .docx is validated.
"""

import json
import os
import tempfile
from io import BytesIO

from app.services.ocr_provider import FakeOCRProvider
from app.services.vision_provider import FakeVisionProvider
from tests.conftest import make_blank_pdf, make_mutable_scripted_handler, wait_for_job

MAINTENANCE_PROCEDURE = (
    "Cooling water pump maintenance procedure.\n"
    "Inspection interval: every 30 days.\n"
    "Required checks: seals, bearings, vibration.\n"
    "Acceptable conditions: seal leakage below 5 ml per hour; "
    "vibration below 4.5 mm/s. Replace the mechanical seal if leakage "
    "approaches the limit."
)

SCAN_OCR = {
    1: (
        "INSPECTION DATE: 2026-08-15\n"
        "EQUIPMENT: Cooling Water Pump P-101\n"
        "VIBRATION READING: 2.1 mm/s\n"
        "SEAL LEAKAGE: 3 ml/hr"
    ),
    2: "HANDWRITTEN: seal replacement recommended",
}

SCAN_VISION = {
    1: [
        "Inspection date 2026-08-15 visible",
        "Vibration reading 2.1 mm/s visible",
        "Seal leakage 3 ml/hr visible",
    ],
    2: ["Handwritten annotation recommends seal replacement"],
}


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


def vision_models(test_models):
    models = dict(test_models)
    models["vision"] = {
        "provider": "ollama",
        "model": "vision-model",
        "enabled": True,
        "capabilities": ["vision", "image"],
    }
    return models


def upload_scan(client, filename="inspection_report.pdf", user_id="user-001"):
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()
    make_blank_pdf(tmp.name, pages=2)
    with open(tmp.name, "rb") as fh:
        data = fh.read()
    os.unlink(tmp.name)
    resp = client.post(
        "/api/documents",
        files={"file": (filename, data, "application/pdf")},
        headers={"X-User-ID": user_id},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "ready", body
    return body


def approval_note_args():
    return {
        "type": "word",
        "filename": "approval_note.docx",
        "title": "Pump Inspection Approval Note",
        "document_type": "approval_note",
        "sections": [
            {
                "heading": "Inspection Summary",
                "paragraphs": [
                    "Inspection of Cooling Water Pump P-101 performed on 2026-08-15. "
                    "Vibration measured 2.1 mm/s; seal leakage measured 3 ml/hr."
                ],
            },
            {
                "heading": "Key Findings",
                "bullets": [
                    "Vibration 2.1 mm/s (within the 4.5 mm/s limit)",
                    "Seal leakage 3 ml/hr (below the 5 ml/hr limit)",
                    "Handwritten note recommends seal replacement",
                ],
            },
            {
                "heading": "Comparison Against Required Procedure",
                "paragraphs": [
                    "The maintenance procedure requires inspection every 30 days, "
                    "seal leakage below 5 ml/hr, and vibration below 4.5 mm/s. "
                    "All measured values are within the acceptable conditions."
                ],
            },
            {
                "heading": "Required Actions",
                "bullets": [
                    "Monitor seal leakage at the next 30-day inspection",
                    "Prioritize seal replacement given the handwritten recommendation",
                ],
            },
            {
                "heading": "Recommendation",
                "paragraphs": [
                    "The pump remains within limits, but the seal should be monitored "
                    "closely and replacement should be scheduled."
                ],
            },
        ],
        "sources": [
            "inspection_report.pdf, page 1",
            "inspection_report.pdf, page 2",
            "pump_maintenance_procedure.txt",
        ],
    }


def test_approval_note_workflow(client_factory, test_models):
    ocr = FakeOCRProvider(page_text=SCAN_OCR)
    vision = FakeVisionProvider(observations_by_page=SCAN_VISION)
    script = []
    with client_factory(
        make_mutable_scripted_handler(script),
        models=vision_models(test_models),
        ocr_provider=ocr,
        vision_provider=vision,
    ) as c:
        manual = c.post(
            "/api/documents",
            files={"file": ("pump_maintenance_procedure.txt", MAINTENANCE_PROCEDURE.encode(), "text/plain")},
            headers={"X-User-ID": "user-001"},
        )
        assert manual.status_code == 201
        assert manual.json()["status"] == "ready"
        scan = upload_scan(c)

        script.extend(
            [
                tool_call(
                    "document_search",
                    {"query": "pump maintenance inspection requirements", "top_k": 3},
                    "Retrieve the maintenance requirements from the knowledge base",
                ),
                tool_call(
                    "document_vision",
                    {"document_id": scan["document_id"], "pages": [1, 2], "question": "What inspection findings are visible?"},
                    "Analyze the scanned inspection report pages",
                ),
                tool_call(
                    "document_generation",
                    approval_note_args(),
                    "Create the approval note from the gathered findings",
                ),
                final(
                    "Created approval_note.docx (Word artifact) summarizing the inspection findings, "
                    "required actions, and supporting sources.",
                    "The approval note was generated from the gathered evidence.",
                ),
            ]
        )
        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Review the inspection report against the maintenance procedure and "
                    "create an approval note summarizing the findings, required actions, "
                    "and supporting sources."
                )
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=15)
        assert job["status"] == "completed", job
        artifact_id = job["artifacts"][0]["artifact_id"]
        job_id = resp.json()["job_id"]
        download = c.get(
            f"/api/jobs/{job_id}/artifacts/{artifact_id}",
            headers={"X-User-ID": "user-001"},
        )

    tool_calls = [t["tool"] for t in job["execution_trace"] if t["type"] == "tool_call"]
    assert tool_calls == ["document_search", "document_vision", "document_generation"]

    artifact = job["artifacts"][0]
    assert artifact["filename"] == "approval_note.docx"
    assert artifact["type"] == "word"
    assert artifact["status"] == "completed"
    assert artifact["size_bytes"] > 0

    assert download.status_code == 200
    from docx import Document

    doc = Document(BytesIO(download.content))
    all_text = " ".join(p.text for p in doc.paragraphs)
    assert "Pump Inspection Approval Note" in all_text
    for heading in (
        "Inspection Summary",
        "Key Findings",
        "Comparison Against Required Procedure",
        "Required Actions",
        "Recommendation",
        "Sources",
    ):
        assert heading in all_text
    assert "Vibration 2.1 mm/s" in all_text
    assert "3 ml/hr" in all_text
    assert "inspection_report.pdf, page 1" in all_text
    assert "pump_maintenance_procedure.txt" in all_text
