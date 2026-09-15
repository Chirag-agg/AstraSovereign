"""Fallback-chain tests: capability floors, depth/cycle validation, routing
substitution, preflight resolution, and the MODEL_FALLBACK audit mapping."""

import pytest

from app.services.audit_store import EVENT_TYPE_MAP
from app.services.model_registry import (
    ModelConfig,
    ModelConfigError,
    ModelRegistry,
)
from app.services.model_router import ModelRouter, ModelRoutingError


def make_registry(models, capabilities):
    return ModelRegistry(models=models, model_capabilities=capabilities)


CAPS = {
    "coder-small": {"capabilities": ["coding", "debugging"], "tools": True},
    "general-big": {"capabilities": ["general", "summarization"], "tools": True},
    "no-tools": {"capabilities": ["coding"], "tools": False},
    "text-only": {"capabilities": ["general"], "tools": True},
}


def base_models():
    return {
        "coding": ModelConfig(model="coder-big", capabilities=["coding"], fallback_to=["coder-small"]),
        "general": ModelConfig(model="general-big", capabilities=["general"], fallback_to=[]),
    }


def test_valid_chain_resolves_to_fallback():
    registry = make_registry(base_models(), CAPS)
    router = ModelRouter(registry)

    decision = router.resolve(
        "coding", available_models={"coder-small"}, fallback_enabled=True
    )
    assert decision.model == "coder-small"
    assert decision.requested_model == "coder-big"
    assert decision.fallback_active is True
    assert decision.candidates == ["coder-big", "coder-small"]


def test_primary_available_uses_primary():
    router = ModelRouter(make_registry(base_models(), CAPS))
    decision = router.resolve("coding", available_models={"coder-big", "coder-small"})
    assert decision.model == "coder-big"
    assert decision.fallback_active is False


def test_fallback_disabled_ignores_availability():
    router = ModelRouter(make_registry(base_models(), CAPS))
    decision = router.resolve(
        "coding", available_models={"coder-small"}, fallback_enabled=False
    )
    assert decision.model == "coder-big"
    assert decision.fallback_active is False


def test_no_candidate_available_raises():
    router = ModelRouter(make_registry(base_models(), CAPS))
    with pytest.raises(ModelRoutingError, match="No available local model"):
        router.resolve("coding", available_models=set())


def test_capability_floor_is_enforced():
    models = {
        "math": ModelConfig(model="math-big", capabilities=["math"], fallback_to=["text-only"]),
    }
    with pytest.raises(ModelConfigError, match="lacks capability"):
        make_registry(models, CAPS)


def test_tool_support_floor_is_enforced():
    models = {
        "coding": ModelConfig(model="coder-big", capabilities=["coding"], fallback_to=["no-tools"]),
    }
    with pytest.raises(ModelConfigError, match="tool calling"):
        make_registry(models, CAPS)


def test_depth_limit_is_enforced():
    models = {
        "coding": ModelConfig(
            model="coder-big", capabilities=["coding"], fallback_to=["coder-small", "general-big", "text-only"]
        ),
    }
    with pytest.raises(ModelConfigError, match="max is 2"):
        make_registry(models, CAPS)


def test_self_reference_and_duplicates_rejected():
    with pytest.raises(ModelConfigError, match="own model"):
        make_registry(
            {"coding": ModelConfig(model="coder-big", capabilities=["coding"], fallback_to=["coder-big"])},
            CAPS,
        )
    with pytest.raises(ModelConfigError, match="duplicates"):
        make_registry(
            {
                "coding": ModelConfig(
                    model="coder-big", capabilities=["coding"], fallback_to=["coder-small", "coder-small"]
                )
            },
            CAPS,
        )


def test_unknown_fallback_target_rejected():
    with pytest.raises(ModelConfigError, match="not declared"):
        make_registry(
            {"coding": ModelConfig(model="coder-big", capabilities=["coding"], fallback_to=["who-knows"])},
            CAPS,
        )


def test_resolved_availability_reports_substitutions():
    registry = make_registry(base_models(), CAPS)
    resolved = registry.resolved_availability({"coder-small", "general-big"}, fallback_enabled=True)
    assert resolved["coding"]["configured"] == "coder-big"
    assert resolved["coding"]["effective"] == "coder-small"
    assert resolved["coding"]["fallback_active"] is True
    # general's primary is available -> no substitution
    assert resolved["general"]["effective"] == "general-big"
    assert resolved["general"]["fallback_active"] is False


def test_resolved_availability_empty_chain_fails_cleanly():
    models = {
        "vision": ModelConfig(model="vision-only", capabilities=["vision"], fallback_to=[]),
    }
    registry = make_registry(models, {"vision-only": {"capabilities": ["vision"], "tools": True}})
    resolved = registry.resolved_availability(set(), fallback_enabled=True)
    assert resolved["vision"]["effective"] is None
    assert resolved["vision"]["fallback_active"] is False


def test_model_fallback_audit_mapping():
    assert EVENT_TYPE_MAP.get("model_fallback") == "MODEL_FALLBACK"
