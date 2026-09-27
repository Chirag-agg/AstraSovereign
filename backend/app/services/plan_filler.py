"""The model layer of the job plan: fills only the fields nothing else settled.

The deterministic layer (``plan_defaults``) has already run and marked what it
could settle from an explicit signal. This layer exists for the requests where
nothing explicit is present — "draft me something for the review meeting" — and
it is handed the resolved fields so it fills the *gaps* rather than second-
guessing them. Its output is combined with :meth:`JobPlan.merge`, which is
escalation-only, so even a confidently wrong answer cannot withdraw a
requirement a deterministic signal already asked for.

Two design points that make a ~1B model viable here:

- **Constrained decoding, not prompt-and-parse.** Ollama is given a JSON Schema
  in ``format``, so the fields must appear. The documented ``qwen3:1.7b``
  failure (an empty object against the agent protocol) was free-running
  generation: asked in prose for a shape, it returns whatever JSON it likes
  (measured: ``meeting_title``, ``participants``, …). Constrained, the same
  model returns exactly the schema. One constrained emission is a far easier
  task than holding a multi-turn tool-calling protocol.
- **Failure is a branch, not an error path.** An empty or malformed reply leaves
  the plan exactly as the deterministic layer left it. Planning must never fail
  a job, the same way a failed classification never does.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.services.plan import (
    DELIVERABLE_EXCEL,
    DELIVERABLE_NONE,
    DELIVERABLE_SLIDES,
    DELIVERABLE_WORD,
    TRACKED_FIELDS,
    FieldSource,
    JobPlan,
)

logger = logging.getLogger("app.plan_filler")

# The shape the model is constrained to. `length_words` is nullable and not
# required: the model must be able to say "no length was asked for", which is
# the honest answer far more often than a number.
PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "deliverable": {
            "type": "string",
            "enum": [
                DELIVERABLE_NONE,
                DELIVERABLE_WORD,
                DELIVERABLE_EXCEL,
                DELIVERABLE_SLIDES,
            ],
        },
        "length_words": {"type": ["integer", "null"]},
        "needs_documents": {"type": "boolean"},
        "needs_code": {"type": "boolean"},
    },
    "required": ["deliverable", "needs_documents", "needs_code"],
}

_VALID_DELIVERABLES = {
    DELIVERABLE_NONE,
    DELIVERABLE_WORD,
    DELIVERABLE_EXCEL,
    DELIVERABLE_SLIDES,
}

# A length the model invents out of nowhere is fabrication, not a fill. Keeping
# to a plausible document length means a hallucinated "100" cannot impose an
# unrequested word floor on what is really a chat answer; the eval scores
# whether the model respects the "null unless asked" rule.
MIN_LENGTH_WORDS = 50
MAX_LENGTH_WORDS = 20_000

_SYSTEM_PROMPT = (
    "You decide what a request to an offline engineering workbench is asking "
    "for. Answer only with the JSON object.\n\n"
    "deliverable: \"none\" when the answer is a reply in the chat; \"word\" for "
    "a Word document; \"excel\" for a spreadsheet; \"slides\" for a slide deck.\n"
    "length_words: the length asked for, in words, or null when no length is "
    "asked for. Do not invent a length.\n"
    "needs_documents: true when answering means reading documents or images "
    "that the user attached or referred to.\n"
    "needs_code: true when the request must run code to compute something.\n\n"
    "Be decisive about the deliverable. A conceptual question, a greeting or "
    "ordinary conversation is \"none\". Anything listed as already determined "
    "is fixed — you are filling the gaps."
)


class PlanFiller:
    """Fills a plan's unresolved fields with one constrained model call."""

    def __init__(self, chat, model: str = "qwen3:1.7b") -> None:
        # `chat` is an OllamaService (anything with
        # `async chat(messages, model=, format=, think=)`), kept duck-typed so
        # the tests can drive it with a stub and the eval with a thin client.
        self._chat = chat
        self._model = model

    async def fill(self, task: str, base: JobPlan) -> JobPlan:
        """Return ``base`` widened by whatever the model can add.

        Never raises and never narrows: on an unusable reply the plan is
        returned unchanged, exactly as the deterministic layer left it.
        """
        proposal = await self._propose(self._messages(task, base))
        if proposal is None:
            return base
        return base.merge(proposal)

    def _messages(self, task: str, base: JobPlan) -> list[dict]:
        resolved = ", ".join(
            f"{name}={getattr(base, name)!r}"
            for name in TRACKED_FIELDS
            if base.is_set(name)
        )
        return [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"REQUEST: {task}\n\n"
                    "ALREADY DETERMINED (fixed, do not contradict): "
                    f"{resolved or 'nothing'}"
                ),
            },
        ]

    async def _propose(self, messages: list[dict]) -> Optional[JobPlan]:
        """One constrained call, retried once, then give up."""
        current = messages
        for attempt in (1, 2):
            try:
                content, _tool_calls, _model = await self._chat.chat(
                    current, model=self._model, format=PLAN_SCHEMA, think=False
                )
            except Exception as exc:  # planning must never fail the job
                logger.warning(
                    "plan_filler_unavailable",
                    extra={
                        "event": "plan_filler_unavailable",
                        "model": self._model,
                        "error": exc.__class__.__name__,
                    },
                )
                return None
            proposal = self._parse(content)
            if proposal is not None:
                return proposal
            logger.info(
                "plan_filler_retry",
                extra={
                    "event": "plan_filler_retry",
                    "model": self._model,
                    "attempt": attempt,
                },
            )
            current = current + [
                {"role": "assistant", "content": content or ""},
                {
                    "role": "user",
                    "content": "That reply was not usable. Return the JSON object only.",
                },
            ]
        return None

    def _parse(self, content: str) -> Optional[JobPlan]:
        """Turn a model reply into a proposal, or ``None`` when unusable."""
        text = (content or "").strip()
        if not text:
            return None
        try:
            data = json.loads(text)
        except (ValueError, TypeError):
            return None
        if not isinstance(data, dict):
            return None

        proposal = JobPlan()
        deliverable = data.get("deliverable")
        if deliverable in _VALID_DELIVERABLES:
            proposal.set_field("deliverable", deliverable, FieldSource.model)
        for name in ("needs_documents", "needs_code"):
            value = data.get(name)
            if isinstance(value, bool):
                proposal.set_field(name, value, FieldSource.model)
        length = data.get("length_words")
        # JSON true/false parse as ints in Python; neither is a length.
        if not isinstance(length, bool) and isinstance(length, int):
            if MIN_LENGTH_WORDS <= length <= MAX_LENGTH_WORDS:
                proposal.set_field("length_words", length, FieldSource.model)
        return proposal if proposal.sources else None
