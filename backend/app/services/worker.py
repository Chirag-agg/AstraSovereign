"""Background worker.

Pulls the next queued job, classifies its task, selects a model, requests the
model's declared resources from the scheduler (grant / wait / reject), runs the
local Agent, and records the result. One worker instance processes jobs serially,
so there is never more than one active model request at a time.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from app.schemas.job import Job, JobStatus
from app.services.agent import Agent, AgentStatus
from app.services.job_manager import JobManager
from app.services.job_queue import JobQueue
from app.services.model_router import ModelRouter, ModelRoutingError
from app.services.ollama_service import OllamaService, OllamaServiceError
from app.services.pipeline import ComplexityGate, PipelineExecutor
from app.services.resource_scheduler import ResourceScheduler
from app.services.task_router import TaskRouter
from app.services.workspace import WorkspaceManager

logger = logging.getLogger("app.worker")


class Worker:
    def __init__(
        self,
        queue: JobQueue,
        manager: JobManager,
        ollama: OllamaService,
        task_router: TaskRouter,
        model_router: ModelRouter,
        agent: Agent,
        workspace_manager: WorkspaceManager,
        scheduler: ResourceScheduler,
        pipeline_executor: Optional[PipelineExecutor] = None,
        complexity_gate: Optional[ComplexityGate] = None,
    ) -> None:
        self._queue = queue
        self._manager = manager
        self._ollama = ollama
        self._task_router = task_router
        self._model_router = model_router
        self._agent = agent
        self._workspace_manager = workspace_manager
        self._scheduler = scheduler
        self._pipeline_executor = pipeline_executor
        self._complexity_gate = complexity_gate
        self._task: Optional[asyncio.Task] = None
        self._state = "stopped"  # stopped | idle | running
        self._active_job_id: Optional[str] = None

    @property
    def state(self) -> str:
        return self._state

    @property
    def active_job_id(self) -> Optional[str]:
        return self._active_job_id

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.create_task(self._run(), name="job-worker")

    async def stop(self) -> None:
        self._state = "stopped"
        self._active_job_id = None
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        while True:
            self._state = "idle"
            job_id = await self._queue.dequeue()
            await self._process(job_id)

    async def _process(self, job_id: str) -> None:
        job = await self._manager.get_job_for_worker(job_id)
        if job is None:
            return
        if job.status == JobStatus.CANCELLED:
            logger.info(
                "job_cancelled",
                extra={
                    "event": "job_cancelled",
                    "job_id": job_id,
                    "user_id": job.user_id,
                    "status": JobStatus.CANCELLED.value,
                },
            )
            return

        self._state = "running"
        self._active_job_id = job_id
        agent_result = None
        try:
            classification = self._task_router.classify(job.message)
            logger.info(
                "task_classified",
                extra={
                    "event": "task_classified",
                    "job_id": job_id,
                    "user_id": job.user_id,
                    "task_type": classification.task_type,
                    "reason": classification.reason,
                },
            )
            await self._manager.update_job(
                job_id,
                task_type=classification.task_type,
            )

            routing = self._model_router.resolve(
                classification.task_type, classification.reason
            )
            logger.info(
                "model_selected",
                extra={
                    "event": "model_selected",
                    "job_id": job_id,
                    "user_id": job.user_id,
                    "task_type": routing.task_type,
                    "model": routing.model,
                },
            )
            await self._manager.update_job(
                job_id,
                model=routing.model,
            )
            job = await self._manager.get_job_for_worker(job_id)
            if job is None or job.status == JobStatus.CANCELLED:
                return

            decision = await self._request_resources(job, routing)
            if decision is None:
                return  # rejected or cancelled while waiting for resources

            resource_status = "allocated" if decision.allocation else "not_required"
            await self._manager.update_job(
                job_id,
                status=JobStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                resource_status=resource_status,
            )
            current = await self._manager.get_job_for_worker(job_id)
            if current is not None and current.status == JobStatus.CANCELLED:
                logger.info(
                    "job_cancelled",
                    extra={
                        "event": "job_cancelled",
                        "job_id": job_id,
                        "user_id": job.user_id,
                        "status": JobStatus.CANCELLED.value,
                    },
                )
                return

            logger.info(
                "job_started",
                extra={
                    "event": "job_started",
                    "job_id": job_id,
                    "user_id": job.user_id,
                    "status": JobStatus.RUNNING.value,
                    "task_type": routing.task_type,
                    "model": routing.model,
                },
            )

            workspace = await self._workspace_manager.create_workspace(
                job.user_id, job_id
            )
            use_pipeline = bool(
                self._pipeline_executor is not None
                and self._complexity_gate is not None
                and self._complexity_gate.should_pipeline(
                    classification.task_type, job.message
                )
            )
            if use_pipeline:
                logger.info(
                    "pipeline_started",
                    extra={
                        "event": "pipeline_started",
                        "job_id": job_id,
                        "user_id": job.user_id,
                        "task_type": classification.task_type,
                        "lead_model": routing.model,
                    },
                )
                agent_result = await self._pipeline_executor.execute(
                    job, workspace, classification.task_type, routing.model
                )
            else:
                agent_result = await self._agent.run(
                    job=job, model=routing.model, workspace=workspace
                )
        except ModelRoutingError as exc:
            logger.error(
                "routing_failure",
                extra={
                    "event": "routing_failure",
                    "job_id": job_id,
                    "user_id": job.user_id,
                    "status": JobStatus.FAILED.value,
                    "error": str(exc),
                },
            )
            await self._fail(job, error=f"model_routing_error: {exc}")
        except OllamaServiceError as exc:
            await self._fail(job, error=f"{exc.__class__.__name__}: {exc}")
        except Exception as exc:  # catch-all: unexpected worker/backend failure
            logger.exception(
                "worker_unexpected_error",
                extra={"event": "job_failed", "job_id": job_id, "user_id": job.user_id},
            )
            await self._fail(job, error=f"internal_error: {exc.__class__.__name__}")
        else:
            await self._finish_agent_job(job, agent_result)
        finally:
            await self._release_resources(job_id)
            self._active_job_id = None
            self._state = "idle"

    async def _request_resources(self, job: Job, routing) -> Optional[object]:
        """Request resources until granted, rejected, or the job is cancelled.

        Returns the scheduler decision on grant, or ``None`` when the job was
        rejected (impossible request) or cancelled while waiting.
        """
        while True:
            decision = await self._scheduler.request(
                job.job_id, job.user_id, routing.model, routing.requirements
            )
            if decision.decision == "grant":
                return decision
            if decision.decision == "reject":
                await self._manager.update_job(job.job_id, resource_status="rejected")
                await self._fail(job, error=f"resource_rejected: {decision.reason}")
                return None

            await self._manager.update_job(job.job_id, resource_status="waiting")
            await self._scheduler.wait_until_available(timeout=1.0)
            current = await self._manager.get_job_for_worker(job.job_id)
            if current is None or current.status == JobStatus.CANCELLED:
                await self._scheduler.cancel(job.job_id)
                logger.info(
                    "job_cancelled",
                    extra={
                        "event": "job_cancelled",
                        "job_id": job.job_id,
                        "user_id": job.user_id,
                        "status": JobStatus.CANCELLED.value,
                    },
                )
                return None

    async def _release_resources(self, job_id: str) -> None:
        try:
            allocation = await self._scheduler.release(job_id)
            if allocation is not None:
                await self._manager.update_job(job_id, resource_status="released")
        except Exception:
            logger.exception(
                "worker_resource_release_error",
                extra={"event": "resource_released", "job_id": job_id},
            )
        # Release any sub-allocations held by this job (e.g. the vision model
        # allocation under ``<job_id>:vision``), so a cancelled job never leaks.
        try:
            for allocation in self._scheduler.provider().allocated():
                if allocation.job_id.startswith(f"{job_id}:"):
                    await self._scheduler.release(allocation.job_id)
        except Exception:
            logger.exception(
                "worker_subresource_release_error",
                extra={"event": "resource_released", "job_id": job_id},
            )

    async def _finish_agent_job(self, job: Job, agent_result: Optional[AgentStatus]) -> None:
        """Apply the agent outcome to the job. Job lifecycle stays in the worker."""
        if agent_result is None:
            await self._fail(job, error="internal_error: agent produced no result")
            return

        current = await self._manager.get_job_for_worker(job.job_id)
        if current is not None and current.status == JobStatus.CANCELLED:
            return  # cancelled while the agent was finishing; do not resurrect it

        if agent_result.status == AgentStatus.CANCELLED:
            await self._manager.update_job(
                job.job_id,
                status=JobStatus.CANCELLED,
                completed_at=datetime.now(timezone.utc),
                agent_stage="cancelled",
            )
            return

        if agent_result.status == AgentStatus.FAILED:
            await self._fail(job, error=agent_result.error or "agent_failed")
            return

        await self._manager.update_job(
            job.job_id,
            status=JobStatus.COMPLETED,
            completed_at=datetime.now(timezone.utc),
            response=agent_result.response,
            agent_stage="completed",
        )
        logger.info(
            "job_completed",
            extra={
                "event": "job_completed",
                "job_id": job.job_id,
                "user_id": job.user_id,
                "status": JobStatus.COMPLETED.value,
                "task_type": job.task_type,
                "model": job.model,
            },
        )

    async def _fail(self, job: Job, error: str) -> None:
        try:
            await self._manager.update_job(
                job.job_id,
                status=JobStatus.FAILED,
                completed_at=datetime.now(timezone.utc),
                error=error[:2000],
            )
        except Exception:
            logger.exception(
                "worker_store_error",
                extra={"event": "job_failed", "job_id": job.job_id, "user_id": job.user_id},
            )
            return
        logger.error(
            "job_failed",
            extra={
                "event": "job_failed",
                "job_id": job.job_id,
                "user_id": job.user_id,
                "status": JobStatus.FAILED.value,
            },
        )
