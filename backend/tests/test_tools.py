"""Direct tests for the workspace-scoped tools and their validation."""

import asyncio
from pathlib import Path

import pytest

from app.services.tool_registry import ToolRegistry, validate_arguments
from app.services.tools import (
    ListFilesTool,
    ReadFileTool,
    ToolError,
    WriteFileTool,
)


def make_registry() -> ToolRegistry:
    return ToolRegistry([ListFilesTool(), ReadFileTool(), WriteFileTool()])


def run(coro):
    return asyncio.run(coro)


def test_list_files_lists_workspace_files(tmp_path):
    (tmp_path / "a.txt").write_text("x", encoding="utf-8")
    (tmp_path / "b.txt").write_text("y", encoding="utf-8")
    result = run(make_registry().execute("list_files", {}, tmp_path))
    assert result.ok
    assert result.content == "a.txt\nb.txt"


def test_list_files_empty_workspace(tmp_path):
    result = run(make_registry().execute("list_files", {}, tmp_path))
    assert result.ok
    assert result.content == ""


def test_read_file_reads_text(tmp_path):
    (tmp_path / "r.txt").write_text("hello", encoding="utf-8")
    result = run(make_registry().execute("read_file", {"path": "r.txt"}, tmp_path))
    assert result.ok
    assert result.content == "hello"


def test_read_missing_file_raises(tmp_path):
    with pytest.raises(ToolError, match="not found"):
        run(make_registry().execute("read_file", {"path": "nope.txt"}, tmp_path))


def test_write_file_writes_content(tmp_path):
    result = run(
        make_registry().execute(
            "write_file", {"path": "out.txt", "content": "data"}, tmp_path
        )
    )
    assert result.ok
    assert (tmp_path / "out.txt").read_text(encoding="utf-8") == "data"


def test_write_file_creates_subdirs(tmp_path):
    run(make_registry().execute("write_file", {"path": "a/b/c.txt", "content": "x"}, tmp_path))
    assert (tmp_path / "a" / "b" / "c.txt").read_text(encoding="utf-8") == "x"


def test_unknown_tool_rejected(tmp_path):
    with pytest.raises(ToolError, match="Unknown tool"):
        run(make_registry().execute("nope", {}, tmp_path))


def test_read_traversal_rejected_and_outside_untouched(tmp_path):
    outside = tmp_path.parent / "outside-secret.txt"
    outside.write_text("secret", encoding="utf-8")
    with pytest.raises(ToolError, match="escapes"):
        run(make_registry().execute("read_file", {"path": "../outside-secret.txt"}, tmp_path))
    assert outside.read_text(encoding="utf-8") == "secret"


def test_write_traversal_rejected_and_outside_untouched(tmp_path):
    outside = tmp_path.parent / "pwned.txt"
    with pytest.raises(ToolError, match="escapes"):
        run(
            make_registry().execute(
                "write_file", {"path": "../pwned.txt", "content": "x"}, tmp_path
            )
        )
    assert not outside.exists()


def test_absolute_path_rejected(tmp_path):
    with pytest.raises(ToolError, match="Absolute"):
        run(make_registry().execute("read_file", {"path": str(tmp_path / "x")}, tmp_path))


def test_user_workspaces_cannot_reach_each_other(tmp_path):
    ws_a = tmp_path / "user-001" / "job-a"
    ws_a.mkdir(parents=True)
    ws_b = tmp_path / "user-002" / "job-b"
    ws_b.mkdir(parents=True)
    (ws_b / "secret.txt").write_text("topsecret", encoding="utf-8")
    with pytest.raises(ToolError, match="escapes"):
        run(
            make_registry().execute(
                "read_file", {"path": "../user-002/job-b/secret.txt"}, ws_a
            )
        )
    assert (ws_b / "secret.txt").read_text(encoding="utf-8") == "topsecret"


def test_validate_missing_required_argument():
    with pytest.raises(ToolError, match="Missing required"):
        validate_arguments(ReadFileTool.input_schema, {})


def test_validate_extra_argument():
    with pytest.raises(ToolError, match="Unexpected argument"):
        validate_arguments(ReadFileTool.input_schema, {"path": "a", "extra": 1})


def test_validate_wrong_type():
    with pytest.raises(ToolError, match="must be a string"):
        validate_arguments(ReadFileTool.input_schema, {"path": 123})


def test_coerce_arguments_parses_a_json_array_string():
    """A weak model that stringifies an array argument (e.g. document_generation's
    ``sections``) gets it parsed back into a real list, not silently dropped."""
    from app.services.tool_registry import coerce_arguments

    schema = {
        "type": "object",
        "properties": {"sections": {"type": "array", "items": {"type": "object"}}},
    }
    raw = '[{"heading": "Findings", "content": "text"}]'
    coerced, fields = coerce_arguments(schema, {"sections": raw})
    assert fields == ["sections"]
    assert coerced["sections"] == [{"heading": "Findings", "content": "text"}]


def test_validate_arguments_rejects_an_unparseable_array_string():
    """A ``sections`` value that never became a real array (e.g. malformed
    JSON coerce_arguments could not parse) is rejected with a clear message,
    never iterated character-by-character into garbage sections."""
    schema = {
        "type": "object",
        "properties": {"sections": {"type": "array", "items": {"type": "object"}}},
    }
    with pytest.raises(ToolError, match="must be an array"):
        validate_arguments(schema, {"sections": "not json at all"})


def test_validate_arguments_rejects_an_array_of_non_objects():
    """A ``sections`` array whose items are strings (each element still
    JSON-stringified) is rejected, not passed through as fake sections."""
    schema = {
        "type": "object",
        "properties": {"sections": {"type": "array", "items": {"type": "object"}}},
    }
    with pytest.raises(ToolError, match="array of objects"):
        validate_arguments(schema, {"sections": ['{"heading": "X"}']})


def test_write_file_rejects_non_string_content(tmp_path):
    with pytest.raises(ToolError, match="must be a string"):
        run(
            make_registry().execute(
                "write_file", {"path": "o.txt", "content": 5}, tmp_path
            )
        )


def test_tool_execution_is_deny_by_default(tmp_path):
    registry = make_registry()
    assert "list_files" in registry.names()
    assert "read_file" in registry.names()
    assert "write_file" in registry.names()
    assert len(registry.names()) == 3
