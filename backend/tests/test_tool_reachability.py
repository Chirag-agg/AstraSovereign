"""Static tool reachability: per node set, node input or a same-set producer."""

from pathlib import Path

import pytest

from app.services.nodes import NODE_INPUT_NODES, NODE_TOOLS
from app.services.tool_config import ToolConfigError, validate_node_tools
from app.services.tool_registry import ToolRegistry
from app.services.tools import BaseTool, DocumentVisionTool, ToolResult


class StubTool(BaseTool):
    def __init__(self, name: str) -> None:
        self.name = name
        self.description = name
        self.input_schema = {"type": "object", "properties": {}}

    async def execute(self, workspace: Path, arguments: dict) -> ToolResult:
        return ToolResult(ok=True, summary="stub")


def stub_registry(*names: str) -> ToolRegistry:
    return ToolRegistry([StubTool(name) for name in names])


def test_document_vision_declares_its_document_id_sources():
    assert DocumentVisionTool.required_sources["document_id"] == {
        "node_input",
        "document_search",
    }


def test_current_shipped_configuration_passes():
    # Real vision tool declaration + stubs for the rest; the shipped node sets
    # and node-input nodes are what is under test.
    names = set().union(*NODE_TOOLS.values())
    tools = [DocumentVisionTool(None)] + [
        StubTool(name) for name in names - {"document_vision"}
    ]
    validate_node_tools(NODE_TOOLS, NODE_INPUT_NODES, ToolRegistry(tools))  # must not raise


def test_vision_without_search_or_manifest_raises():
    registry = ToolRegistry([DocumentVisionTool(None)])
    # A node that offers document_vision but receives no manifest and has no
    # document_search in its set cannot satisfy document_id.
    with pytest.raises(ToolConfigError, match="document_id"):
        validate_node_tools({"extract": {"document_vision"}}, set(), registry)


def test_vision_satisfied_by_manifest_node_input():
    registry = ToolRegistry([DocumentVisionTool(None)])
    validate_node_tools({"extract": {"document_vision"}}, {"extract"}, registry)


def test_vision_satisfied_by_document_search_in_same_set():
    registry = ToolRegistry([DocumentVisionTool(None), StubTool("document_search")])
    validate_node_tools({"extract": {"document_vision", "document_search"}}, set(), registry)


def test_unregistered_tool_is_skipped():
    # document_vision is optional (only registered when a vision model is configured)
    validate_node_tools({"extract": {"document_vision"}}, set(), stub_registry())
