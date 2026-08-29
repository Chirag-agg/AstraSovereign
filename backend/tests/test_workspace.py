"""Workspace isolation: creation, sanitization, and path-resolution security."""

import asyncio
from pathlib import Path

import pytest

from app.services.workspace import (
    WorkspaceError,
    WorkspaceManager,
    resolve_within_workspace,
)


def test_safe_component_sanitizes_path_tricks():
    assert WorkspaceManager.safe_component("user-001") == "user-001"
    assert WorkspaceManager.safe_component("../../etc") == ".._.._etc"
    assert WorkspaceManager.safe_component("a/b") == "a_b"
    assert WorkspaceManager.safe_component("C:\\windows") == "C__windows"


def test_empty_component_rejected():
    with pytest.raises(WorkspaceError):
        WorkspaceManager.safe_component("")


def test_create_workspace_under_root(tmp_path):
    manager = WorkspaceManager(tmp_path)
    workspace = asyncio.run(manager.create_workspace("user-001", "job-abc"))
    assert workspace == (tmp_path / "user-001" / "job-abc")
    assert workspace.is_dir()


def test_users_have_separate_workspaces(tmp_path):
    manager = WorkspaceManager(tmp_path)
    ws_a = asyncio.run(manager.create_workspace("user-001", "job-1"))
    ws_b = asyncio.run(manager.create_workspace("user-002", "job-1"))
    assert ws_a.parent == tmp_path / "user-001"
    assert ws_b.parent == tmp_path / "user-002"
    assert ws_a != ws_b


def test_same_user_different_jobs_isolated(tmp_path):
    manager = WorkspaceManager(tmp_path)
    ws_1 = asyncio.run(manager.create_workspace("user-001", "job-a"))
    ws_2 = asyncio.run(manager.create_workspace("user-001", "job-b"))
    assert ws_1 != ws_2


def test_resolve_allows_relative_paths(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    target = resolve_within_workspace(workspace, "report.txt")
    assert target == (workspace / "report.txt")
    nested = resolve_within_workspace(workspace, "sub/dir/file.txt")
    assert nested == (workspace / "sub" / "dir" / "file.txt")


def test_resolve_rejects_traversal(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    for bad in ("../x", "..", "a/../../x", "x/../../y"):
        with pytest.raises(WorkspaceError):
            resolve_within_workspace(workspace, bad)


def test_resolve_rejects_absolute_paths(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    for bad in (str(tmp_path / "x"), "/etc/passwd", "\\\\server\\share"):
        with pytest.raises(WorkspaceError):
            resolve_within_workspace(workspace, bad)


def test_resolve_rejects_empty_path(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    with pytest.raises(WorkspaceError):
        resolve_within_workspace(workspace, "  ")


def test_resolve_rejects_symlink_escape(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("secret")
    link = workspace / "link.txt"
    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not supported on this platform")
    with pytest.raises(WorkspaceError):
        resolve_within_workspace(workspace, "link.txt")
