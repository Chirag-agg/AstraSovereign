"""Tool registry — deny-by-default execution with name and argument validation.

The agent depends on this registry abstraction, never on individual tools, so
future tools can be added without touching the agent loop.
"""

import logging
from pathlib import Path
from typing import Any, Iterable, Optional

from app.services.tools import BaseTool, ToolError, ToolResult

logger = logging.getLogger("app.tool_registry")


class ToolRegistry:
    def __init__(self, tools: Iterable[BaseTool]) -> None:
        self._tools: dict[str, BaseTool] = {tool.name: tool for tool in tools}

    def names(self) -> list[str]:
        return sorted(self._tools)

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def describe(self) -> list[dict]:
        """Serialize tool metadata for the agent prompt (no code, no secrets)."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in self._tools.values()
        ]

    async def execute(self, name: str, arguments: dict[str, Any], workspace: Path) -> ToolResult:
        """Validate and run a tool. Deny-by-default: unknown names never run."""
        tool = self._tools.get(name)
        if tool is None:
            raise ToolError(
                f"Unknown tool '{name}'. Available: {', '.join(self.names()) or 'none'}"
            )
        validate_arguments(tool.input_schema, arguments)
        try:
            return await tool.execute(workspace, arguments)
        except ToolError:
            raise
        except Exception as exc:  # unexpected tool failure — never crash the loop
            logger.exception(
                "tool_unexpected_error",
                extra={"event": "tool_call_failed", "tool": name},
            )
            raise ToolError(f"Tool '{name}' failed: {exc.__class__.__name__}") from exc


def validate_arguments(schema: dict, arguments: Any) -> None:
    """Validate ``arguments`` against the small JSON-schema subset used by tools."""
    if not isinstance(arguments, dict):
        raise ToolError("Tool arguments must be a JSON object")
    properties = schema.get("properties", {})
    required = schema.get("required", [])
    for prop in required:
        if prop not in arguments:
            raise ToolError(f"Missing required argument: '{prop}'")
    if schema.get("additionalProperties") is False:
        extra = set(arguments) - set(properties)
        if extra:
            raise ToolError(f"Unexpected argument(s): {', '.join(sorted(extra))}")
    for key, value in arguments.items():
        prop = properties.get(key)
        if prop is None:
            continue
        expected = prop.get("type")
        if expected == "string" and not isinstance(value, str):
            raise ToolError(f"Argument '{key}' must be a string")
        if expected == "integer" and not isinstance(value, bool) and not isinstance(value, int):
            raise ToolError(f"Argument '{key}' must be an integer")
        if expected == "boolean" and not isinstance(value, bool):
            raise ToolError(f"Argument '{key}' must be a boolean")
        if expected == "array":
            items = prop.get("items") or {}
            item_type = items.get("type")
            if not isinstance(value, list):
                raise ToolError(f"Argument '{key}' must be an array")
            if item_type == "integer":
                if any(isinstance(v, bool) or not isinstance(v, int) for v in value):
                    raise ToolError(f"Argument '{key}' must be an array of integers")
            elif item_type == "string":
                if any(not isinstance(v, str) for v in value):
                    raise ToolError(f"Argument '{key}' must be an array of strings")
            elif item_type == "boolean":
                if any(not isinstance(v, bool) for v in value):
                    raise ToolError(f"Argument '{key}' must be an array of booleans")
            elif item_type == "object":
                if any(not isinstance(v, dict) for v in value):
                    raise ToolError(f"Argument '{key}' must be an array of objects")
