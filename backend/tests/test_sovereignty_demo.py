"""End-to-end sovereignty demo: the flagship workflow must leave the expected
audit trail, and the machine-readable demo report must reflect real state
(Phase 11)."""

import json
import os
import tempfile
import time

from app.services.audit_store import get_audit_store
from app.services.ocr_provider import FakeOCRProvider
from app.services.vision_provider import FakeVisionProvider
from tests.conftest import make_blank_pdf, make_mutable_scripted_handler, wait_for_job

MAINTENANCE_PROCEDURE = (
    "Cooling water pump maintenance procedure.\n"
    "Inspection interval: every 30 days.\n"
    "Acceptable conditions: seal leakage below 5 ml/hr; vibration below 4.5 mm/s."
)

SCAN_OCR = {1: "VIBRATION READING: 2.1 mm/s\nSEAL LEAKAGE: 3 ml/hr"}
SCAN_VISION = {1: ["Vibration reading 2.1 mm/s visible", "Seal leakage 3 ml/hr visible"]}


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


def upload_scan(client, filename="inspection_report.pdf", user_id="user-001"):
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


def build_demo_report(job, sovereignty):
    # user-scoped stages (ingestion events have no job_id), then job-scoped check
    user_events = get_audit_store().list(user_id="user-001")
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "completed_stages": sorted({e.event_type for e in user_events}),
        "models_used": sorted(
            {e.metadata.get("model") for e in user_events if e.metadata.get("model")}
        ),
        "tools_used": sorted(
            {e.metadata.get("tool") for e in user_events if e.metadata.get("tool")}
        ),
        "artifact_created": (
            job["artifacts"][0]["filename"] if job.get("artifacts") else None
        ),
        "sovereignty": {
            "network_policy": sovereignty["network_policy"],
            "external_connections": sovereignty["external_connections"],
            "local_model_calls": sovereignty["local_model_calls"],
            "audit_logging": sovereignty["audit_logging"],
        },
    }


def test_flagship_workflow_creates_expected_audit_trail(client_factory, test_models):
    models = dict(test_models)
    models["general"] = {
        **models["general"],
        "resources": {"gpu_vram_mb": 4096, "cpu_cores": 2, "memory_mb": 2048},
    }
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
        manual_id = manual.json()["document_id"]
        scan = upload_scan(c)

        script.extend(
            [
                # extract: vision read of the scanned page (no typed findings)
                tool_call(
                    "document_vision",
                    {"document_id": scan["document_id"], "pages": [1], "question": "findings?"},
                    "analyze scanned page",
                ),
                tool_call("submit_findings", {"readings": []}, "No structured readings"),
                # retrieve: procedure requirements
                tool_call("document_search", {"query": "pump inspection requirements", "top_k": 3}, "retrieve"),
                final("Procedure: seal leakage below 5 ml/hr; vibration below 4.5 mm/s.", "retrieved"),
                # draft: generate the approval note (terminal node)
                tool_call(
                    "document_generation",
                    {
                        "type": "word",
                        "filename": "approval_note.docx",
                        "title": "Approval Note",
                        "sections": [
                            {"heading": "Findings", "bullets": ["Vibration 2.1 mm/s"]},
                        ],
                        "sources": ["inspection_report.pdf, page 1"],
                    },
                    "create approval note",
                ),
                final("Created approval_note.docx.", "done"),
            ]
        )
        resp = c.post(
            "/api/chat",
            json={
                "message": "Compare the inspection report with the procedure and create an approval note.",
                "document_ids": [manual_id, scan["document_id"]],
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=15)
        assert job["status"] == "completed", job

        # resource release is logged in the worker's finally, just after the
        # job reaches COMPLETED — wait for it so the report is complete.
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            released = any(
                e.event_type == "RESOURCE_RELEASED"
                for e in get_audit_store().list(user_id="user-001", job_id=job["job_id"])
            )
            if released:
                break
            time.sleep(0.05)

        sovereignty = c.get("/api/sovereignty").json()
        report = build_demo_report(job, sovereignty)

    required_stages = {
        "JOB_CREATED",
        "JOB_STARTED",
        "MODEL_FALLBACK",
        "MODEL_CALL_STARTED",
        "MODEL_CALL_COMPLETED",
        "DOCUMENT_INGESTION_STARTED",
        "DOCUMENT_INGESTION_COMPLETED",
        "DOCUMENT_SEARCH_STARTED",
        "DOCUMENT_SEARCH_COMPLETED",
        "OCR_STARTED",
        "OCR_COMPLETED",
        "VISION_STARTED",
        "VISION_COMPLETED",
        "TOOL_CALL_STARTED",
        "TOOL_CALL_COMPLETED",
        "DOCUMENT_GENERATION_STARTED",
        "DOCUMENT_GENERATION_COMPLETED",
        "RESOURCE_ALLOCATED",
        "RESOURCE_RELEASED",
        "JOB_COMPLETED",
    }
    assert required_stages.issubset(set(report["completed_stages"])), (
        "missing stages: "
        + ", ".join(sorted(required_stages - set(report["completed_stages"])))
    )

    assert report["models_used"]
    assert "document_search" in report["tools_used"]
    assert "document_vision" in report["tools_used"]
    assert "document_generation" in report["tools_used"]
    assert report["artifact_created"] == "approval_note.docx"
    assert report["sovereignty"]["network_policy"] == "LOCAL_ONLY"
    assert report["sovereignty"]["external_connections"]["count"] == 0
    assert report["sovereignty"]["external_connections"]["status"] == "VERIFIED_LOCAL"
    assert report["sovereignty"]["local_model_calls"] >= 1
    assert report["sovereignty"]["audit_logging"] is True

    # events carry job/user identity where applicable
    job_events = get_audit_store().list(user_id="user-001", job_id=job["job_id"])
    assert all(e.user_id == "user-001" for e in job_events)
    assert all(e.job_id == job["job_id"] for e in job_events)


def test_sandbox_execution_produces_audit_events(client_factory, test_models, app_settings):
    from tests.conftest import FakeSandboxRunner, ok_result

    runner = FakeSandboxRunner(results=[ok_result(stdout="42")])
    script = [
        tool_call("code_execution", {"language": "python", "code": "print(40+2)"}, "compute"),
        final("The answer is 42.", "computed"),
    ]
    with client_factory(
        make_scripted_handler(script),
        sandbox_enabled=True,
        sandbox_runner=runner,
    ) as c:
        resp = c.post(
            "/api/chat",
            json={"message": "run some code"},
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    stages = {e.event_type for e in get_audit_store().list(user_id="user-001", job_id=job["job_id"])}
    assert "SANDBOX_STARTED" in stages
    assert "SANDBOX_COMPLETED" in stages
    assert runner.calls  # the sandbox actually ran


def make_scripted_handler(script):
    from tests.conftest import make_mutable_scripted_handler

    return make_mutable_scripted_handler(script)
