"""Static tool-reachability validation, per node tool set.

A tool that declares a ``required_sources`` argument can only be reached when
that argument is producible inside the node that offers the tool — by node input
(the attachment manifest) or by another tool in the same set. Checking the
*node's* set, not the global registry, catches the exact bug where a tool is
reachable globally but not where it is actually offered.
"""

NODE_INPUT_SOURCE = "node_input"


class ToolConfigError(Exception):
    """A node offers a tool whose required argument sources are unreachable."""


def validate_node_tools(node_tools, node_input_nodes, registry) -> None:
    """Raise :class:`ToolConfigError` on any unreachable tool argument.

    ``node_tools`` maps a node name to the tool names it may use; ``node_input_nodes``
    is the set of nodes that receive structured node input (the manifest);
    ``registry`` provides tool instances (``get(name)``).
    """
    for node, tool_names in node_tools.items():
        available = set(tool_names)
        has_node_input = node in node_input_nodes
        for tool_name in tool_names:
            tool = registry.get(tool_name) if registry is not None else None
            if tool is None:
                # Tool not registered (e.g. optional vision); nothing to verify.
                continue
            sources = getattr(tool, "required_sources", None) or {}
            for argument, producers in sources.items():
                producer_tools = set(producers) - {NODE_INPUT_SOURCE}
                satisfied = (
                    NODE_INPUT_SOURCE in producers and has_node_input
                ) or bool(producer_tools & available)
                if not satisfied:
                    raise ToolConfigError(
                        f"node '{node}' offers tool '{tool_name}' whose required "
                        f"argument '{argument}' has no source: needs node input or "
                        f"one of {sorted(producer_tools)} in the same node set."
                    )
