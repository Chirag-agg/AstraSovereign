"""Data cleanup / retention policy tests (issue #9)."""

import os
import time

from app.services.data_cleanup import (
    CleanupReport,
    cleanup_old_files,
    cleanup_workspace_dirs,
)


def set_age(path, days_old, now):
    os.utime(path, (now - days_old * 86400, now - days_old * 86400))


def make_file(root, rel, days_old, now):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("x" * 10, encoding="utf-8")
    set_age(path, days_old, now)
    return path


def test_cleanup_old_files_removes_only_old_files(tmp_path):
    now = time.time()
    old = make_file(tmp_path, "a/old.txt", 40, now)
    recent = make_file(tmp_path, "a/recent.txt", 2, now)
    set_age(tmp_path / "a", 40, now)

    report = cleanup_old_files(tmp_path, max_age_days=30, now=now, dry_run=False)

    assert not old.exists()
    assert recent.exists()
    assert report.removed_files == 1
    assert report.freed_bytes == 10


def test_cleanup_old_files_dry_run_removes_nothing(tmp_path):
    now = time.time()
    old = make_file(tmp_path, "old.txt", 40, now)

    report = cleanup_old_files(tmp_path, max_age_days=30, now=now, dry_run=True)

    assert old.exists()
    assert report.removed_files == 1  # reported but not removed
    assert report.freed_bytes == 10


def test_cleanup_prunes_empty_parent_dirs(tmp_path):
    now = time.time()
    old = make_file(tmp_path, "user-001/job-abc/artifacts/note.docx", 40, now)

    cleanup_old_files(tmp_path, max_age_days=30, now=now, dry_run=False)

    assert not (tmp_path / "user-001").exists()
    assert not (tmp_path / "user-001" / "job-abc").exists()


def test_cleanup_missing_root_returns_empty(tmp_path):
    report = cleanup_old_files(tmp_path / "nope", max_age_days=30, now=time.time(), dry_run=False)
    assert isinstance(report, CleanupReport)
    assert report.removed_files == 0
    assert report.removed_dirs == 0


def test_cleanup_workspace_dirs_removes_old_jobs_only(tmp_path):
    now = time.time()
    old_job = tmp_path / "user-001" / "job-old"
    old_job.mkdir(parents=True)
    (old_job / "artifacts").mkdir()
    (old_job / "artifacts" / "note.docx").write_text("x", encoding="utf-8")
    set_age(old_job, 40, now)

    recent_job = tmp_path / "user-001" / "job-recent"
    recent_job.mkdir(parents=True)
    (recent_job / "report.txt").write_text("data", encoding="utf-8")
    set_age(recent_job, 2, now)

    report = cleanup_workspace_dirs(tmp_path, max_age_days=30, now=now, dry_run=False)

    assert not old_job.exists()
    assert recent_job.exists()
    assert report.removed_dirs >= 1
    # user-001 still holds the recent job, so it survives
    assert (tmp_path / "user-001").exists()


def test_cleanup_workspace_dirs_keeps_user_with_recent_job(tmp_path):
    now = time.time()
    old_job = tmp_path / "user-001" / "job-old"
    old_job.mkdir(parents=True)
    set_age(old_job, 40, now)
    recent_job = tmp_path / "user-001" / "job-recent"
    recent_job.mkdir(parents=True)
    (recent_job / "report.txt").write_text("data", encoding="utf-8")
    set_age(recent_job, 2, now)

    cleanup_workspace_dirs(tmp_path, max_age_days=30, now=now, dry_run=False)

    assert not old_job.exists()
    assert recent_job.exists()
    assert (tmp_path / "user-001").exists()  # still holds a recent job


def test_cleanup_skips_symlinks(tmp_path):
    now = time.time()
    target = tmp_path.parent / "outside.txt"
    target.write_text("secret", encoding="utf-8")
    link = tmp_path / "link.txt"
    try:
        link.symlink_to(target)
    except (OSError, NotImplementedError):
        import pytest

        pytest.skip("symlinks not supported on this platform")
    set_age(link, 40, now)

    report = cleanup_old_files(tmp_path, max_age_days=30, now=now, dry_run=False)

    assert report.removed_files == 0
    assert report.skipped == 1
    assert target.exists()  # never touched
