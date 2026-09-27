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
from app.services.attachments import build_attachment_manifest
from app.services.job_manager import JobManager
from app.services.job_queue import JobQueue
from app.services.capability_classifier import SemanticCapabilityClassifier
from app.services.ollama_service import OllamaService, OllamaServiceError
from app.services.plan_defaults import resolve
from app.services.context import ContextManager
from app.services.projects import CoworkProjects, ProjectLocks, ProjectNotFoundError
from app.services.resource_scheduler import ResourceScheduler
from app.services.workspace import WorkspaceManager

logger = logging.getLogger("app.worker")


class Worker:
    def __init__(
        self,
        queue: JobQueue,
        manager: JobManager,
        ollama: OllamaService,
        classifier: SemanticCapabilityClassifier,
        agent: Agent,
        workspace_manager: WorkspaceManager,
        scheduler: ResourceScheduler,
        node_agent: Optional[object] = None,
        knowledge_base: Optional[object] = None,
        projects: Optional[CoworkProjects] = None,
        project_locks: Optional[ProjectLocks] = None,
        context_manager: Optional[ContextManager] = None,
        planner: Optional[object] = None,
    ) -> None:
        self._queue = queue
        self._manager = manager
        self._ollama = ollama
        self._classifier = classifier
        self._agent = agent
        self._workspace_manager = workspace_manager
        self._scheduler = scheduler
        self._node_agent = node_agent
        self._knowledge_base = knowledge_base
        self._projects = projects
        self._project_locks = project_locks
        self._context_manager = context_manager
        # Optional PlanFiller (duck-typed: anything with
        # `async fill(task, plan) -> JobPlan`). None is the default path — the
        # plan is then the deterministic layer plus defaults, byte-identical to
        # the behaviour before the model layer existed.
        self._planner = planner
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
        project_lock_held = False
        project_dir: Optional[object] = None
        try:
            classification = await self._classifier.classify(job.message)
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

            # Model selection is per node inside the node sequence; the worker
            # only records the classified task type. Per-node resource
            # reservation and the MODEL_SELECTED/MODEL_FALLBACK audit happen in
            # the node sequence.
            await self._manager.update_job(
                job_id,
                status=JobStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                resource_status="not_required",
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
            # Re-read so the node sequence sees the classified task_type.
            job = current or job

            logger.info(
                "job_started",
                extra={
                    "event": "job_started",
                    "job_id": job_id,
                    "user_id": job.user_id,
                    "status": JobStatus.RUNNING.value,
                    "task_type": classification.task_type,
                },
            )

            if job.project_id:
                if self._projects is None or self._project_locks is None:
                    raise RuntimeError("Cowork project support is not configured")
                if not self._projects.owns(job.user_id, job.project_id):
                    await self._fail(job, error=f"project_not_found: {job.project_id}")
                    return
                project_dir = self._projects.ensure_dir(job.user_id, job.project_id)
                project_lock_held = self._project_locks.acquire(job.user_id, job.project_id)
                workspace = project_dir
            else:
                workspace = await self._workspace_manager.create_workspace(
                    job.user_id, job_id
                )
            task_text = job.message
            if job.project_id and self._context_manager is not None and self._projects is not None:
                task_text = self._context_manager.build_request(
                    job.user_id, job.project_id, job.message
                )
            # The one place the request is interpreted. Built from the final task
            # text so a cowork project's context counts, then handed to the node
            # sequence, which reads its activation and tool contracts from it
            # rather than matching request text itself. Layers run in order —
            # deterministic, then the optional model fill over the fields still
            # unset, then defaults for whatever is left. The model never sees a
            # settled field as a question and cannot overwrite one (fill's merge
            # is escalation-only); with the planner off, this is exactly the
            # deterministic plan plus defaults.
            plan = resolve(task_text, classification.task_type)
            if self._planner is not None:
                plan = await self._planner.fill(task_text, plan)
            plan = plan.with_defaults()
            logger.info(
                "plan_resolved",
                extra={
                    "event": "plan_resolved",
                    "job_id": job_id,
                    "user_id": job.user_id,
                    "capability": plan.capability,
                    "deliverable": plan.deliverable,
                    "length_words": plan.length_words,
                    "sources": {k: v.value for k, v in plan.sources.items()},
                    "source_counts": plan.source_counts(),
                },
            )
            if plan.disagreements:
                logger.info(
                    "plan_disagreement",
                    extra={
                        "event": "plan_disagreement",
                        "job_id": job_id,
                        "user_id": job.user_id,
                        "disagreements": plan.disagreements,
                    },
                )
            if self._node_agent is not None:
                manifest = await self._attachment_manifest(job)
                agent_result = await self._node_agent.run(
                    job, workspace, task_text=task_text, attachments=manifest,
                    job_plan=plan,
                )
            else:
                agent_result = await self._agent.run(
                    job=job,
                    model=self._ollama.default_model,
                    workspace=workspace,
                    task_text=task_text,
                )
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
            if project_lock_held and job.project_id and self._project_locks is not None:
                self._project_locks.release(job.user_id, job.project_id)
            if job.project_id and self._context_manager is not None and self._projects is not None:
                try:
                    current = await self._manager.get_job_for_worker(job_id)
                    if current is not None and current.status in (
                        JobStatus.COMPLETED,
                        JobStatus.FAILED,
                        JobStatus.CANCELLED,
                    ):
                        if current.status == JobStatus.COMPLETED:
                            message_text = current.response or "Completed."
                        else:
                            message_text = f"Task {current.status.value}: {current.error or ''}"
                        self._context_manager.add_assistant_message(
                            current.user_id, current.project_id, message_text
                        )
                        files_touched = []
                        for entry in current.execution_trace or []:
                            if entry.get("type") == "tool_call" and entry.get("tool") == "write_file":
                                args = entry.get("arguments")
                                if isinstance(args, dict) and args.get("path"):
                                    files_touched.append(str(args["path"]))
                        self._context_manager.add_execution_summary(
                            current.user_id,
                            current.project_id,
                            current.job_id,
                            model=current.model,
                            summary=message_text[:600],
                            files_touched=files_touched,
                        )
                except Exception:
                    logger.exception(
                        "worker_context_record_error",
                        extra={"event": "job_failed", "job_id": job_id, "user_id": job.user_id},
                    )
            self._active_job_id = None
            self._state = "idle"

    async def _attachment_manifest(self, job: Job) -> list[dict]:
        """Job-scoped attachments: only the documents named on the job.

        Never the user's whole library — that flooded the node input with 65
        documents and dwarfed the instruction. The pictures inside an attached
        container come along with it, since they are only reachable through it.
        """
        if self._knowledge_base is None or not job.document_ids:
            return []
        documents = await self._knowledge_base.list_documents(job.user_id)
        wanted = set(job.document_ids)
        selected = [document for document in documents if document.document_id in wanted]
        # The pictures inside an attached container are documents of their own;
        # listing them beside their container is what lets the model name one as
        # a figure in a deliverable.
        selected = await self._knowledge_base.with_embedded_images(job.user_id, selected)

        def lookup(document) -> Optional[str]:
            extraction = self._knowledge_base.get_extraction(
                job.user_id, document.document_id
            )
            return extraction.markdown if extraction is not None else None

        return build_attachment_manifest(selected, extraction_lookup=lookup)

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
