"""Dump the exact messages sent to each node's agent, every role/iteration.

    backend\\.venv\\Scripts\\python.exe tests\\hard_scenario_01\\dump_node_messages.py

Wraps the agent's model client so the raw ``messages`` arrays (and the tool names
offered) are captured, then prints them per node.
"""

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tests" / "hard_scenario_01"))

from app.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.attachments import build_attachment_manifest  # noqa: E402
from app.services.capability_router import CapabilityRouter  # noqa: E402
from app.services.nodes import NodeAgent  # noqa: E402
from run_nodes_direct import PROMPT, ingest, node_of  # noqa: E402


class ChatRecorder:
    def __init__(self, inner):
        self._inner = inner
        self.calls = []

    async def chat(self, messages, **kwargs):
        self.calls.append(
            {
                "messages": messages,
                "model": kwargs.get("model"),
                "tools": [t["function"]["name"] for t in (kwargs.get("tools") or [])],
            }
        )
        return await self._inner.chat(messages, **kwargs)

    def __getattr__(self, name):
        return getattr(self._inner, name)


class NodeRecordingAgent:
    def __init__(self, inner, chat_recorder):
        self._inner = inner
        self._chat = chat_recorder
        self.calls = []

    async def run(self, job, **kwargs):
        start = len(self._chat.calls)
        result = await self._inner.run(job, **kwargs)
        self.calls.append(
            {"node": node_of(kwargs.get("task_text", "")), "range": (start, len(self._chat.calls))}
        )
        return result

    async def record_trace(self, *args, **kwargs):
        return await self._inner.record_trace(*args, **kwargs)


async def main() -> None:
    get_settings.cache_clear()
    app = create_app()
    user_id = "user-001"
    await ingest(app, user_id)

    job = await app.state.job_manager.create_job(user_id=user_id, message=PROMPT)
    workspace = await app.state.workspace_manager.create_workspace(user_id, job.job_id)
    manifest = build_attachment_manifest(await app.state.knowledge_base.list_documents(user_id))

    chat_recorder = ChatRecorder(app.state.agent._model)
    app.state.agent._model = chat_recorder
    recorder = NodeRecordingAgent(app.state.agent, chat_recorder)
    node_agent = NodeAgent(
        agent=recorder,
        capability_router=CapabilityRouter(app.state.model_registry),
        registry=app.state.model_registry,
    )
    await node_agent.run(job, workspace, task_text=PROMPT, attachments=manifest)

    for call in recorder.calls:
        node = call["node"]
        if node not in ("extract", "retrieve"):
            continue
        start, end = call["range"]
        print("=" * 78)
        print(f"NODE {node}: {end - start} model call(s)")
        for index in range(start, end):
            entry = chat_recorder.calls[index]
            print(f"--- call {index - start + 1} | model={entry['model']} | tools={entry['tools']}")
            for message in entry["messages"]:
                role = message.get("role")
                content = message.get("content") or ""
                print(f"  [{role}] {content}")
                if message.get("tool_calls"):
                    print(
                        "     tool_calls:",
                        [
                            (t["function"]["name"], t["function"]["arguments"])
                            for t in message["tool_calls"]
                        ],
                    )


if __name__ == "__main__":
    asyncio.run(main())
