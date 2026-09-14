"""Capability-based model resolution — the single routing authority.

The node sequence asks this router for the model that serves a capability
(``document``/``coding``/``general``). Resolution walks the configured entry's
declared ``fallback_to`` chain when availability is known, and floors to the
``general`` model when the capability is missing, disabled, or its chain is
exhausted — so a disabled ``document`` model resolves to ``general`` with the
substitution recorded, instead of failing the job.

It never hardcodes a model name. ``ModelRouter`` (task-type based) is retired;
this router owns routing for both the node sequence and startup preflight.
"""

import logging
from typing import Optional

from pydantic import BaseModel

from app.schemas.resources import ResourceRequirements
from app.services.model_registry import ModelConfig, ModelRegistry

logger = logging.getLogger("app.capability_router")


class CapabilityResult(BaseModel):
    """The selected model for one capability (node or pipeline stage)."""

    capability: str
    provider: str
    model: str
    requirements: ResourceRequirements = ResourceRequirements()
    reason: str = ""
    # Candidate set considered (primary first, then the declared fallback chain).
    candidates: list[str] = []
    requested_model: Optional[str] = None
    fallback_active: bool = False


class CapabilityRoutingError(Exception):
    """No usable (configured and enabled) local model exists for a capability."""


class CapabilityRouter:
    """Resolve ``capability -> configured enabled model`` from the registry."""

    def __init__(self, registry: ModelRegistry) -> None:
        self._registry = registry

    def resolve(
        self,
        capability: str,
        available_models: Optional[set[str]] = None,
        fallback_enabled: bool = True,
    ) -> CapabilityResult:
        config = self._registry.get(capability)
        requested = config.model if config is not None else None
        candidates = self._registry.candidates(capability)

        if config is not None and config.enabled:
            effective = config.model
            fallback_active = False
            # Availability-aware substitution only when the entry declares a
            # chain; without a chain nothing can be substituted, so an
            # unavailable model surfaces at the model call as before.
            if available_models is not None and fallback_enabled and config.fallback_to:
                available = set(available_models)
                effective = next((m for m in candidates if m in available), None)
                if effective is None:
                    return self._floor(
                        capability,
                        requested,
                        candidates,
                        f"fallback chain exhausted for '{capability}'; using general",
                    )
                fallback_active = effective != config.model
            return CapabilityResult(
                capability=capability,
                provider=config.provider,
                model=effective,
                requirements=config.resources,
                reason=f"resolved for '{capability}'",
                candidates=candidates,
                requested_model=requested,
                fallback_active=fallback_active,
            )

        # Missing or disabled: the configured model cannot run, so floor to
        # general. This is the ``document -> disabled -> general`` case.
        state = "missing" if config is None else "disabled"
        return self._floor(
            capability,
            requested,
            candidates,
            f"'{capability}' is {state}; using general",
        )

    def _floor(
        self,
        capability: str,
        requested: Optional[str],
        candidates: list[str],
        reason: str,
    ) -> CapabilityResult:
        chosen = self._registry.get("general")
        if chosen is None or not chosen.enabled:
            chosen = next(
                (
                    entry
                    for task_type in self._registry.task_types()
                    if (entry := self._registry.get(task_type)) is not None and entry.enabled
                ),
                None,
            )
        if chosen is None:
            raise CapabilityRoutingError(
                f"Pipeline unavailable: no enabled local model can serve capability '{capability}'."
            )
        return CapabilityResult(
            capability=capability,
            provider=chosen.provider,
            model=chosen.model,
            requirements=chosen.resources,
            reason=reason,
            candidates=candidates,
            requested_model=requested,
            fallback_active=requested is None or chosen.model != requested,
        )
