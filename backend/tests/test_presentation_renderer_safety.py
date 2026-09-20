"""Presentation renderer error messages must never leak internal detail (an
absolute workspace path, a raw subprocess stderr dump) into agent-visible
tool output — only a stable, safe message, with the real detail logged
server-side. document_generator.py already gets this right for Word/Excel
(its own exceptions are pre-sanitized to exc.__class__.__name__ before they
reach tools.py); this is the same guarantee for the presentation renderer.

Unit-level and Node-independent: subprocess.run and zipfile.ZipFile are
monkeypatched, so this runs without the real render.cjs.
"""

import subprocess
import zipfile

import pytest

from app.schemas.presentation import PresentationContent
from app.services.presentation_renderer import (
    NodePresentationRenderer,
    PresentationRenderError,
    validate_pptx,
)


def _content() -> PresentationContent:
    return PresentationContent.model_validate(
        {"title": "T", "slides": [{"type": "title", "title": "T"}]}
    )


def test_node_renderer_failure_does_not_leak_the_output_path(tmp_path, monkeypatch):
    """A crashing Node process commonly echoes the absolute path it failed to
    write in its stderr (a raw fs ENOENT/EACCES error) — that must never
    reach the model, only the server log."""

    output_dir = tmp_path / "workspaces" / "user-001" / "job-abc" / "artifacts"
    output_dir.mkdir(parents=True)
    target_path = output_dir / "deck.pptx"
    sensitive_stderr = (
        f"Error: ENOENT: no such file or directory, open '{target_path}'\n"
        "    at Object.openSync (node:fs:594:3)"
    )

    class FakeCompletedProcess:
        returncode = 1
        stdout = ""
        stderr = sensitive_stderr

    def fake_run(*args, **kwargs):
        return FakeCompletedProcess()

    monkeypatch.setattr(subprocess, "run", fake_run)
    # Any existing file satisfies the "script is installed" check; the fake
    # subprocess.run means it is never actually executed.
    renderer = NodePresentationRenderer(script_path=str(__file__))

    with pytest.raises(PresentationRenderError) as excinfo:
        renderer.generate(_content(), output_dir, "deck.pptx")

    message = str(excinfo.value)
    assert str(output_dir) not in message
    assert str(target_path) not in message
    assert "user-001" not in message
    assert "node:fs" not in message


def test_validate_pptx_zip_error_does_not_leak_the_path(tmp_path, monkeypatch):
    """An OSError from opening a corrupted/inaccessible package commonly
    embeds the absolute path in its own message; the wrapped error must not."""

    target = tmp_path / "workspaces" / "user-001" / "job-abc" / "artifacts" / "deck.pptx"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"not a real zip")

    def fake_zipfile(path, *args, **kwargs):
        raise OSError(f"[Errno 13] Permission denied: '{path}'")

    monkeypatch.setattr(zipfile, "ZipFile", fake_zipfile)

    with pytest.raises(PresentationRenderError) as excinfo:
        validate_pptx(target, expected_slides=1)

    message = str(excinfo.value)
    assert str(target) not in message
    assert "user-001" not in message
    assert message.endswith("OSError")
