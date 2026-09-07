"""Cowork persistent context management (M3/M4).

Per Cowork project we persist, under the hidden ``.cowork/context/`` directory:

- ``state.json``      long-lived project summary, decisions, active task, and a
                      compact list of recent execution summaries (job -> what it
                      did and produced). Decisions and facts survive forever.
- ``messages.json``   the recent turn log (user + assistant). When it grows past
                      ``max_messages`` the oldest turns are compacted into
                      ``archived_summary`` (deterministic truncation, no LLM
                      dependency) and dropped.

What the model sees on each request is built by ``build_request`` in priority
order — current filesystem state first (authoritative), then project decisions/
active task, then recent conversation + archived history, then the request.
Only bounded, plain-text summaries are ever stored or shown; raw model
chain-of-thought is never persisted.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.services.projects import CoworkProjects

_META = ".cowork"
_CTX = "context"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clip(text: Optional[str], limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "…"


class ContextManager:
    """Reads and updates the persistent context bundle for one Cowork project."""

    def __init__(
        self,
        projects: CoworkProjects,
        max_messages: int = 40,
        keep_messages: int = 12,
    ) -> None:
        self._projects = projects
        self._max_messages = max_messages
        self._keep_messages = keep_messages

    # ------------------------------------------------------------- paths

    def _ctx_dir(self, user_id: str, project_id: str) -> Path:
        return self._projects.project_dir(user_id, project_id) / _META / _CTX

    def _state_path(self, user_id: str, project_id: str) -> Path:
        return self._ctx_dir(user_id, project_id) / "state.json"

    def _messages_path(self, user_id: str, project_id: str) -> Path:
        return self._ctx_dir(user_id, project_id) / "messages.json"

    @staticmethod
    def _read_json(path: Path, default: Any) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError, json.JSONDecodeError):
            return default

    @staticmethod
    def _write_json(path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # ------------------------------------------------------------- state

    def _empty_state(self) -> dict:
        return {
            "project_summary": "",
            "decisions": [],
            "active_task": "",
            "archived_summary": "",
            "executions": [],
            "updated_at": _utcnow_iso(),
        }

    def get_state(self, user_id: str, project_id: str) -> dict:
        state = self._read_json(self._state_path(user_id, project_id), None)
        if not isinstance(state, dict):
            state = self._empty_state()
        return state

    def _put_state(self, user_id: str, project_id: str, state: dict) -> None:
        state["updated_at"] = _utcnow_iso()
        self._write_json(self._state_path(user_id, project_id), state)

    def set_project_summary(self, user_id: str, project_id: str, summary: str) -> None:
        state = self.get_state(user_id, project_id)
        state["project_summary"] = _clip(summary, 2000)
        self._put_state(user_id, project_id, state)

    def set_active_task(self, user_id: str, project_id: str, task: str) -> None:
        state = self.get_state(user_id, project_id)
        state["active_task"] = _clip(task, 500)
        self._put_state(user_id, project_id, state)

    def add_decision(
        self,
        user_id: str,
        project_id: str,
        decision: str,
        reason: str = "",
        source_job: Optional[str] = None,
    ) -> None:
        state = self.get_state(user_id, project_id)
        text = _clip(decision, 300)
        for entry in state["decisions"]:
            if entry.get("decision", "") == text:
                return
        state["decisions"].append(
            {
                "decision": text,
                "reason": _clip(reason, 300),
                "timestamp": _utcnow_iso(),
                "source_job": source_job,
            }
        )
        state["decisions"] = state["decisions"][-30:]
        self._put_state(user_id, project_id, state)

    def add_execution_summary(
        self,
        user_id: str,
        project_id: str,
        job_id: str,
        model: Optional[str],
        summary: Optional[str],
        files_touched: list[str],
    ) -> None:
        """Bounded execution rationale (M4): what ran and what it changed."""
        state = self.get_state(user_id, project_id)
        state["executions"].append(
            {
                "job_id": job_id,
                "timestamp": _utcnow_iso(),
                "model": model,
                "summary": _clip(summary, 600),
                "files_touched": files_touched[:30],
            }
        )
        state["executions"] = state["executions"][-25:]
        self._put_state(user_id, project_id, state)

    # ----------------------------------------------------------- messages

    def get_messages(self, user_id: str, project_id: str) -> list[dict]:
        messages = self._read_json(self._messages_path(user_id, project_id), None)
        if not isinstance(messages, list):
            return []
        return messages

    def _put_messages(self, user_id: str, project_id: str, messages: list[dict]) -> None:
        self._write_json(self._messages_path(user_id, project_id), messages)

    def add_user_message(self, user_id: str, project_id: str, text: str) -> None:
        self._append_message(user_id, project_id, {"role": "user", "text": _clip(text, 4000), "timestamp": _utcnow_iso()})

    def add_assistant_message(self, user_id: str, project_id: str, text: str) -> None:
        self._append_message(user_id, project_id, {"role": "assistant", "text": _clip(text, 6000), "timestamp": _utcnow_iso()})

    def _append_message(self, user_id: str, project_id: str, message: dict) -> None:
        messages = self.get_messages(user_id, project_id)
        messages.append(message)
        if len(messages) > self._max_messages:
            excess = messages[: len(messages) - self._keep_messages]
            messages = messages[-self._keep_messages :]
            state = self.get_state(user_id, project_id)
            archived = state.get("archived_summary") or ""
            lines = []
            for msg in excess:
                if msg.get("role") == "user":
                    lines.append(f"- {_clip(msg.get('text'), 140)}")
            extra = "\n".join(lines)
            merged = f"{archived}\nEarlier conversation included:\n{extra}".strip()
            state["archived_summary"] = _clip(merged, 4000)
            self._put_state(user_id, project_id, state)
        self._put_messages(user_id, project_id, messages)

    # ---------------------------------------------------------- assembly

    def build_request(self, user_id: str, project_id: str, message: str) -> str:
        """Assemble the model prompt section: filesystem first, then context."""
        meta = self._projects.get_project(user_id, project_id)
        state = self.get_state(user_id, project_id)
        sections: list[str] = []
        sections.append(f"Project: {meta.name} (id {project_id})")

        try:
            files = [e.path for e in self._projects.list_files(user_id, project_id, max_entries=200)]
        except Exception:
            files = []
        if files:
            sections.append("CURRENT FILES ON DISK (authoritative):")
            for path in files:
                sections.append(f"- {path}")
        else:
            sections.append("CURRENT FILES ON DISK: none yet.")

        if state.get("project_summary"):
            sections.append("PROJECT SUMMARY:\n" + state["project_summary"])
        decisions = state.get("decisions") or []
        if decisions:
            sections.append("DECISIONS:")
            for d in decisions[-10:]:
                line = f"- {d.get('decision', '')}"
                if d.get("reason"):
                    line += f" (reason: {d.get('reason')})"
                sections.append(line)
        if state.get("active_task"):
            sections.append(f"ACTIVE TASK: {state['active_task']}")

        messages = self.get_messages(user_id, project_id)[-16:]
        if messages:
            sections.append("RECENT CONVERSATION:")
            for m in messages:
                who = "User" if m.get("role") == "user" else "Assistant"
                sections.append(f"{who}: {_clip(m.get('text'), 800)}")
        if state.get("archived_summary"):
            sections.append("EARLIER HISTORY (compacted):\n" + state["archived_summary"])
        executions = state.get("executions") or []
        if executions:
            sections.append("RECENT EXECUTIONS:")
            for e in executions[-6:]:
                parts = [f"- {e.get('summary', '')}"]
                if e.get("model"):
                    parts.append(f"model: {e.get('model')}")
                if e.get("files_touched"):
                    parts.append("files: " + ", ".join(e["files_touched"]))
                sections.append(" ".join(parts))

        sections.append("")
        sections.append("CURRENT REQUEST:")
        sections.append(message)
        return "\n".join(sections)
