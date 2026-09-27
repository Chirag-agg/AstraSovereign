"""Unit tests for CapabilityRouter and ModelRegistry."""

import pytest

from app.services.capability_router import CapabilityRouter
from app.services.model_registry import (
    ModelConfig,
    ModelConfigError,
    ModelRegistry,
)


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
    result = CapabilityRouter(_sample_registry()).resolve("coding")
    assert result.capability == "coding"
    assert result.model == "coder-model"
    assert result.provider == "ollama"


def test_resolve_uses_configuration_not_hardcoded_names():
    registry = _registry({"general": ModelConfig(model="llama3.1:latest", enabled=True)})
    assert CapabilityRouter(registry).resolve("general").model == "llama3.1:latest"


def test_disabled_capability_floors_to_general():
    result = CapabilityRouter(_sample_registry()).resolve("document")
    assert result.model == "general-model"
    assert result.requested_model == "doc-model"
    assert result.fallback_active is True


def test_missing_capability_floors_to_general():
    result = CapabilityRouter(_sample_registry()).resolve("vision")
    assert result.model == "general-model"
    assert result.requested_model is None
    assert result.fallback_active is True


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


# --------------------------------------------------------------------------
# Per-model generation options and machine profiles
# --------------------------------------------------------------------------


def test_num_ctx_and_num_predict_default_to_none():
    config = ModelConfig(model="m")
    assert config.num_ctx is None
    assert config.num_predict is None


def test_model_options_reports_only_what_an_entry_declares():
    registry = _registry(
        {
            "general": ModelConfig(model="wide", num_ctx=32768),
            "coding": ModelConfig(model="narrow", num_ctx=8192, num_predict=1024),
            "math": ModelConfig(model="plain"),
        }
    )
    assert registry.model_options() == {
        "wide": {"num_ctx": 32768},
        "narrow": {"num_ctx": 8192, "num_predict": 1024},
    }


def test_two_entries_sharing_a_model_must_agree_on_its_options():
    """Options apply per model, so a disagreement would silently pick one."""
    with pytest.raises(ModelConfigError, match="must agree"):
        _registry(
            {
                "document": ModelConfig(model="same", num_ctx=8192),
                "vision": ModelConfig(model="same", num_ctx=16384),
            }
        )


def test_two_entries_sharing_a_model_with_equal_options_are_fine():
    registry = _registry(
        {
            "document": ModelConfig(model="same", num_ctx=8192),
            "vision": ModelConfig(model="same", num_ctx=8192),
        }
    )
    assert registry.model_options() == {"same": {"num_ctx": 8192}}


_PROFILE_YAML = (
    "models:\n"
    "  general:\n"
    "    model: gpt-oss:20b\n"
    "    enabled: true\n"
    "    num_ctx: 16384\n"
    "  coding:\n"
    "    model: devstral:24b\n"
    "    enabled: true\n"
    "model_capabilities:\n"
    "  gpt-oss:20b:\n"
    "    capabilities: [general]\n"
    "    tools: true\n"
    "  devstral:24b:\n"
    "    capabilities: [coding]\n"
    "    tools: true\n"
    "default_profile: laptop\n"
    "profiles:\n"
    "  laptop: {}\n"
    "  venue:\n"
    "    models:\n"
    "      general:\n"
    "        model: gpt-oss:20b\n"
    "        enabled: true\n"
    "        num_ctx: 32768\n"
)


def test_profile_defaults_to_default_profile_and_inherits_unrestated_entries(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text(_PROFILE_YAML)
    registry = ModelRegistry.from_file(config_file)

    assert registry.profile == "laptop"
    assert registry.get("general").num_ctx == 16384
    # `coding` is not restated by any profile, so the top-level roster supplies it.
    assert registry.get("coding").model == "devstral:24b"


def test_a_profile_overrides_only_the_entries_it_restates(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text(_PROFILE_YAML)
    registry = ModelRegistry.from_file(config_file, profile="venue")

    assert registry.profile == "venue"
    assert registry.get("general").num_ctx == 32768
    assert registry.get("coding").model == "devstral:24b"


def test_an_unknown_profile_refuses_to_load(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text(_PROFILE_YAML)
    with pytest.raises(ModelConfigError, match="Unknown model profile"):
        ModelRegistry.from_file(config_file, profile="nope")


def test_a_file_without_profiles_still_loads_with_an_empty_name(tmp_path):
    config_file = tmp_path / "models.yaml"
    config_file.write_text(
        "models:\n"
        "  general:\n"
        "    model: gpt-oss:20b\n"
        "    enabled: true\n"
        "    num_ctx: 32768\n"
    )
    registry = ModelRegistry.from_file(config_file)

    assert registry.profile == ""
    assert registry.get("general").num_ctx == 32768


def test_shipped_config_loads_every_profile():
    """The real config/models.yaml must stay loadable in each of its rosters."""
    from pathlib import Path

    shipped = Path(__file__).resolve().parents[2] / "config" / "models.yaml"
    default = ModelRegistry.from_file(shipped)
    assert default.profile
    assert default.model_options()
    for name in ("dev-laptop", "venue-box"):
        assert ModelRegistry.from_file(shipped, profile=name).profile == name
