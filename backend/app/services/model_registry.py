"""Configuration-driven model registry.

Loads ``config/models.yaml`` and exposes typed model entries. Model names come
only from configuration; routing logic never hardcodes a model name.
"""

import logging
from pathlib import Path
from typing import Optional, Union

import yaml
from pydantic import BaseModel, ValidationError

from app.schemas.resources import ResourceRequirements

logger = logging.getLogger("app.model_registry")

SUPPORTED_PROVIDERS = ("ollama",)


class ModelConfig(BaseModel):
    """A single configured model entry for one task type."""

    provider: str = "ollama"
    model: str
    enabled: bool = True
    capabilities: list[str] = []
    resources: ResourceRequirements = ResourceRequirements()


class ModelConfigError(Exception):
    """The models configuration file is missing or invalid."""


class ModelRegistry:
    """Holds validated model configuration keyed by task type."""

    def __init__(self, models: dict[str, ModelConfig]) -> None:
        self._models = dict(models)

    @classmethod
    def from_file(cls, path: Union[str, Path]) -> "ModelRegistry":
        """Load, parse, and validate the models configuration file."""
        config_path = Path(path)
        if not config_path.exists():
            raise ModelConfigError(f"Model config not found: {config_path}")

        try:
            with config_path.open("r", encoding="utf-8") as fh:
                raw = yaml.safe_load(fh) or {}
        except yaml.YAMLError as exc:
            raise ModelConfigError(f"Invalid YAML in {config_path}: {exc}") from exc

        raw_models = raw.get("models")
        if not isinstance(raw_models, dict):
            raise ModelConfigError(f"Expected a top-level 'models' mapping in {config_path}")

        models: dict[str, ModelConfig] = {}
        for task_type, entry in raw_models.items():
            if not isinstance(entry, dict):
                raise ModelConfigError(f"Entry for task type '{task_type}' must be a mapping")
            try:
                config = ModelConfig(**entry)
            except ValidationError as exc:
                raise ModelConfigError(
                    f"Invalid config for task type '{task_type}': {exc}"
                ) from exc
            if not config.model.strip():
                raise ModelConfigError(f"Task type '{task_type}' has an empty model name")
            if config.provider not in SUPPORTED_PROVIDERS:
                raise ModelConfigError(
                    f"Task type '{task_type}' uses unsupported provider '{config.provider}' "
                    f"(supported: {', '.join(SUPPORTED_PROVIDERS)})"
                )
            models[task_type] = config

        registry = cls(models=models)
        logger.info(
            "registry_loaded",
            extra={
                "event": "registry_loaded",
                "source": str(config_path),
                "task_types": sorted(models),
                "enabled": sorted(t for t, c in models.items() if c.enabled),
            },
        )
        return registry

    def get(self, task_type: str) -> Optional[ModelConfig]:
        return self._models.get(task_type)

    def task_types(self) -> list[str]:
        return sorted(self._models)

    def availability(self, available_models: Optional[set[str]]) -> dict[str, dict]:
        """Report per-task-type configured/enabled/available flags.

        ``available_models`` is the set of model names currently on the local
        Ollama server. A disabled entry is never ``available``.
        """
        available = set(available_models or set())
        return {
            task_type: {
                "configured": config.model,
                "available": config.enabled and config.model in available,
                "enabled": config.enabled,
            }
            for task_type, config in self._models.items()
        }
