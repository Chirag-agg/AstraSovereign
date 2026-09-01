"""AuditStore tests: creation, persistence, concurrency, filtering, and the
log->audit mapping (Phase 11)."""

import logging
from concurrent.futures import ThreadPoolExecutor

import pytest

from app.schemas.audit import AuditEvent
from app.services.audit_store import (
    EVENT_TYPE_MAP,
    JsonlAuditStore,
    get_audit_store,
)


def make_event(event_type="JOB_CREATED", job_id=None, user_id=None, **metadata):
    return AuditEvent(
        event_id="evt-x",
        event_type=event_type,
        job_id=job_id,
        user_id=user_id,
        metadata=metadata,
    )


def test_audit_event_creation_has_required_fields():
    event = make_event(job_id="job-1", user_id="user-001")
    assert event.event_id
    assert event.timestamp is not None
    assert event.event_type == "JOB_CREATED"
    assert event.job_id == "job-1"
    assert event.user_id == "user-001"
    assert event.component == "app"
    assert isinstance(event.metadata, dict)


def test_audit_event_persistence_across_restart(tmp_path):
    store = JsonlAuditStore()
    store.configure(str(tmp_path))
    store.append(make_event("MODEL_CALL_COMPLETED", "job-1", "user-001"))
    store.append(make_event("JOB_COMPLETED", "job-1", "user-001"))
    store.configure(str(tmp_path))  # simulate restart: reload from disk
    events = store.list()
    assert len(events) == 2
    assert {e.event_type for e in events} == {"MODEL_CALL_COMPLETED", "JOB_COMPLETED"}


def test_concurrent_audit_writes_are_safe(tmp_path):
    store = JsonlAuditStore()
    store.configure(str(tmp_path))

    def write(i):
        store.append(make_event("JOB_CREATED", f"job-{i}", "user-001"))

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(write, range(50)))

    assert len(store.list()) == 50
    store.configure(str(tmp_path))  # reload: all lines must have been appended
    assert len(store.list()) == 50


def test_audit_filtering_by_user_and_job(tmp_path):
    store = JsonlAuditStore()
    store.configure(str(tmp_path))
    for user in ("user-001", "user-002"):
        for job in ("job-a", "job-b"):
            store.append(make_event("JOB_CREATED", job, user))

    own = store.list(user_id="user-001")
    assert len(own) == 2
    assert all(e.user_id == "user-001" for e in own)

    filtered = store.list(user_id="user-001", job_id="job-a")
    assert len(filtered) == 1
    assert filtered[0].job_id == "job-a"


def test_audit_pagination(tmp_path):
    store = JsonlAuditStore()
    store.configure(str(tmp_path))
    for i in range(25):
        store.append(make_event("JOB_CREATED", f"job-{i}", "user-001"))
    page1 = store.list(user_id="user-001", limit=10, offset=0)
    page2 = store.list(user_id="user-001", limit=10, offset=10)
    assert len(page1) == 10
    assert len(page2) == 10
    ids1 = {e.job_id for e in page1}
    ids2 = {e.job_id for e in page2}
    assert ids1.isdisjoint(ids2)


def test_sensitive_payload_excluded_from_metadata(tmp_path, caplog):
    store = get_audit_store()
    store.configure(str(tmp_path))  # resets the singleton store to this test's file
    secret = "TOP-SECRET-PROMPT-CONTENT"
    with caplog.at_level(logging.INFO, logger="app.audit_test"):
        logging.getLogger("app.audit_test").info(
            "model_call_started",
            extra={
                "event": "model_call_started",
                "model": "llama3.1:latest",
                "prompt": secret,
                "response": secret,
                "document_contents": secret,
            },
        )
    events = store.list()
    assert len(events) == 1
    assert events[0].event_type == "MODEL_CALL_STARTED"
    assert "prompt" not in events[0].metadata
    assert "response" not in events[0].metadata
    assert "document_contents" not in events[0].metadata
    assert events[0].metadata.get("model") == "llama3.1:latest"


def test_log_event_mapping_covers_expected_types():
    for key in (
        "job_created",
        "model_selected",
        "model_call_completed",
        "tool_call_started",
        "document_ingestion_completed",
        "document_search_completed",
        "ocr_completed",
        "vision_completed",
        "code_execution_completed",
        "document_generation_completed",
        "resource_allocated",
        "resource_released",
    ):
        assert key in EVENT_TYPE_MAP
        assert EVENT_TYPE_MAP[key].isupper()


def test_get_audit_store_is_configured_singleton(tmp_path):
    get_audit_store().configure(str(tmp_path))
    get_audit_store().append(make_event("JOB_CREATED", "job-1", "user-001"))
    assert get_audit_store().stats()["events"] == 1
    get_audit_store().reset()
