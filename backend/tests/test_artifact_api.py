"""Artifact API tests: job detail exposure, secure download, ownership,
cross-job isolation, path containment, and health document_generation section."""

import json
from io import BytesIO
from pathlib import Path

from app.schemas.artifact import Artifact
from tests.conftest import make_mutable_scripted_handler, wait_for_job

WORD_MEDIA = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def tool_call(tool, arguments, reasoning):
    return json.dumps({"type": "tool_call", "tool": tool, "arguments": arguments, "reasoning": reasoning})


def final(response, reasoning):
    return json.dumps({"type": "final", "response": response, "reasoning": reasoning})


DOC_ARGS = {
    "type": "word",
    "filename": "approval_note.docx",
    "title": "Inspection Approval Note",
    "document_type": "approval_note",
    "sections": [
        {"heading": "Inspection Summary", "paragraphs": ["The pump was inspected on 2026-08-15."]},
        {"heading": "Key Findings", "bullets": ["Vibration 2.1 mm/s", "Seal leakage 3 ml/hr"]},
    ],
    "sources": ["inspection_report.pdf, page 1"],
}

GENERATION_SCRIPT = [
    tool_call("document_generation", DOC_ARGS, "Create the approval note deliverable"),
    final(
        "Created approval_note.docx (Word artifact).",
        "The approval note was generated from the inspection findings.",
    ),
]


def make_client_and_script(client_factory):
    script = []
    return client_factory(make_mutable_scripted_handler(script)), script


def generate_artifact(client, script, app_settings):
    """Run an agent job that generates a Word artifact; return (job_id, artifact)."""
    script.extend(GENERATION_SCRIPT)
    resp = client.post(
        "/api/chat", json={"message": "Create an approval note."}, headers={"X-User-ID": "user-001"}
    )
    job_id = resp.json()["job_id"]
    job = wait_for_job(client, job_id, "user-001", timeout=10)
    assert job["status"] == "completed", job
    assert job["artifacts"], "job must expose generated artifacts"
    artifact = job["artifacts"][0]
    return job_id, artifact


def create_plain_job(client, script):
    """Run a job that produces no artifact (for cross-job download tests)."""
    script.append(final("ok", "noop"))
    resp = client.post(
        "/api/chat", json={"message": "hello"}, headers={"X-User-ID": "user-001"}
    )
    job_id = resp.json()["job_id"]
    wait_for_job(client, job_id, "user-001", timeout=10)
    return job_id


def register_artifact(client, artifact):
    return client.portal.call(client.app.state.artifact_store.create, artifact)


def test_job_detail_exposes_artifacts(client_factory, app_settings):
    client, script = make_client_and_script(client_factory)
    with client as c:
        job_id, artifact = generate_artifact(c, script, app_settings)
        detail = c.get(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-001"}).json()

    assert artifact["filename"] == "approval_note.docx"
    assert artifact["type"] == "word"
    assert artifact["status"] == "completed"
    assert artifact["size_bytes"] > 0
    assert "path" not in artifact  # never expose internal paths
    assert detail["artifacts"][0]["artifact_id"] == artifact["artifact_id"]


def test_artifact_download_success_and_validity(client_factory, app_settings):
    client, script = make_client_and_script(client_factory)
    with client as c:
        job_id, artifact = generate_artifact(c, script, app_settings)
        resp = c.get(
            f"/api/jobs/{job_id}/artifacts/{artifact['artifact_id']}",
            headers={"X-User-ID": "user-001"},
        )

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith(WORD_MEDIA)
    assert len(resp.content) == artifact["size_bytes"]

    from docx import Document

    doc = Document(BytesIO(resp.content))
    texts = [p.text for p in doc.paragraphs]
    assert "Inspection Approval Note" in texts
    assert "Vibration 2.1 mm/s" in texts
    assert "inspection_report.pdf, page 1" in texts


def test_artifact_download_cross_user_forbidden(client_factory, app_settings):
    client, script = make_client_and_script(client_factory)
    with client as c:
        job_id, artifact = generate_artifact(c, script, app_settings)
        resp = c.get(
            f"/api/jobs/{job_id}/artifacts/{artifact['artifact_id']}",
            headers={"X-User-ID": "user-002"},
        )
        job_resp = c.get(f"/api/jobs/{job_id}", headers={"X-User-ID": "user-002"})

    assert job_resp.status_code == 403
    assert resp.status_code == 403


def test_artifact_download_unknown_artifact_404(client_factory, app_settings):
    client, script = make_client_and_script(client_factory)
    with client as c:
        job_id, _artifact = generate_artifact(c, script, app_settings)
        resp = c.get(
            f"/api/jobs/{job_id}/artifacts/art-nope",
            headers={"X-User-ID": "user-001"},
        )
    assert resp.status_code == 404


def test_artifact_download_cross_job_404(client_factory, app_settings):
    client, script = make_client_and_script(client_factory)
    with client as c:
        job_id, artifact = generate_artifact(c, script, app_settings)
        other_job_id = create_plain_job(c, script)
        resp = c.get(
            f"/api/jobs/{other_job_id}/artifacts/{artifact['artifact_id']}",
            headers={"X-User-ID": "user-001"},
        )
    assert resp.status_code == 404


def test_artifact_download_path_containment_404(client_factory, app_settings):
    client, script = make_client_and_script(client_factory)
    with client as c:
        job_id, _artifact = generate_artifact(c, script, app_settings)
        outside = Path(c.app.state.settings.workspaces_root).parent / "outside-secret.txt"
        Path(outside).write_text("secret", encoding="utf-8")
        evil = Artifact(
            artifact_id="art-evil",
            job_id=job_id,
            user_id="user-001",
            filename="evil.docx",
            type="word",
            path=str(outside),
            status="completed",
            size_bytes=7,
        )
        register_artifact(c, evil)
        resp = c.get(
            f"/api/jobs/{job_id}/artifacts/art-evil",
            headers={"X-User-ID": "user-001"},
        )
    assert resp.status_code == 404


def test_artifact_download_missing_file_404(client_factory, app_settings):
    client, script = make_client_and_script(client_factory)
    with client as c:
        job_id, _artifact = generate_artifact(c, script, app_settings)
        workspace = Path(app_settings.workspaces_root) / "user-001" / job_id
        ghost = workspace / "artifacts" / "ghost.docx"
        ghost.parent.mkdir(parents=True, exist_ok=True)
        artifact = Artifact(
            artifact_id="art-ghost",
            job_id=job_id,
            user_id="user-001",
            filename="ghost.docx",
            type="word",
            path=str(ghost),
            status="completed",
            size_bytes=0,
        )
        register_artifact(c, artifact)
        resp = c.get(
            f"/api/jobs/{job_id}/artifacts/art-ghost",
            headers={"X-User-ID": "user-001"},
        )
    assert resp.status_code == 404


def test_health_document_generation_section(client):
    health = client.get("/health").json()
    dg = health["document_generation"]
    assert dg["available"] is True
    assert dg["word"] == "available"
    assert "artifacts" in dg
