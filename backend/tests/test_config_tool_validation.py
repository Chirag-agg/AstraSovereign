"""Config-load guard: a tool-invoking capability may not use a tools:false model."""

import pytest

from app.services.model_registry import ModelConfig, ModelConfigError, ModelRegistry


def test_tool_incapable_model_assigned_to_tool_capability_is_rejected():
    models = {
        "coding": ModelConfig(
            provider="ollama", model="weak:3b", enabled=True, capabilities=["coding"]
        )
    }
    capabilities = {"weak:3b": {"capabilities": ["coding"], "tools": False}}
    with pytest.raises(ModelConfigError, match="tools: false"):
        ModelRegistry(models=models, model_capabilities=capabilities)


def test_tool_capable_model_is_allowed():
    models = {
        "coding": ModelConfig(
            provider="ollama", model="good:8b", enabled=True, capabilities=["coding"]
        )
    }
    capabilities = {"good:8b": {"capabilities": ["coding"], "tools": True}}
    ModelRegistry(models=models, model_capabilities=capabilities)  # must not raise


def test_disabled_entry_is_not_checked():
    models = {
        "math": ModelConfig(
            provider="ollama",
            model="weak:3b",
            enabled=False,
            capabilities=["math"],
        )
    }
    capabilities = {"weak:3b": {"capabilities": ["math"], "tools": False}}
    ModelRegistry(models=models, model_capabilities=capabilities)  # disabled -> ok


def test_vision_capability_does_not_require_tools():
    models = {
        "vision": ModelConfig(
            provider="ollama", model="llava:7b", enabled=True, capabilities=["vision", "image"]
        )
    }
    capabilities = {"llava:7b": {"capabilities": ["vision", "image"], "tools": False}}
    ModelRegistry(models=models, model_capabilities=capabilities)  # not tool-invoking
