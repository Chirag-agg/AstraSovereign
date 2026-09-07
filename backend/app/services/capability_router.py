"""Capability-based model resolution for multi-model pipeline stages.

The worker's primary ``ModelRouter`` answers ``task_type -> model``. This router
answers ``capability -> model`` for pipeline stages, with an explicit fallback
chain: an enabled model that declares the capability, then the ``general``
model, then any enabled model. It never hardcodes a model name.
"""

import logging

from pydantic import BaseModel

from app.schemas.resources import ResourceRequirements
from app.services.model_registry import ModelConfig, ModelRegistry

logger = logging.getLogger("app.capability_router")


class CapabilityResult(BaseModel):
    """The selected model for one pipeline stage capability."""

    capability: str
    provider: str
    model: str
    requirements: ResourceRequirements = ResourceRequirements()


class CapabilityRoutingError(Exception):
    """No usable (configured and enabled) local model exists for a capability."""


class CapabilityRouter:
    """Resolve ``capability -> configured enabled model`` from the registry."""

    def __init__(self, registry: ModelRegistry) -> None:
        self._registry = registry

    def resolve(self, capability: str) -> CapabilityResult:
        matches = self._registry.by_capability(capability)
        if matches:
            chosen = matches[0]
            return self._result(capability, chosen)

        general = self._registry.get("general")
        if general is not None and general.enabled:
            return self._result(capability, general)

        for config in self._registry.task_types():
            entry = self._registry.get(config)
            if entry is not None and entry.enabled:
                return self._result(capability, entry)

        raise CapabilityRoutingError(
            f"Pipeline unavailable: no enabled local model can serve capability '{capability}'."
        )

    @staticmethod
    def _result(capability: str, config: ModelConfig) -> CapabilityResult:
        return CapabilityResult(
            capability=capability,
            provider=config.provider,
            model=config.model,
            requirements=config.resources,
        )
