"""Document API tests: upload, list, get, delete, ownership isolation."""

from tests.conftest import make_text_pdf, wait_for_job


def upload(client, user_id, filename, content, content_type="text/plain"):
    return client.post(
        "/api/documents",
        files={"file": (filename, content, content_type)},
        headers={"X-User-ID": user_id},
    )


def test_upload_txt_and_list(client):
    resp = upload(client, "user-001", "notes.txt", b"pump maintenance inspection steps")
    assert resp.status_code == 201
    body = resp.json()
    assert body["document_id"].startswith("doc-")
    assert body["filename"] == "notes.txt"
    assert body["status"] == "ready"
    assert body["chunk_count"] >= 1

    docs = client.get("/api/documents", headers={"X-User-ID": "user-001"}).json()
    assert len(docs) == 1
    assert docs[0]["document_id"] == body["document_id"]
    assert docs[0]["status"] == "ready"


def test_upload_markdown(client):
    resp = upload(client, "user-001", "readme.md", b"# Title\nbody")
    assert resp.status_code == 201
    assert resp.json()["status"] == "ready"


def test_upload_text_pdf(client):
    import io

    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 720, "Pump inspection every 30 days")
    c.save()
    resp = upload(client, "user-001", "manual.pdf", buf.getvalue(), "application/pdf")
    assert resp.status_code == 201
    assert resp.json()["status"] == "ready"


def test_upload_scanned_pdf_reports_ocr(client):
    from tests.conftest import make_blank_pdf

    import io
    import os
    import tempfile

    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()
    make_blank_pdf(tmp.name)
    with open(tmp.name, "rb") as fh:
        data = fh.read()
    os.unlink(tmp.name)
    resp = upload(client, "user-001", "scan.pdf", data, "application/pdf")
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "failed"
    assert "Document requires OCR" in body["error"]


def test_upload_malformed_pdf_fails_cleanly(client):
    resp = upload(client, "user-001", "broken.pdf", b"not a real pdf", "application/pdf")
    assert resp.status_code == 201
    assert resp.json()["status"] == "failed"


def test_upload_unsupported_type_rejected(client):
    resp = upload(client, "user-001", "notes.docx", b"x")
    assert resp.status_code == 400


def test_get_and_delete_document(client):
    body = upload(client, "user-001", "a.txt", b"hello").json()
    doc_id = body["document_id"]
    got = client.get(f"/api/documents/{doc_id}", headers={"X-User-ID": "user-001"})
    assert got.status_code == 200
    assert got.json()["document_id"] == doc_id

    deleted = client.delete(f"/api/documents/{doc_id}", headers={"X-User-ID": "user-001"})
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
    assert client.get(f"/api/documents/{doc_id}", headers={"X-User-ID": "user-001"}).status_code == 404


def test_ownership_isolation(client):
    upload(client, "user-001", "secret.txt", b"classified pump data")
    docs_b = client.get("/api/documents", headers={"X-User-ID": "user-002"}).json()
    assert docs_b == []

    doc_a = client.get("/api/documents", headers={"X-User-ID": "user-001"}).json()[0]
    assert client.get(f"/api/documents/{doc_a['document_id']}", headers={"X-User-ID": "user-002"}).status_code == 404
    assert client.delete(f"/api/documents/{doc_a['document_id']}", headers={"X-User-ID": "user-002"}).status_code == 404
    # still present for the owner
    assert client.get(f"/api/documents/{doc_a['document_id']}", headers={"X-User-ID": "user-001"}).status_code == 200


def test_no_public_search_endpoint(client):
    # the agent must use the document_search tool; no public search API exists
    resp = client.get("/api/documents/search", headers={"X-User-ID": "user-001"})
    assert resp.status_code == 404


def test_health_knowledge_base_section(client, test_models):
    upload(client, "user-001", "a.txt", b"pump maintenance")
    health = client.get("/health").json()
    assert "knowledge_base" in health
    assert health["knowledge_base"]["documents"] == 1
    assert health["knowledge_base"]["chunks"] >= 1
    assert health["knowledge_base"]["embedding"]["provider"] == "fake"
    assert health["knowledge_base"]["vector_store"] == "json"
