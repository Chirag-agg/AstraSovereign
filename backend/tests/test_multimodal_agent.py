"""Agent + multimodal tool integration tests (fake OCR/vision, scripted model).

Covers: the agent chooses ``document_search`` for text-only knowledge tasks,
uses ``document_vision`` for scanned/image questions, and can combine both in a
multi-step task. The vision execution trace is exercised through the job API.
"""

import json
import os
import tempfile

from tests.conftest import (
    make_blank_pdf,
    make_mutable_scripted_handler,
    make_scripted_handler,
    wait_for_job,
)


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


def upload_scan(client, filename="scan.pdf", user_id="user-001"):
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()
    make_blank_pdf(tmp.name, pages=1)
    with open(tmp.name, "rb") as fh:
        data = fh.read()
    os.unlink(tmp.name)
    resp = client.post(
        "/api/documents",
        files={"file": (filename, data, "application/pdf")},
        headers={"X-User-ID": user_id},
    )
    assert resp.status_code == 201
    return resp.json()


def test_agent_uses_document_vision_for_scanned_question(client_factory, test_models):
    from app.services.ocr_provider import FakeOCRProvider
    from app.services.vision_provider import FakeVisionProvider

    ocr = FakeOCRProvider(page_text={1: "HANDWRITTEN NOTE: seal replacement recommended"})
    vision = FakeVisionProvider(
        observations_by_page={1: ["Handwritten annotation visible near pump seal"]}
    )
    script = []
    with client_factory(
        make_mutable_scripted_handler(script),
        models=vision_models(test_models),
        ocr_provider=ocr,
        vision_provider=vision,
    ) as c:
        body = upload_scan(c)
        assert body["status"] == "ready", body
        doc_id = body["document_id"]
        script.extend(
            [
                tool_call(
                    "document_vision",
                    {"document_id": doc_id, "pages": [1], "question": "What does the handwritten note say?"},
                    "The report is scanned, so analyze the page image",
                ),
                final(
                    "The handwritten note on page 1 recommends replacing the mechanical seal.",
                    "Vision observation from the scanned page",
                ),
            ]
        )
        resp = c.post(
            "/api/chat",
            json={"message": "What does the handwritten note on the inspection report say?"},
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "mechanical seal" in job["response"]
    tool_calls = [t["tool"] for t in job["execution_trace"] if t["type"] == "tool_call"]
    assert tool_calls == ["document_vision"]
    results = [t for t in job["execution_trace"] if t["type"] == "tool_result"]
    assert results and results[-1]["ok"] is True
    assert "Analyzed 1 page(s)" in results[-1]["result_summary"]


def test_agent_chooses_document_search_for_text_task(client_factory, test_models):
    from app.services.ocr_provider import FakeOCRProvider
    from app.services.vision_provider import FakeVisionProvider

    script = [
        tool_call(
            "document_search",
            {"query": "seal inspection requirements", "top_k": 3},
            "The maintenance manual is text-based, so search the knowledge base",
        ),
        final(
            "The maintenance manual requires seal inspection every 30 days.",
            "Grounded in the text knowledge base",
        ),
    ]
    with client_factory(
        make_scripted_handler(script),
        models=vision_models(test_models),
        ocr_provider=FakeOCRProvider(),
        vision_provider=FakeVisionProvider(),
    ) as c:
        upload = c.post(
            "/api/documents",
            files={"file": ("manual.txt", b"Seal inspection every 30 days.", "text/plain")},
            headers={"X-User-ID": "user-001"},
        )
        assert upload.status_code == 201
        resp = c.post(
            "/api/chat",
            json={"message": "Search the maintenance documents for the seal inspection requirements."},
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    tool_calls = [t["tool"] for t in job["execution_trace"] if t["type"] == "tool_call"]
    assert tool_calls == ["document_search"]


def test_agent_uses_both_tools_in_multi_step_task(client_factory, test_models):
    from app.services.ocr_provider import FakeOCRProvider
    from app.services.vision_provider import FakeVisionProvider

    ocr = FakeOCRProvider(page_text={1: "VIBRATION READING: 2.1 mm/s"})
    vision = FakeVisionProvider(
        observations_by_page={1: ["Vibration reading 2.1 mm/s visible"]}
    )
    script = []
    with client_factory(
        make_mutable_scripted_handler(script),
        models=vision_models(test_models),
        ocr_provider=ocr,
        vision_provider=vision,
    ) as c:
        manual = c.post(
            "/api/documents",
            files={"file": ("manual.txt", b"Vibration must stay below 4.5 mm/s.", "text/plain")},
            headers={"X-User-ID": "user-001"},
        )
        assert manual.status_code == 201
        body = upload_scan(c)
        assert body["status"] == "ready", body
        script.extend(
            [
                tool_call("document_search", {"query": "vibration limit", "top_k": 3}, "get the requirement"),
                tool_call(
                    "document_vision",
                    {"document_id": body["document_id"], "pages": [1], "question": "What vibration reading is shown?"},
                    "read the scanned reading",
                ),
                final(
                    "The manual allows vibration up to 4.5 mm/s; the scanned report shows 2.1 mm/s, which is within limits.",
                    "Compared the requirement with the scanned reading",
                ),
            ]
        )
        resp = c.post(
            "/api/chat",
            json={
                "message": "Compare the vibration requirement in the manual with the reading in the scanned report."
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "4.5 mm/s" in job["response"]
    assert "2.1 mm/s" in job["response"]
    tool_calls = [t["tool"] for t in job["execution_trace"] if t["type"] == "tool_call"]
    assert tool_calls == ["document_search", "document_vision"]
    tool_results = [t for t in job["execution_trace"] if t["type"] == "tool_result"]
    assert [t["tool"] for t in tool_results] == ["document_search", "document_vision"]
