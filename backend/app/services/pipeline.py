"""Multi-model pipeline execution.

A complex task is decomposed into an ordered list of capability stages
(``reasoning | math | coding | document | vision``). Each stage runs its own
bounded agent session against a *different* local model chosen by capability,
and prior stage outputs are chained (hard-truncated, explicitly marked) into the
next stage's prompt. The final stage's output becomes the job response.

Guardrails:
- The planner may only emit capabilities from the server-side allowlist.
- The whole plan is validated (allowlist + every capability resolvable to an
  enabled model) BEFORE any stage executes.
- Retries happen only when a stage failed without any tool side effects.
- Stage allocations are requested and released one at a time.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from app.schemas.job import Job, JobStatus
from app.services.agent import Agent, AgentResult, AgentStatus
from app.services.capability_router import CapabilityRouter, CapabilityRoutingError
from app.services.job_manager import JobManager
from app.services.ollama_service import OllamaService
from app.services.resource_scheduler import ResourceScheduler

logger = logging.getLogger("app.pipeline")

ALLOWED_PIPELINE_CAPABILITIES = frozenset({"reasoning", "math", "coding", "document", "vision", "presentation"})

_MAX_STAGES = 4
_STAGE_MAX_ITERATIONS = 4
_STAGE_MAX_TOOL_CALLS = 8
_ATTEMPTS = 2
_MAX_STAGE_OUTPUT_CHARS = 12000
_MAX_CONTEXT_CHARS = 16000

_CODING_RE = re.compile(r"\b(python|javascript|typescript|code|function|def\b|script|implement|program|matrix|algorithm\w*|loop)\b", re.IGNORECASE)
_MATH_RE = re.compile(r"\b(math|matrix|vector|equation|derive|compute|calculate|complexity|big-?o|proof|numeric)\b", re.IGNORECASE)
_DOC_RE = re.compile(r"\b(doc|document|docx|word|pdf|letter|memo|essay|article|write.?up|page)\b", re.IGNORECASE)


class PipelineError(Exception):
    """A pipeline could not be planned or executed."""


class StageDef(BaseModel):
    key: str
    label: str
    capability: str
    instruction: str


class PipelinePlan(BaseModel):
    stages: list[StageDef]
    summary: str = ""


def _signals(text: str) -> dict[str, bool]:
    t = text or ""
    return {
        "coding": bool(_CODING_RE.search(t)),
        "math": bool(_MATH_RE.search(t)),
        "document": bool(_DOC_RE.search(t)),
    }


class ComplexityGate:
    """Decides whether a request warrants the multi-stage pipeline.

    Kept intentionally separate from the TaskRouter (what kind of task?) and the
    planner (what sequence of capabilities?).
    """

    def __init__(self, min_prompt_chars: int = 40) -> None:
        self._min_chars = min_prompt_chars

    def should_pipeline(self, task_type: str, message: str) -> bool:
        text = (message or "").strip()
        sig = _signals(text)
        present = [k for k in ("coding", "math", "document") if sig[k]]
        # Only genuinely multi-capability requests warrant a multi-model
        # pipeline; single-capability tasks keep the fast single-model path.
        if len(present) < 2:
            return False
        if task_type not in {"coding", "document", "general"}:
            return False
        return len(text) >= self._min_chars


class Planner:
    """Produces an ordered capability plan, validated before it may run."""

    def __init__(
        self,
        capability_router: CapabilityRouter,
        ollama: OllamaService,
        planner_capability: str = "reasoning",
        max_stages: int = _MAX_STAGES,
    ) -> None:
        self._router = capability_router
        self._ollama = ollama
        self._planner_capability = planner_capability
        self._max_stages = max_stages

    def fallback_plan(self, task_type: str, message: str) -> list[StageDef]:
        """Deterministic stage templates, filtered to capabilities that can run."""
        sig = _signals(message)
        items: list[tuple[str, str, str]] = []
        if sig["coding"] and sig["document"]:
            items = [  # (capability, label, instruction)
                ("reasoning", "Reasoning", "Analyse the request, decide the algorithm/approach and what the document must contain."),
                ("coding", "Coding", "Write the code that implements the algorithm (standard library or numpy) and run it to verify output."),
                ("document", "Document generation", "Generate the final deliverable document covering the algorithm and the verified code/output."),
            ]
        elif sig["coding"] and sig["math"]:
            items = [
                ("reasoning", "Reasoning", "Break the problem into mathematical steps."),
                ("math", "Mathematics", "Derive or compute the required formula/numeric result."),
                ("coding", "Coding", "Implement the derivation in code (standard library only) and run it to verify."),
            ]
        elif sig["document"]:
            items = [
                ("reasoning", "Reasoning", "Plan the document structure and content outline."),
                ("document", "Document generation", "Generate the deliverable document with the full structured content."),
            ]
        elif sig["coding"]:
            items = [
                ("reasoning", "Reasoning", "Design the algorithm and decide how to verify it."),
                ("coding", "Coding", "Implement the algorithm in code (standard library or numpy) and run it to verify."),
            ]
        elif sig["math"]:
            items = [
                ("reasoning", "Reasoning", "Set up the mathematics for the request."),
                ("math", "Mathematics", "Compute the result."),
            ]
        if not items:
            return []
        if not all(self._resolvable(cap) for cap, _, _ in items):
            return []
        return [
            StageDef(key=f"stage-{i + 1}", label=label, capability=cap, instruction=instr)
            for i, (cap, label, instr) in enumerate(items[: self._max_stages])
        ]

    def _resolvable(self, capability: str) -> bool:
        try:
            self._router.resolve(capability)
            return True
        except CapabilityRoutingError:
            return False

    async def _llm_plan(self, job: Job) -> Optional[list[StageDef]]:
        """Ask the planner model for a stage plan; never executes stages."""
        try:
            resolved = self._router.resolve(self._planner_capability)
        except CapabilityRoutingError:
            return None
        allowed = ", ".join(sorted(ALLOWED_PIPELINE_CAPABILITIES))
        prompt = (
            "You are the pipeline planner of a local multi-model AI workbench. "
            "You ONLY plan; you never execute. Given the task, output a short JSON plan:\n"
            '{"summary":"...","stages":[{"capability":"...","instruction":"one short line what this stage must output"}]}\n'
            f"The ONLY allowed capabilities are: {allowed}. "
            f"Use at most {self._max_stages} stages. First stage should usually be reasoning. "
            f"Output STRICT JSON only, no prose.\n\nTASK: {job.message}"
        )
        raw, _model_used = await self._ollama.generate(
            prompt, model=resolved.model, format="json"
        )
        parsed = _parse_json_plan(raw)
        if parsed is None:
            return None
        stages: list[StageDef] = []
        for idx, item in enumerate(parsed[: self._max_stages]):
            cap = str(item.get("capability", "")).strip().lower()
            if cap not in ALLOWED_PIPELINE_CAPABILITIES:
                return None  # planner tried to invent a capability
            instr = str(item.get("instruction", "")).strip() or "Complete this stage."
            stages.append(
                StageDef(
                    key=f"stage-{idx + 1}",
                    label=cap.capitalize(),
                    capability=cap,
                    instruction=instr,
                )
            )
        if not stages:
            return None
        # whole plan must be executable with enabled models
        try:
            for s in stages:
                self._router.resolve(s.capability)
        except CapabilityRoutingError:
            return None
        return stages

    async def plan(self, job: Job, task_type: str) -> PipelinePlan:
        llm = await self._llm_plan(job)
        stages = llm if llm is not None else self.fallback_plan(task_type, job.message)
        if not stages:
            raise PipelineError(
                "Pipeline unavailable: no enabled local model can serve the capabilities this task needs."
            )
        return PipelinePlan(
            stages=stages,
            summary=f"{len(stages)} capability stages: " + " â†’ ".join(f"{s.label} ({s.capability})" for s in stages),
        )


def _parse_json_plan(raw: Optional[str]) -> Optional[list[dict]]:
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (ValueError, json.JSONDecodeError):
        data = None
    if isinstance(data, dict):
        stages = data.get("stages")
        if isinstance(stages, list):
            return stages
        return None
    # Tolerate a raw array of stages
    if isinstance(data, list):
        return data
    return None


class PipelineExecutor:
    """Runs one planned pipeline: allocate stage model -> run -> release -> next."""

    def __init__(
        self,
        manager: JobManager,
        agent: Agent,
        capability_router: CapabilityRouter,
        scheduler: ResourceScheduler,
        ollama: OllamaService,
        planner_capability: str = "reasoning",
        max_stages: int = _MAX_STAGES,
        stage_max_iterations: int = _STAGE_MAX_ITERATIONS,
        stage_max_tool_calls: int = _STAGE_MAX_TOOL_CALLS,
        attempts: int = _ATTEMPTS,
        max_stage_output_chars: int = _MAX_STAGE_OUTPUT_CHARS,
        max_context_chars: int = _MAX_CONTEXT_CHARS,
        stage_requirements_fn=None,
    ) -> None:
        self._manager = manager
        self._agent = agent
        self._router = capability_router
        self._scheduler = scheduler
        self._ollama = ollama
        self._planner = Planner(
            capability_router=capability_router,
            ollama=ollama,
            planner_capability=planner_capability,
            max_stages=max_stages,
        )
        self._max_stages = max_stages
        self._stage_max_iterations = stage_max_iterations
        self._stage_max_tool_calls = stage_max_tool_calls
        self._attempts = attempts
        self._max_stage_output_chars = max_stage_output_chars
        self._max_context_chars = max_context_chars

    async def _is_cancelled(self, job_id: str) -> bool:
        job = await self._manager.get_job_for_worker(job_id)
        return job is None or job.status == JobStatus.CANCELLED

    async def _allocate_stage(self, job: Job, key: str, model: str, requirements) -> bool:
        sub_id = f"{job.job_id}:{key}"
        while True:
            decision = await self._scheduler.request(sub_id, job.user_id, model, requirements)
            if decision.decision == "grant":
                return True
            if decision.decision == "reject":
                logger.error(
                    "pipeline_stage_resource_rejected",
                    extra={"event": "pipeline_stage_failed", "job_id": job.job_id, "stage": key},
                )
                return False
            await self._scheduler.wait_until_available(timeout=1.0)
            if await self._is_cancelled(job.job_id):
                try:
                    await self._scheduler.cancel(sub_id)
                except Exception:
                    pass
                return False

    async def _release_stage(self, job: Job, key: str) -> None:
        try:
            await self._scheduler.release(f"{job.job_id}:{key}")
        except Exception:
            logger.exception(
                "pipeline_stage_release_error",
                extra={"event": "pipeline_stage_failed", "job_id": job.job_id, "stage": key},
            )

    def _stage_task(
        self,
        stage: StageDef,
        job: Job,
        outputs: dict[str, str],
        base_text: Optional[str] = None,
    ) -> str:
        parts = [stage.instruction, "", f"Original request: {base_text or job.message}"]
        prior = []
        budget = self._max_context_chars
        for key, text in outputs.items():
            capped = self._truncate(text, self._max_stage_output_chars)
            prior.append(f"[Stage {key} output]\n{capped}")
        if prior:
            joined = "\n\n".join(prior)
            if len(joined) > budget:
                joined = self._truncate(joined, budget)
            parts.append("")
            parts.append("Use the outputs of earlier stages below when relevant.")
            parts.append(joined)
        return "\n".join(parts)

    @staticmethod
    def _truncate(text: str, limit: int) -> str:
        text = text or ""
        if len(text) <= limit:
            return text
        return text[:limit] + f"\n[Previous stage output truncated at {limit} characters]"

    async def execute(
        self,
        job: Job,
        workspace,
        task_type: str,
        lead_model: str,
        task_text: Optional[str] = None,
    ) -> AgentResult:
        trace: list[dict] = []
        history: list[str] = []
        try:
            plan = await self._planner.plan(job, task_type)
        except PipelineError as exc:
            return await self._fail_job(job, trace, str(exc))

        outputs: dict[str, str] = {}
        summary_lines: list[str] = []
        completed_stage_keys: list[str] = []

        for stage in plan.stages:
            if await self._is_cancelled(job.job_id):
                return AgentResult(status=AgentStatus.CANCELLED)
            try:
                resolved = self._router.resolve(stage.capability)
            except CapabilityRoutingError as exc:
                return await self._fail_job(job, trace, str(exc))

            if not await self._allocate_stage(job, stage.key, resolved.model, resolved.requirements):
                if await self._is_cancelled(job.job_id):
                    return AgentResult(status=AgentStatus.CANCELLED)
                return await self._fail_job(
                    job, trace, f"Pipeline unavailable: resources for stage '{stage.label}' were rejected."
                )

            result: Optional[AgentResult] = None
            attempt = 0
            try:
                while attempt < self._attempts:
                    attempt += 1
                    if await self._is_cancelled(job.job_id):
                        return AgentResult(status=AgentStatus.CANCELLED)
                    trace.append(
                        {
                            "step": len(trace) + 1,
                            "type": "stage_started",
                            "stage": stage.key,
                            "label": stage.label,
                            "capability": stage.capability,
                            "model": resolved.model,
                            "attempt": attempt,
                        }
                    )
                    await self._agent.record_trace(job.job_id, trace, f"stage:{stage.key}", 0, 0)
                    stage_task = self._stage_task(stage, job, outputs, base_text=task_text)
                    result = await self._agent.run(
                        job,
                        model=resolved.model,
                        workspace=workspace,
                        trace=trace,
                        history=history,
                        task_text=stage_task,
                        max_iterations=self._stage_max_iterations,
                        max_tool_calls=self._stage_max_tool_calls,
                        append_start=False,
                        enforce_contracts=False,
                    )
                    if result.status == AgentStatus.COMPLETED:
                        break
                    if result.status == AgentStatus.CANCELLED:
                        return result
                    # Retry only if nothing side-effecting happened yet.
                    if result.tool_calls == 0 and attempt < self._attempts:
                        trace.append(
                            {
                                "step": len(trace) + 1,
                                "type": "stage_retry",
                                "stage": stage.key,
                                "label": stage.label,
                                "attempt": attempt,
                            }
                        )
                        await self._agent.record_trace(job.job_id, trace, f"stage:{stage.key}", 0, 0)
                        continue
                    break
            finally:
                await self._release_stage(job, stage.key)

            if result is None or result.status == AgentStatus.FAILED:
                return await self._fail_job(
                    job,
                    trace,
                    result.error if result is not None else f"Pipeline stage '{stage.label}' produced no result",
                    stage_label=stage.label,
                )
            output = result.response or ""
            outputs[stage.key] = output
            completed_stage_keys.append(stage.key)
            summary_lines.append(
                f"{stage.label} ({stage.capability}) -> {resolved.model} [completed, attempt {attempt}]"
            )
            trace.append(
                {
                    "step": len(trace) + 1,
                    "type": "stage_completed",
                    "stage": stage.key,
                    "label": stage.label,
                    "capability": stage.capability,
                    "model": resolved.model,
                    "attempt": attempt,
                    "status": "completed",
                    "output_summary": self._truncate(output, 400),
                }
            )
            await self._agent.record_trace(job.job_id, trace, f"stage:{stage.key}", 0, 0)

        final_key = completed_stage_keys[-1] if completed_stage_keys else None
        response = outputs.get(final_key or "", "") if final_key else ""
        pipeline_note = (
            "\n\n_Completed via local multi-model pipeline: "
            + " â†’ ".join(s.split(" -> ")[0] for s in summary_lines)
            + "._"
        )
        trace.append(
            {
                "step": len(trace) + 1,
                "type": "pipeline_completed",
                "stages": summary_lines,
            }
        )
        await self._agent.record_trace(job.job_id, trace, "completed", 0, 0)
        logger.info(
            "pipeline_completed",
            extra={"event": "pipeline_completed", "job_id": job.job_id, "user_id": job.user_id, "stages": summary_lines},
        )
        return AgentResult(status=AgentStatus.COMPLETED, response=response + pipeline_note)

    async def _fail_job(self, job: Job, trace: list[dict], error: str, stage_label: Optional[str] = None) -> AgentResult:
        prefix = f"Pipeline stage '{stage_label}': " if stage_label else "Pipeline: "
        trace.append({"step": len(trace) + 1, "type": "agent_failed", "error": prefix + error})
        try:
            await self._manager.update_job(
                job.job_id,
                execution_trace=trace,
                agent_stage="failed",
                error=(prefix + error)[:2000],
            )
        except Exception:
            logger.exception("pipeline_store_error", extra={"event": "job_failed", "job_id": job.job_id})
        return AgentResult(status=AgentStatus.FAILED, error=prefix + error)

