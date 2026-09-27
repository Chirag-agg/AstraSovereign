"""Configuration-driven model registry.

Loads ``config/models.yaml`` and exposes typed model entries. Model names come
only from configuration; routing logic never hardcodes a model name.

Fallback chains (``fallback_to``) are declared per entry and validated at load:

- at most two hops, no cycles, and never the primary model itself;
- every fallback target must satisfy the entry's declared capabilities and
  support tool calling (a text-only model must never silently serve a vision or
  agent/ tool task);
- an invalid chain refuses startup instead of surprising at routing time.
"""

import logging
from pathlib import Path
from typing import Optional, Union

import yaml
from pydantic import BaseModel, ValidationError

from app.schemas.resources import ResourceRequirements

logger = logging.getLogger("app.model_registry")

SUPPORTED_PROVIDERS = ("ollama",)
MAX_FALLBACK_DEPTH = 2

# Top-level keys that are themselves mappings keyed by name, so a profile
# restating one entry merges into the shared roster instead of replacing it.
_KEYED_MAPPINGS = ("models", "model_capabilities")


def _select_profile(
    raw: dict, profile: Optional[str], config_path: Path
) -> tuple[dict, str]:
    """Resolve the machine profile, returning (selected_block, profile_name).

    A file with no ``profiles`` key is returned unchanged and named "" — the
    shape every existing deployment and test uses. Otherwise ``profile`` (or the
    file's ``default_profile``) selects one roster; naming a profile that does
    not exist is a configuration error rather than a silent fall back to a
    default, because a wrong roster means a wrong model on the wrong hardware.

    A profile declares only what differs: everything it does not restate comes
    from the top level, so a roster shared by every machine is written once and
    a profile that changes one model's window does not repeat the other four.
    ``models`` and ``model_capabilities`` merge per key — a profile that
    restates `general` keeps every other entry rather than replacing the roster
    with the one entry it mentioned.
    """
    profiles = raw.get("profiles")
    if not isinstance(profiles, dict) or not profiles:
        return raw, ""

    name = (profile or raw.get("default_profile") or "").strip()
    if not name:
        raise ModelConfigError(
            f"{config_path.name} declares profiles but no default_profile; "
            f"set MODEL_PROFILE to one of: {', '.join(sorted(profiles))}"
        )
    if name not in profiles:
        raise ModelConfigError(
            f"Unknown model profile '{name}' in {config_path}; "
            f"available: {', '.join(sorted(profiles))}"
        )
    block = profiles[name]
    if not isinstance(block, dict):
        raise ModelConfigError(f"Profile '{name}' in {config_path} must be a mapping")
    merged = {key: value for key, value in raw.items() if key != "profiles"}
    for key, value in block.items():
        base = merged.get(key)
        if key in _KEYED_MAPPINGS and isinstance(value, dict) and isinstance(base, dict):
            merged[key] = {**base, **value}
        else:
            merged[key] = value
    return merged, name

# Capabilities whose assigned model runs the agent loop with the tools API. A
# model assigned to any of these MUST declare tools: true, or the backend refuses
# to start — otherwise a tool node degrades mid-demo instead of failing at config
# load. (The vision model is invoked *inside* document_vision, so "vision" is not
# here.)
TOOL_INVOKING_CAPABILITIES = frozenset(
    {"general", "reasoning", "math", "document", "coding", "debugging", "code_review"}
)


class ModelConfig(BaseModel):
    """A single configured model entry for one task type."""

    provider: str = "ollama"
    model: str
    enabled: bool = True
    capabilities: list[str] = []
    resources: ResourceRequirements = ResourceRequirements()
    fallback_to: list[str] = []
    # Per-model generation options, overriding the OLLAMA_NUM_CTX /
    # OLLAMA_NUM_PREDICT defaults. Set num_ctx where a model's KV cache is
    # unusually cheap (sliding-window attention) or unusually expensive, so the
    # window is sized to the model rather than to the weakest one.
    num_ctx: Optional[int] = None
    num_predict: Optional[int] = None


class ModelConfigError(Exception):
    """The models configuration file is missing or invalid."""


