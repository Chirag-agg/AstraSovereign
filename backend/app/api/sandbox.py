"""HTTP API: direct sandbox code execution."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.sandbox_runner import DockerSandboxRunner, ExecutionResult, SandboxRunnerError

logger = logging.getLogger("app.api.sandbox")

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])


class SandboxRunRequest(BaseModel):
    code: str = Field(..., description="Python source code to execute")
    language: str = Field("python", description="Target programming language")
    stdin: str = Field("", description="Standard input to provide")


class SandboxRunResponse(BaseModel):
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool
    duration_ms: int
    error: Optional[str] = None


@router.post("/run", response_model=SandboxRunResponse)
async def run_code(body: SandboxRunRequest, request: Request) -> SandboxRunResponse:
    """Execute code in the local sovereign sandbox."""
    runner = getattr(request.app.state, "sandbox_runner", None)
    if runner is None:
        settings = request.app.state.settings
        runner = DockerSandboxRunner(
            image=settings.sandbox_python_image,
            timeout_seconds=settings.sandbox_timeout_seconds,
            cpu_limit=settings.sandbox_cpu_limit,
            memory_limit=settings.sandbox_memory_limit,
        )

    try:
        result: ExecutionResult = await runner.run(
            code=body.code,
            language=body.language,
            stdin=body.stdin,
        )
        return SandboxRunResponse(
            success=result.success,
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            timed_out=result.timed_out,
            duration_ms=result.duration_ms,
            error=result.error,
        )
    except SandboxRunnerError as exc:
        return SandboxRunResponse(
            success=False,
            exit_code=-1,
            stdout="",
            stderr=str(exc),
            timed_out=False,
            duration_ms=0,
            error=str(exc),
        )
    except Exception as exc:
        logger.exception("Unexpected error during sandbox run")
        raise HTTPException(status_code=500, detail=str(exc))
