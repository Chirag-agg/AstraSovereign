"""The plan filler: one constrained call, and never a way for a job to fail.

The three properties pinned here are the ones that make a ~1B model safe to put
in the request path at all:

- an unusable reply is a *branch*, not an error — the plan falls through exactly
  as the deterministic layer left it and the job still runs;
- a reply that contradicts an already-settled field is ignored, and the
  contradiction is recorded rather than silently dropped;
- a reply that *adds* a requirement is honoured.

Plus the one wire-level fact the constrained-decoding design depends on: the
JSON schema is actually passed in Ollama's ``format`` parameter, not merely
described in the prompt.
"""

from __future__ import annotations

import asyncio
import json

from app.services.ollama_service import OllamaUnavailableError
from app.services.plan import (
    DELIVERABLE_NONE,
    DELIVERABLE_SLIDES,
    DELIVERABLE_WORD,
    FieldSource,
    JobPlan,
)
from app.services.plan_defaults import resolve_explicit
from app.services.plan_filler import PLAN_SCHEMA, PlanFiller


class StubChat:
    """An OllamaService stand-in: canned replies, recorded payloads.

    A reply that is an ``Exception`` instance is raised, so the transport-failure
    branch is exercised through the same seam as a real outage.
    """

    def __init__(self, replies) -> None:
        self.replies = list(replies)
        self.calls: list[dict] = []

    async def chat(self, messages, model=None, tools=None, format=None, think=None):
        self.calls.append(
            {"messages": messages, "model": model, "format": format, "think": think}
        )
        reply = self.replies.pop(0) if self.replies else ""
        if isinstance(reply, Exception):
            raise reply
        return reply, [], model or "stub"


def _fill(chat: StubChat, task: str, base: JobPlan) -> JobPlan:
    return asyncio.run(PlanFiller(chat, model="qwen3:1.7b").fill(task, base))


# -- failure is a branch, not an error path -----------------------------------


def test_an_empty_reply_leaves_the_plan_exactly_as_the_deterministic_layer_left_it():
    base = resolve_explicit("make a pptx of the findings")
    chat = StubChat(["", ""])

    plan = _fill(chat, "make a pptx of the findings", base)

    assert plan.deliverable == DELIVERABLE_SLIDES
    assert plan.source_of("deliverable") == FieldSource.explicit
    # Nothing was added, so nothing is sourced to the model.
    assert plan.source_counts()["model"] == 0
    # An unusable reply is retried exactly once, then abandoned.
    assert len(chat.calls) == 2


def test_a_transport_failure_never_raises_into_the_job():
    base = JobPlan()
    chat = StubChat([OllamaUnavailableError("ollama is down")])

    plan = _fill(chat, "draft me something for the review", base)

    assert plan.sources == {}
    assert plan.disagreements == []


def test_an_out_of_range_length_is_fabrication_not_a_fill():
    """A model that invents "3" must not impose a three-word floor on an answer
    that was never asked to be any particular length."""
    chat = StubChat([json.dumps({"deliverable": "none", "length_words": 3,
                                 "needs_documents": False, "needs_code": False})])

    plan = _fill(chat, "what does corrosion allowance mean?", JobPlan())

    assert plan.length_words is None


def test_a_length_inside_the_plausible_range_is_accepted():
    chat = StubChat([json.dumps({"deliverable": "word", "length_words": 500,
                                 "needs_documents": False, "needs_code": False})])

    plan = _fill(chat, "give me something substantial on corrosion", JobPlan())

    assert plan.length_words == 500
    assert plan.source_of("length_words") == FieldSource.model


# -- add, never remove ---------------------------------------------------------


def test_a_reply_that_adds_a_deliverable_is_honoured():
    """The whole point of the layer: an implicit request the deterministic rules
    cannot settle gets its deliverable from the model."""
    chat = StubChat([json.dumps({"deliverable": "slides", "length_words": None,
                                 "needs_documents": True, "needs_code": False})])

    plan = _fill(chat, "I am presenting to the review board next week", JobPlan())

    assert plan.deliverable == DELIVERABLE_SLIDES
    assert plan.needs_documents is True
    assert plan.source_of("deliverable") == FieldSource.model


def test_a_reply_that_contradicts_an_explicit_field_is_ignored_and_recorded():
    """An explicit "save as .pptx" must survive a model that assumed Word, and
    the difference must be in the log — that disagreement is the evidence that
    would later earn deleting the rule."""
    base = resolve_explicit("make a pptx of the findings")
    chat = StubChat([json.dumps({"deliverable": "word", "length_words": None,
                                 "needs_documents": False, "needs_code": False})])

    plan = _fill(chat, "make a pptx of the findings", base)

    assert plan.deliverable == DELIVERABLE_SLIDES
    assert plan.disagreements
    assert "deliverable" in plan.disagreements[0]


def test_a_model_that_proposes_nothing_cannot_withdraw_a_requirement():
    """"none" is the absence of a proposal, not a proposal: saying "chat" must
    not cancel the deliverable an explicit signal asked for."""
    base = resolve_explicit("write the findings to report.docx")
    chat = StubChat([json.dumps({"deliverable": DELIVERABLE_NONE, "length_words": None,
                                 "needs_documents": False, "needs_code": False})])

    plan = _fill(chat, "write the findings to report.docx", base)

    assert plan.deliverable == DELIVERABLE_WORD
    assert plan.required_tool_success() == {"document_generation"}


# -- constrained decoding ------------------------------------------------------


def test_the_schema_is_passed_in_format_so_the_fields_must_appear():
    chat = StubChat([json.dumps({"deliverable": "none", "length_words": None,
                                 "needs_documents": False, "needs_code": False})])

    _fill(chat, "thanks, that helps", JobPlan())

    assert chat.calls[0]["format"] == PLAN_SCHEMA
    # Thinking is the bulk of a hybrid model's latency on a one-shot call and
    # none of the answer.
    assert chat.calls[0]["think"] is False
    assert chat.calls[0]["model"] == "qwen3:1.7b"


def test_already_determined_fields_are_shown_to_the_model_as_fixed():
    base = resolve_explicit("make a pptx of the findings")
    chat = StubChat([json.dumps({"deliverable": "slides", "length_words": None,
                                 "needs_documents": False, "needs_code": False})])

    _fill(chat, "make a pptx of the findings", base)

    user_message = chat.calls[0]["messages"][-1]["content"]
    assert "ALREADY DETERMINED" in user_message
    assert "deliverable=" in user_message
