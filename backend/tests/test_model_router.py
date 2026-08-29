"""Unit tests for ModelRouter and ModelRegistry."""

import pytest

from app.services.model_registry import (
    ModelConfig,
    ModelConfigError,
    ModelRegistry,
)
from app.services.model_router import ModelRouter, ModelRoutingError


def _registry(models: dict[str, ModelConfig]) -> ModelRegistry:
    return ModelRegistry(models=models)


def _sample_registry() -> ModelRegistry:
    return _registry(
        {
            "general": ModelConfig(model="general-model", enabled=True),
            "coding": ModelConfig(model="coder-model", enabled=True),
            "document": ModelConfig(model="doc-model", enabled=False),
        }
    )


def test_resolve_selects_configured_model():
    router = ModelRouter(_sample_registry())
    result = router.resolve("coding", "Programming intent detected")
    assert result.task_type == "coding"
    assert result.model == "coder-model"
    assert result.provider == "ollama"
    assert result.reason == "Programming intent detected"


def test_resolve_uses_configuration_not_hardcoded_names():
    registry = _registry({"general": ModelConfig(model="llama3.1:latest", enabled=True)})
    result = ModelRouter(registry).resolve("general")
    assert result.model == "llama3.1:latest"


def test_disabled_model_cannot_be_selected():
    router = ModelRouter(_sample_registry())
    with pytest.raises(ModelRoutingError, match="disabled"):
        router.resolve("document")


def test_missing_task_type_raises():
    router = ModelRouter(_sample_registry())
    with pytest.raises(ModelRoutingError, match="No model configured"):
        router.resolve("vision")


def test_availability_flags():
    registry = _sample_registry()
    availability = registry.availability({"coder-model"})
    assert availability["general"] == {
        "configured": "general-model",
        "available": False,
        "enabled": True,
    }
    assert availability["coding"] == {
        "configured": "coder-model",
        "available": True,
        "enabled": True,
    }
    assert availability["document"]["available"] is False
    assert availability["document"]["enabled"] is False


def test_availability_empty_set_means_nothing_available():
    registry = _sample_registry()
    availability = registry.availability(set())
    assert all(not m["available"] for m in availability.values())


def test_registry_from_file_valid(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text(
        "models:\n"
        "  general:\n"
        "    provider: ollama\n"
        "    model: some-model\n"
        "    enabled: true\n"
        "    capabilities:\n"
        "      - general\n"
        "  coding:\n"
        "    provider: ollama\n"
        "    model: coder-model\n"
        "    enabled: false\n"
    )
    registry = ModelRegistry.from_file(config_file)
    assert registry.task_types() == ["coding", "general"]
    assert registry.get("general").model == "some-model"


def test_registry_from_file_missing(tmp_path):
    with pytest.raises(ModelConfigError, match="not found"):
        ModelRegistry.from_file(tmp_path / "missing.yaml")


def test_registry_from_file_invalid_yaml(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text("models: [unclosed\n  - x\n")
    with pytest.raises(ModelConfigError, match="Invalid YAML"):
        ModelRegistry.from_file(config_file)


def test_registry_from_file_unsupported_provider(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text(
        "models:\n"
        "  general:\n"
        "    provider: openai\n"
        "    model: gpt\n"
        "    enabled: true\n"
    )
    with pytest.raises(ModelConfigError, match="unsupported provider"):
        ModelRegistry.from_file(config_file)


def test_registry_from_file_missing_models_key(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text("something: else\n")
    with pytest.raises(ModelConfigError, match="models"):
        ModelRegistry.from_file(config_file)
