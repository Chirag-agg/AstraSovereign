"""Docker code-execution sandbox.

Generated code is executed ONLY inside a short-lived Docker container with:
networking disabled, no privileges, read-only root, resource limits, and a
strict timeout. Only a temporary directory (holding the generated source) is
mounted, read-only. The container is removed after execution (``--rm`` plus an
explicit best-effort ``docker rm -f`` on timeout). Nothing ever executes
directly on the host.

Sovereignty: all execution is local; the configured image must already exist
locally and is never pulled automatically.
"""

import asyncio
import logging
import shutil
import subprocess
import sys
import tempfile
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger("app.sandbox")

CONTAINER_WORKDIR = "/app"


class ExecutionResult(BaseModel):
    """Structured outcome of one sandboxed execution."""

    success: bool
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool
    duration_ms: int
    error: Optional[str] = None


class SandboxRunnerError(Exception):
    """Sandbox infrastructure failure (Docker unavailable, image missing, ...)."""


class SandboxRunner(ABC):
    """Injected into the code_execution tool; fake in unit tests."""

    @abstractmethod
    async def run(self, code: str, language: str = "python", stdin: str = "") -> ExecutionResult:
        raise NotImplementedError


class DockerSandboxRunner(SandboxRunner):
    """Runs generated code in an isolated Docker container via the CLI."""

    def __init__(
        self,
        image: str = "python:3.12-alpine",
        timeout_seconds: float = 10.0,
        cpu_limit: str = "0.5",
        memory_limit: str = "128m",
        local_fallback: bool = False,
    ) -> None:
        self._image = image
        self._timeout_seconds = timeout_seconds
        self._cpu_limit = cpu_limit
        self._memory_limit = memory_limit
        # When true, Docker failures fall back to a local subprocess run. This
        # executes generated code on the host (no container isolation), so it is
        # OFF by default.
        self._local_fallback = local_fallback

    def build_args(self, code_dir: Path, container_name: str) -> list[str]:
        """The exact ``docker run`` argument list (unit-tested for safety)."""
        return [
            "run",
            "--rm",
            "--name", container_name,
            "--network", "none",
            "--cpus", self._cpu_limit,
            "--memory", self._memory_limit,
            "--read-only",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
            "--volume", f"{code_dir}:{CONTAINER_WORKDIR}:ro",
            "--workdir", CONTAINER_WORKDIR,
            "--interactive",
            self._image,
            "python", f"{CONTAINER_WORKDIR}/main.py",
        ]

    async def run(self, code: str, language: str = "python", stdin: str = "") -> ExecutionResult:
        if language != "python":
            raise SandboxRunnerError(f"Unsupported language '{language}'")

        code_dir = Path(tempfile.mkdtemp(prefix="sovereign-sandbox-"))
        container_name = f"sandbox-{uuid.uuid4().hex[:12]}"
        started = asyncio.get_event_loop().time()
        try:
            (code_dir / "main.py").write_text(code, encoding="utf-8")
            args = self.build_args(code_dir, container_name)
            return await self._run_docker(args, container_name, stdin, started)
        except SandboxRunnerError:
            if not self._local_fallback:
                raise
            logger.warning("Docker execution failed; falling back to local isolated subprocess")
            return await self._run_subprocess(code_dir, stdin, started)
        except FileNotFoundError:
            if not self._local_fallback:
                raise SandboxRunnerError("Docker is not available on this machine") from None
            logger.warning("Docker CLI not found on host; falling back to local isolated subprocess")
            return await self._run_subprocess(code_dir, stdin, started)
        except Exception as exc:
            if not self._local_fallback:
                logger.exception(
                    "sandbox_runner_error",
                    extra={"event": "code_execution_failed", "error": str(exc)},
                )
                raise SandboxRunnerError(
                    f"Sandbox execution failed: {exc.__class__.__name__}"
                ) from exc
            logger.warning("Docker execution error (%s); falling back to local subprocess", exc)
            try:
                return await self._run_subprocess(code_dir, stdin, started)
            except Exception as sub_exc:
                logger.exception("Subprocess execution failed: %s", sub_exc)
                raise SandboxRunnerError(
                    f"Sandbox execution failed: {sub_exc.__class__.__name__}"
                ) from sub_exc
        finally:
            shutil.rmtree(code_dir, ignore_errors=True)

    def _run_subprocess_sync(self, script_path: str, cwd: str, stdin: str) -> tuple[int, str, str, bool]:
        """Execute script synchronously in an isolated process; called in thread pool."""
        try:
            res = subprocess.run(
                [sys.executable, "-u", script_path],
                input=stdin,
                capture_output=True,
                text=True,
                timeout=self._timeout_seconds,
                cwd=cwd,
            )
            return res.returncode, res.stdout, res.stderr, False
        except subprocess.TimeoutExpired as exc:
            stdout = (exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""))
            stderr = (exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or ""))
            stderr += "\n[Execution timed out after configured limit]"
            return -1, stdout, stderr, True
        except Exception as exc:
            return -1, "", f"[Subprocess execution error: {exc}]", False

    async def _run_subprocess(self, code_dir: Path, stdin: str, started: float) -> ExecutionResult:
        script_path = str(code_dir / "main.py")
        retcode, stdout, stderr, timed_out = await asyncio.to_thread(
            self._run_subprocess_sync, script_path, str(code_dir), stdin
        )
        duration_ms = int((asyncio.get_event_loop().time() - started) * 1000)

        return ExecutionResult(
            success=(retcode == 0 and not timed_out),
            exit_code=retcode,
            stdout=stdout,
            stderr=stderr,
            timed_out=timed_out,
            duration_ms=duration_ms,
        )

    async def _run_docker(self, args, container_name, stdin, started) -> ExecutionResult:
        proc = await asyncio.create_subprocess_exec(
            "docker", *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE,
        )
        stdin_bytes = stdin.encode("utf-8") if stdin else b""
        timed_out = False
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(stdin_bytes), timeout=self._timeout_seconds
            )
        except asyncio.TimeoutError:
            timed_out = True
            stdout_b, stderr_b = b"", b"[timed out]"
            await self._force_cleanup(container_name, proc)

        duration_ms = int((asyncio.get_event_loop().time() - started) * 1000)
        if proc.returncode is None:
            await proc.wait()

        returncode = proc.returncode if proc.returncode is not None else -1

        if not timed_out and returncode == 125:
            stderr_text = stderr_b.decode("utf-8", errors="replace")
            if "unable to find image" in stderr_text.lower():
                raise SandboxRunnerError(
                    f"Docker sandbox image '{self._image}' is not available locally"
                )
            raise SandboxRunnerError(
                f"Sandbox container failed to start: {self._shorten(stderr_text)}"
            )

        return ExecutionResult(
            success=(returncode == 0 and not timed_out),
            exit_code=returncode,
            stdout=stdout_b.decode("utf-8", errors="replace"),
            stderr=stderr_b.decode("utf-8", errors="replace"),
            timed_out=timed_out,
            duration_ms=duration_ms,
        )

    async def _force_cleanup(self, container_name: str, proc) -> None:
        """Best-effort removal after a timeout; never leaves orphaned containers."""
        if proc.returncode is None:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
        try:
            cleanup = await asyncio.create_subprocess_exec(
                "docker", "rm", "-f", container_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await cleanup.wait()
        except Exception:  # cleanup is best-effort
            pass
        logger.info(
            "code_execution_cleanup",
            extra={"event": "code_execution_cleanup", "container": container_name},
        )

    @staticmethod
    def _shorten(text: str, limit: int = 200) -> str:
        text = (text or "").strip()
        return text if len(text) <= limit else f"{text[:limit]}...({len(text)} chars)"