class ModelRegistry:
    """Holds validated model configuration keyed by task type."""

    def __init__(
        self,
        models: dict[str, ModelConfig],
        model_capabilities: Optional[dict[str, dict]] = None,
        profile: str = "",
    ) -> None:
        self._models = dict(models)
        self._model_capabilities = dict(model_capabilities or {})
        self._profile = profile
        self._validate_fallback_chains()
        self._validate_tool_capabilities()
        self._validate_model_options()

    @property
    def profile(self) -> str:
        """Name of the roster in use ("" when the file declares no profiles)."""
        return self._profile

    @classmethod
    def from_file(
        cls, path: Union[str, Path], profile: Optional[str] = None
    ) -> "ModelRegistry":
        """Load, parse, and validate the models configuration file.

        The file may declare named machine ``profiles`` (a dev laptop and the
        venue box have different silicon, and a roster tuned for one is wrong on
        the other); ``profile`` selects one, defaulting to the file's
        ``default_profile``. A file with a plain top-level ``models`` mapping —
        the shape every existing test and deployment uses — still loads, with an
        empty profile name.
        """
        config_path = Path(path)
        if not config_path.exists():
            raise ModelConfigError(f"Model config not found: {config_path}")

        try:
            with config_path.open("r", encoding="utf-8") as fh:
                raw = yaml.safe_load(fh) or {}
        except yaml.YAMLError as exc:
            raise ModelConfigError(f"Invalid YAML in {config_path}: {exc}") from exc

        raw, profile_name = _select_profile(raw, profile, config_path)

        raw_models = raw.get("models")
        if not isinstance(raw_models, dict):
            raise ModelConfigError(f"Expected a top-level 'models' mapping in {config_path}")

        # `model_capabilities` describes the models, not the host, so it is
        # declared once at the top level; a profile inherits it and may override.
        raw_capabilities = raw.get("model_capabilities") or {}
        if not isinstance(raw_capabilities, dict):
            raise ModelConfigError(
                f"Expected 'model_capabilities' to be a mapping in {config_path}"
            )
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

        registry = cls(
            models=models,
            model_capabilities=raw_capabilities,
            profile=profile_name,
        )
        logger.info(
            "registry_loaded",
            extra={
                "event": "registry_loaded",
                "source": str(config_path),
                "profile": profile_name,
                "task_types": sorted(models),
                "enabled": sorted(t for t, c in models.items() if c.enabled),
            },
        )
        return registry

    # ------------------------------------------------------------ capabilities

    def _capability_index(self) -> dict[str, dict]:
        """model name -> {capabilities, tools}; explicit config overrides derived."""
        index: dict[str, dict] = {}
        for config in self._models.values():
            index[config.model] = {
                "capabilities": list(config.capabilities),
                "tools": True,
            }
        for model, spec in self._model_capabilities.items():
            if not isinstance(spec, dict):
                continue
            index[model] = {
                "capabilities": list(spec.get("capabilities", [])),
                "tools": bool(spec.get("tools", True)),
            }
        return index

    def _validate_fallback_chains(self) -> None:
        index = self._capability_index()
        for task_type, config in self._models.items():
            chain = config.fallback_to
            if not chain:
                continue
            if len(chain) > MAX_FALLBACK_DEPTH:
                raise ModelConfigError(
                    f"'{task_type}' fallback_to has {len(chain)} hops; max is {MAX_FALLBACK_DEPTH}"
                )
            if len(set(chain)) != len(chain):
                raise ModelConfigError(f"'{task_type}' fallback_to contains duplicates")
            if config.model in chain:
                raise ModelConfigError(
                    f"'{task_type}' fallback_to must not include its own model '{config.model}'"
                )
            for target in chain:
                spec = index.get(target)
                if spec is None:
                    raise ModelConfigError(
                        f"'{task_type}' fallback target '{target}' is not declared "
                        "in model_capabilities or as another entry's model"
                    )
                missing = [c for c in config.capabilities if c not in spec["capabilities"]]
                if missing:
                    raise ModelConfigError(
                        f"'{task_type}' fallback target '{target}' lacks capability "
                        f"{missing} required by '{task_type}'"
                    )
                if not spec["tools"]:
                    raise ModelConfigError(
                        f"'{task_type}' fallback target '{target}' does not support tool calling"
                    )

    def _validate_tool_capabilities(self) -> None:
        """A model assigned to a tool-invoking capability must declare tools support.

        Checked at load: a model that declares ``tools: false`` (e.g. a
        code-completion model that emits calls as prose, or a vision model) must
        not be assigned to an agent capability, or every tool node degrades at
        run time instead of the misconfiguration failing at startup.
        """
        index = self._capability_index()
        for task_type, config in self._models.items():
            if not config.enabled:
                continue
            if not TOOL_INVOKING_CAPABILITIES.intersection(config.capabilities):
                continue
            spec = index.get(config.model)
            if spec is not None and not spec["tools"]:
                raise ModelConfigError(
                    f"'{task_type}' is assigned model '{config.model}', which is declared "
                    "tools: false, but the task needs tool calling. Assign a tool-capable "
                    "model or declare the model's tool support accurately."
                )

    def _validate_model_options(self) -> None:
        """Two entries sharing a model must agree on that model's options.

        Options are applied per *model*, not per entry, so ``document`` and
        ``vision`` both pointing at qwen3-vl with different ``num_ctx`` values
        would silently collapse to whichever entry was read last. Refusing at
        load makes the conflict visible instead of making one node quietly run a
        different window than the other.
        """
        seen: dict[str, tuple[str, dict]] = {}
        for task_type, config in self._models.items():
            declared = self._declared_options(config)
            prior = seen.get(config.model)
            if prior is None:
                seen[config.model] = (task_type, declared)
                continue
            prior_task, prior_declared = prior
            if declared != prior_declared:
                raise ModelConfigError(
                    f"'{task_type}' and '{prior_task}' both use model "
                    f"'{config.model}' but declare different generation options "
                    f"({prior_declared} vs {declared}); per-model options must "
                    "agree across every entry that shares the model"
                )

    @staticmethod
    def _declared_options(config: ModelConfig) -> dict:
        """Only the options an entry actually declares.

        Kept as one mapping so the load-time agreement check and the runtime
        ``model_options()`` map cannot drift apart.
        """
        declared: dict = {}
        if config.num_ctx is not None:
            declared["num_ctx"] = config.num_ctx
        if config.num_predict is not None:
            declared["num_predict"] = config.num_predict
        return declared

    def model_options(self) -> dict[str, dict]:
        """Per-model generation options, keyed by model name.

        Only the fields an entry actually declares appear, so the values here
        override the global defaults rather than restating them.
        """
        options: dict[str, dict] = {}
        for config in self._models.values():
            entry = self._declared_options(config)
            if entry:
                options[config.model] = entry
        return options

    def get(self, task_type: str) -> Optional[ModelConfig]:
        return self._models.get(task_type)
    def task_types(self) -> list[str]:
        return sorted(self._models)

    def by_capability(self, capability: str) -> list[ModelConfig]:
        """Enabled configs whose declared capabilities include ``capability``.

        Used by the multi-model pipeline to choose a stage model. The list is
        ordered by config file order; callers apply their own fallback policy.
        """
        return [c for c in self._models.values() if c.enabled and capability in c.capabilities]

    def candidates(self, task_type: str) -> list[str]:
        """The declared candidate set: primary first, then the fallback chain."""
        config = self._models.get(task_type)
        if config is None:
            return []
        return [config.model, *config.fallback_to]

    # ------------------------------------------------------------ availability

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

    def missing_models(self, available_models: Optional[set[str]]) -> list[dict]:
        """Enabled task types whose configured model is not pulled locally.

        Config-driven only; the backend never auto-pulls a model.
        """
        available = set(available_models or set())
        return [
            {"task_type": task_type, "model": config.model}
            for task_type, config in self._models.items()
            if config.enabled and config.model not in available
        ]

    def resolved_availability(
        self,
        available_models: Optional[set[str]],
        fallback_enabled: bool = True,
    ) -> dict[str, dict]:
        """Per-task-type resolved state, walking the declared fallback chains.

        Reports the effective model that would actually run, so substitutions are
        visible at startup/preflight rather than mid-job.
        """
        available = set(available_models or set())
        resolved: dict[str, dict] = {}
        for task_type, config in self._models.items():
            chain = [config.model, *config.fallback_to]
            if not config.enabled:
                resolved[task_type] = {
                    "configured": config.model,
                    "effective": None,
                    "available": False,
                    "enabled": False,
                    "fallback_active": False,
                    "chain": chain,
                }
                continue
            if fallback_enabled:
                effective = next((m for m in chain if m in available), None)
            else:
                effective = config.model if config.model in available else None
            resolved[task_type] = {
                "configured": config.model,
                "effective": effective,
                "available": config.model in available,
                "enabled": True,
                "fallback_active": effective is not None and effective != config.model,
                "chain": chain,
            }
        return resolved
