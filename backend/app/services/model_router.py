"""Maps a classified task type to a configured, enabled model.

When availability is known and fallback is enabled, resolution follows the
entry's declared ``fallback_to`` chain (never an arbitrary model). The decision
carries the candidate set so a future policy engine can filter it without
reshaping the type.
"""

import logging
from typing import Optional

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
    # Candidate set considered for this decision (primary first, then the
    # declared fallback chain). The policy engine will filter this later.
    candidates: list[str] = []
    requested_model: Optional[str] = None
    fallback_active: bool = False


class ModelRoutingError(Exception):
    """No usable (configured and enabled) model exists for the task type."""


class ModelRouter:
    """Resolve ``task_type -> configured enabled model`` from the registry."""

    def __init__(self, registry: ModelRegistry) -> None:
        self._registry = registry

    def resolve(
        self,
        task_type: str,
        reason: str = "",
        available_models: Optional[set[str]] = None,
        fallback_enabled: bool = True,
    ) -> RoutingResult:
        config = self._registry.get(task_type)
        if config is None:
            raise ModelRoutingError(
                f"No model configured for task type '{task_type}'."
            )
        if not config.enabled:
            raise ModelRoutingError(
                f"Model for task type '{task_type}' is disabled."
            )

        candidates = self._registry.candidates(task_type)
        effective = config.model
        fallback_active = False

        # Availability-aware substitution happens only when this entry declares
        # a fallback chain. Without a chain there is nothing to substitute, so
        # routing keeps the configured model and any unavailability surfaces at
        # the model call (and in startup preflight) as before.
        if available_models is not None and fallback_enabled and config.fallback_to:
            available = set(available_models)
            effective = next((m for m in candidates if m in available), None)
            if effective is None:
                raise ModelRoutingError(
                    f"No available local model for task type '{task_type}' "
                    f"(configured '{config.model}'; tried {', '.join(candidates)})."
                )
            fallback_active = effective != config.model

        return RoutingResult(
            task_type=task_type,
            provider=config.provider,
            model=effective,
            reason=reason,
            requirements=config.resources,
            candidates=candidates,
            requested_model=config.model,
            fallback_active=fallback_active,
        )
