"""HTTP API: direct sandbox code execution (dev/sandbox UI)."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.deps import get_user_id
from app.services.sandbox_runner import ExecutionResult, SandboxRunnerError

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
async def run_code(
    body: SandboxRunRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
) -> SandboxRunResponse:
    """Execute code in the local sandbox. Only enabled when the sandbox is on."""
    runner = getattr(request.app.state, "sandbox_runner", None)
    if runner is None:
        raise HTTPException(
            status_code=503,
            detail="Sandbox is disabled (SANDBOX_ENABLED=false).",
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
        logger.exception(
            "sandbox_run_unexpected",
            extra={"event": "sandbox_run_failed", "user_id": user_id},
        )
        raise HTTPException(status_code=500, detail=str(exc))
