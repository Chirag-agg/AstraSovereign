"""Maps a classified task type to a configured, enabled model."""

import logging

from pydantic import BaseModel

from app.schemas.resources import ResourceRequirements
from app.services.model_registry import ModelRegistry

logger = logging.getLogger("app.model_router")


class RoutingResult(BaseModel):
    """The selected model for a classified task."""

    task_type: str
    provider: str
    model: str
    reason: str
    requirements: ResourceRequirements = ResourceRequirements()


class ModelRoutingError(Exception):
    """No usable (configured and enabled) model exists for the task type."""


class ModelRouter:
    """Resolve ``task_type -> configured enabled model`` from the registry."""

    def __init__(self, registry: ModelRegistry) -> None:
        self._registry = registry

    def resolve(self, task_type: str, reason: str = "") -> RoutingResult:
        config = self._registry.get(task_type)
        if config is None:
            raise ModelRoutingError(
                f"No model configured for task type '{task_type}'."
            )
        if not config.enabled:
            raise ModelRoutingError(
                f"Model for task type '{task_type}' is disabled."
            )
        return RoutingResult(
            task_type=task_type,
            provider=config.provider,
            model=config.model,
            reason=reason,
            requirements=config.resources,
        )
