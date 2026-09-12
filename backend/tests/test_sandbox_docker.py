"""Docker integration tests for the code-execution sandbox.

These tests require a running Docker daemon AND the local sandbox image. They
are skipped explicitly (with a visible reason) when Docker is unavailable so the
normal unit-test suite never needs Docker.
"""

import asyncio
import subprocess

import pytest

from app.services.sandbox_runner import DockerSandboxRunner, SandboxRunnerError
from tests.conftest import docker_ready

pytestmark = [
    pytest.mark.docker,
    pytest.mark.skipif(
        not docker_ready(), reason="Docker daemon or python:3.12-alpine image not available"
    ),
]


def run(code, runner=None, timeout_seconds=8.0):
    return asyncio.run((runner or DockerSandboxRunner(timeout_seconds=timeout_seconds)).run(code, "python"))


def sandbox_containers():
    out = subprocess.run(
        ["docker", "ps", "-a", "--filter", "name=sandbox-", "--format", "{{.Names}}"],
        capture_output=True, text=True, timeout=10,
    )
    return [n for n in out.stdout.splitlines() if n.strip()]


def test_docker_python_executes_successfully():
    result = run("print(6 * 7)")
    assert result.success
    assert result.exit_code == 0
    assert "42" in result.stdout
    assert not result.timed_out


def test_docker_stdout_and_stderr_captured():
    ok = run("print('OUT-LINE')")
    assert "OUT-LINE" in ok.stdout
    err = run("import sys; print('ERR-LINE', file=sys.stderr)")
    assert "ERR-LINE" in err.stderr


def test_docker_syntax_error_returns_failure():
    result = run("def broken(:\n")
    assert result.success is False
    assert result.exit_code != 0
    assert "SyntaxError" in result.stderr


def test_docker_nonzero_exit_code():
    result = run("import sys; sys.exit(3)")
    assert result.success is False
    assert result.exit_code == 3


def test_docker_timeout_terminates_infinite_loop():
    result = run("while True:\n    pass", timeout_seconds=2.0)
    assert result.timed_out
    assert result.success is False
    assert result.duration_ms < 15000


def test_docker_network_access_blocked():
    code = (
        "import socket\n"
        "try:\n"
        "    socket.create_connection(('1.1.1.1', 80), timeout=3)\n"
        "    print('NETWORK_OK')\n"
        "except Exception:\n"
        "    print('NETWORK_BLOCKED')\n"
    )
    result = run(code)
    assert "NETWORK_BLOCKED" in result.stdout


def test_docker_no_host_filesystem():
    code = (
        "import os\n"
        "blocked = []\n"
        "for p in ['/workspaces', '/project', '/.env', '/data', '/app/../../etc/secret']:\n"
        "    if not os.path.exists(p):\n"
        "        blocked.append(p)\n"
        "print('BLOCKED', len(blocked))\n"
    )
    result = run(code)
    assert "BLOCKED 5" in result.stdout


def test_docker_no_docker_socket():
    result = run("import os; print('SOCK', os.path.exists('/var/run/docker.sock'))")
    assert "SOCK False" in result.stdout


def test_docker_cannot_reach_another_workspace():
    code = (
        "import os\n"
        "print('WS', os.path.exists('/workspaces/user-002/job-secret/secret.txt'))\n"
    )
    result = run(code)
    assert "WS False" in result.stdout


def test_docker_host_env_vars_not_leaked():
    result = run("import os; print('HOSTVAR', os.environ.get('DEFAULT_MODEL', 'NONE'))")
    assert "HOSTVAR NONE" in result.stdout


def test_docker_cleanup_after_success():
    assert sandbox_containers() == []
    run("print('ok')")
    assert sandbox_containers() == []


def test_docker_cleanup_after_failure():
    assert sandbox_containers() == []
    run("raise ValueError('boom')")
    assert sandbox_containers() == []


def test_docker_cleanup_after_timeout():
    assert sandbox_containers() == []
    run("while True:\n    pass", timeout_seconds=2.0)
    assert sandbox_containers() == []


def test_docker_missing_image_fails_cleanly():
    runner = DockerSandboxRunner(image="python:definitely-not-present-image", timeout_seconds=5.0)
    with pytest.raises(SandboxRunnerError, match="not available locally"):
        run("print(1)", runner=runner)


def test_docker_fork_bomb_contained():
    result = run("import os\nwhile True:\n    os.fork()\n", timeout_seconds=8.0)
    assert result.success is False
    assert result.duration_ms < 60000
    assert sandbox_containers() == []


def test_docker_memory_limit_returns_clear_error():
    runner = DockerSandboxRunner(memory_limit="64m", timeout_seconds=20.0)
    code = "chunks = []\nwhile True:\n    chunks.append(bytearray(16 * 1024 * 1024))\n"
    result = run(code, runner=runner)
    assert result.success is False
    assert result.error == "Execution exceeded the memory limit"
    assert "memory limit" in result.stderr
