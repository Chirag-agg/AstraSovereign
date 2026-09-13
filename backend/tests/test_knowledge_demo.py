"""Synthetic industrial-document demonstration + agent document-search flow.

Ingests pump/safety documents, then the agent answers a retrieval-grounded
question by calling the document_search tool (scripted model, fake embeddings).
"""

import json

from tests.conftest import make_scripted_handler, make_text_pdf, wait_for_job


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


def ingest_synthetic_documents(client, app_settings):
    """Create + upload the synthetic industrial documents, return their ids."""
    import shutil
    from pathlib import Path

    docs_dir = Path(app_settings.uploads_root).parent / "synthetic"
    docs_dir.mkdir(parents=True, exist_ok=True)
    make_text_pdf(
        docs_dir / "pump_maintenance_manual.pdf",
        [
            "Pump Maintenance Manual",
            "Cooling water pumps must be inspected every 30 days.",
            "Inspection includes seals, bearings, and vibration levels.",
            "Replace the mechanical seal if leakage exceeds 5 ml per hour.",
            "Record inspection results in the logbook.",
        ],
    )
    (docs_dir / "inspection_procedure.txt").write_text(
        "Inspection procedure for cooling water pumps:\n"
        "1. Check suction and discharge pressure.\n"
        "2. Inspect the coupling alignment.\n"
        "3. Measure bearing temperature (max 85 C).\n"
        "4. Verify vibration is below 4.5 mm/s.", encoding="utf-8"
    )
    (docs_dir / "safety_procedure.md").write_text(
        "# Safety procedure\n"
        "Wear protective gloves and goggles when handling pump seals.\n"
        "Lock out the pump motor before any maintenance work.\n"
        "Report chemical spills to the shift supervisor immediately.", encoding="utf-8"
    )
    ids = {}
    for name in ("pump_maintenance_manual.pdf", "inspection_procedure.txt", "safety_procedure.md"):
        with open(docs_dir / name, "rb") as fh:
            resp = client.post(
                "/api/documents",
                files={"file": (name, fh.read())},
                headers={"X-User-ID": "user-001"},
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["status"] == "ready", body
        ids[name] = body["document_id"]
    shutil.rmtree(docs_dir, ignore_errors=True)
    return ids


def test_agent_document_search_grounded_answer(client_factory, app_settings, test_models):
    """User asks a retrieval question; agent calls document_search and answers."""
    import json as _json

    script = [
        # extract (runs because the job has attachments) locates documents and
        # produces no structured findings — it degrades, which is expected here.
        tool_call(
            "document_search",
            {"query": "cooling water pump inspection procedure", "top_k": 3},
            "Locate the relevant documents",
        ),
        final("No structured findings were found.", "Nothing to extract"),
        # retrieve: grounded passages
        tool_call(
            "document_search",
            {"query": "cooling water pump inspection procedure", "top_k": 3},
            "Retrieve the pump inspection requirements from the knowledge base",
        ),
        final("Retrieved pump_maintenance_manual.pdf and inspection_procedure.txt.", "retrieved"),
        # draft: the user-facing answer (terminal node)
        final(
            "According to pump_maintenance_manual.pdf and inspection_procedure.txt, "
            "cooling water pumps must be inspected every 30 days; the procedure covers "
            "pressure checks, coupling alignment, bearing temperature (max 85 C), and "
            "vibration below 4.5 mm/s.",
            "Grounded in the retrieved maintenance documents",
        ),
    ]
    with client_factory(make_scripted_handler(script)) as c:
        ids = ingest_synthetic_documents(c, app_settings)
        assert len(ids) == 3

        resp = c.post(
            "/api/chat",
            json={
                "message": (
                    "Search the maintenance documents for the inspection procedure for "
                    "cooling water pumps and summarize the requirements."
                ),
                "document_ids": list(ids.values()),
            },
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "pump_maintenance_manual.pdf" in job["response"]

    trace = job["execution_trace"]
    tool_calls = [t for t in trace if t["type"] == "tool_call"]
    assert [t["tool"] for t in tool_calls] == ["document_search", "document_search"]
    assert tool_calls[0]["arguments"]["query"]
    results = [t for t in trace if t["type"] == "tool_result"]
    assert results[-1]["ok"] is True
    assert "relevant chunk(s)" in results[-1]["result_summary"]


def test_demo_no_relevant_documents(client_factory, app_settings):
    """The agent must clearly report when the knowledge base has nothing relevant."""
    script = [
        tool_call("document_search", {"query": "rocket engine combustion chamber", "top_k": 3}, "search"),
        final("No relevant local documents found.", "The search returned no matches"),
    ]
    with client_factory(make_scripted_handler(script)) as c:
        # no documents ingested
        resp = c.post(
            "/api/chat",
            json={"message": "Search the knowledge base for rocket engine combustion chamber maintenance."},
            headers={"X-User-ID": "user-001"},
        )
        job = wait_for_job(c, resp.json()["job_id"], "user-001", timeout=10)

    assert job["status"] == "completed"
    assert "No relevant local documents found" in job["response"]
