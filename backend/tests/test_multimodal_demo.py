"""Phase 8 synthetic industrial demonstration.

A scanned inspection report (OCR + vision) is compared against a text
maintenance procedure (document_search). The agent combines both tools and
produces an answer supported by source metadata.

User: "Compare the inspection report with the maintenance procedure and tell me
whether the inspection found anything requiring attention."
"""

import json
import os
import tempfile

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


def test_synthetic_industrial_comparison_demo(client_factory, test_models):
    models = dict(test_models)
    models["vision"] = {
        "provider": "ollama",
        "model": "vision-model",
        "enabled": True,
        "capabilities": ["vision", "image"],
    }
    ocr = FakeOCRProvider(page_text=SCAN_OCR)
    vision = FakeVisionProvider(observations_by_page=SCAN_VISION)
    script = []

    with client_factory(
        make_mutable_scripted_handler(script),
        models=models,
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
        manual_id = manual.json()["document_id"]
        scan = upload_scan(c)

        script.extend(
            [
                # extract: vision read of the scanned report (no typed findings)
                tool_call(
                    "document_vision",
                    {"document_id": scan["document_id"], "pages": [1, 2], "question": "What inspection findings are visible?"},
                    "Analyze the scanned inspection report pages",
                ),
                final("Vibration 2.1 mm/s and seal leakage 3 ml/hr; a handwritten note flags the seal.", "Vision read"),
                # retrieve: maintenance requirements from the KB
                tool_call(
                    "document_search",
                    {"query": "pump maintenance inspection requirements", "top_k": 3},
                    "Retrieve the maintenance requirements from the knowledge base",
                ),
                final("The maintenance procedure allows seal leakage below 5 ml/hr and vibration below 4.5 mm/s.", "Retrieved"),
                # draft: the comparison answer (terminal node)
                final(
                    "The maintenance procedure allows seal leakage below 5 ml/hr and "
                    "vibration below 4.5 mm/s (inspection every 30 days). The scanned "
                    "inspection report (2026-08-15) shows vibration 2.1 mm/s and seal "
                    "leakage 3 ml/hr, plus a handwritten note recommending seal "
                    "replacement. Leakage is below the limit, but the handwritten "
                    "finding flags the seal, so it requires attention.",
                    "Compared the maintenance requirements with the scanned findings",
                ),
            ]
        )
        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Compare the inspection report with the maintenance procedure and "
                    "tell me whether the inspection found anything requiring attention."
                ),
                "document_ids": [manual_id, scan["document_id"]],
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "3 ml/hr" in job["response"]
    assert "4.5 mm/s" in job["response"]
    assert "seal" in job["response"].lower()

    tool_calls = [t["tool"] for t in job["execution_trace"] if t["type"] == "tool_call"]
    assert tool_calls == ["document_vision", "document_search"]

    vision_result = [
        t for t in job["execution_trace"]
        if t["type"] == "tool_result" and t["tool"] == "document_vision"
    ]
    assert vision_result and vision_result[-1]["ok"] is True
    assert "Analyzed 2 page(s)" in vision_result[-1]["result_summary"]
