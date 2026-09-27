"""The job plan: the escalation-only merge, and the deterministic layer.

These tests pin the two properties the design depends on:

- ``JobPlan.merge`` can ADD a requirement but never remove one, so a later layer
  (ultimately a small model) cannot talk the system out of something a
  deterministic signal already asked for.
- ``resolve_explicit`` settles only what an explicit signal actually names, and
  leaves everything else unset so a later layer is free to fill it.

The regex rules themselves moved here from ``nodes.py``/``agent.py`` unchanged;
each one's reason for existing is in its comment in ``plan_defaults``.
"""

from __future__ import annotations

import pytest

from app.services.plan import (
    DELIVERABLE_EXCEL,
    DELIVERABLE_NONE,
    DELIVERABLE_SLIDES,
    DELIVERABLE_WORD,
    FieldSource,
    JobPlan,
)
from app.services.plan_defaults import capability_plan, resolve, resolve_explicit


# -- the escalation-only merge ------------------------------------------------


def test_merge_can_add_a_requirement_the_first_layer_did_not_have():
    model_adds_a_deck = JobPlan().set_field("deliverable", DELIVERABLE_SLIDES, FieldSource.model)
    merged = JobPlan().merge(model_adds_a_deck)
    assert merged.deliverable == DELIVERABLE_SLIDES
    assert merged.source_of("deliverable") == FieldSource.model


def test_merge_can_never_remove_a_requirement_already_set():
    """A model that decides no file is needed must not override an explicit one.

    ``none`` is the absence of a proposal, not a proposal: it cannot be merged
    over a real deliverable, which is what makes this invariant structural
    rather than a prompt instruction.
    """
    explicit = JobPlan().set_field("deliverable", DELIVERABLE_WORD, FieldSource.explicit)
    model_says_chat = JobPlan()  # deliverable defaults to "none"

    merged = explicit.merge(model_says_chat)

    assert merged.deliverable == DELIVERABLE_WORD
    assert merged.required_tool_success() == {"document_generation"}


def test_merge_keeps_the_stronger_source_when_two_real_kinds_collide():
    """An explicit "save as .pptx" must not be overridden by a model that assumed
    a Word document, and the difference is recorded rather than silently dropped."""
    explicit = JobPlan().set_field("deliverable", DELIVERABLE_SLIDES, FieldSource.explicit)
    model_says_word = JobPlan().set_field("deliverable", DELIVERABLE_WORD, FieldSource.model)

    merged = explicit.merge(model_says_word)

    assert merged.deliverable == DELIVERABLE_SLIDES
    assert merged.disagreements
    assert "deliverable" in merged.disagreements[0]


def test_merge_ors_booleans_and_takes_the_longer_length():
    code = JobPlan().set_field("needs_code", True, FieldSource.explicit)
    assert code.merge(JobPlan()).needs_code is True
    assert JobPlan().merge(code).needs_code is True

    short = JobPlan().set_field("length_words", 300, FieldSource.explicit)
    longer = JobPlan().set_field("length_words", 1000, FieldSource.model)
    assert short.merge(longer).length_words == 1000
    assert longer.merge(short).length_words == 1000


def test_a_later_layers_no_is_provenance_not_a_withdrawal():
    """A model's "no" where nothing was settled is a decision, so it is recorded
    as one — a model success and a silent default must never look alike in the
    trace. It is still not a withdrawal: it cannot clear an earlier "yes"."""
    model_says_no = JobPlan().set_field("needs_documents", False, FieldSource.model)

    decided = JobPlan().merge(model_says_no)
    assert decided.needs_documents is False
    assert decided.source_of("needs_documents") == FieldSource.model

    # A default-marked field is upgraded to the stronger source, not duplicated.
    assert JobPlan().with_defaults().merge(model_says_no).source_of(
        "needs_documents"
    ) == FieldSource.model

    already_asked = JobPlan().set_field("needs_documents", True, FieldSource.explicit)
    kept = already_asked.merge(model_says_no)
    assert kept.needs_documents is True
    assert kept.source_of("needs_documents") == FieldSource.explicit


# -- the deterministic layer --------------------------------------------------


@pytest.mark.parametrize(
    "task,expected",
    [
        ("put the numbers in results.xlsx", DELIVERABLE_EXCEL),
        ("write the findings to report.docx", DELIVERABLE_WORD),
        ("save the summary as notes.pptx", DELIVERABLE_SLIDES),
        ("make a spreadsheet of the corrosion rates", DELIVERABLE_EXCEL),
    ],
)
def test_an_explicit_signal_sets_the_deliverable(task, expected):
    plan = resolve_explicit(task)
    assert plan.deliverable == expected
    assert plan.source_of("deliverable") == FieldSource.explicit


def test_bare_word_count_is_a_length_not_a_deliverable():
    """The exact regression: "create a doc of 1000 words" must demand the file,
    while a bare "write 1000 words" is a chat answer that must merely be long
    enough. Both set the length; only the creation noun sets a deliverable."""
    chat = resolve_explicit("write 1000 words on merge sort")
    assert chat.deliverable == DELIVERABLE_NONE
    assert chat.length_words == 1000
    assert chat.required_tool_success() == set()

    file_request = resolve_explicit("write a 1000 word report on merge sort")
    assert file_request.deliverable == DELIVERABLE_WORD
    assert file_request.length_words == 1000
    assert file_request.required_tool_success() == {"document_generation"}


def test_presentation_intent_wins_over_a_mentioned_document():
    plan = resolve_explicit("write a report as a presentation")
    assert plan.deliverable == DELIVERABLE_SLIDES


def test_a_coding_request_mentioning_a_document_is_left_alone():
    """"write a script that emits a document" names a document noun but is a
    coding request; forcing a generator would derail it. The guard also covers a
    named output file, because the deliverable there is still the script."""
    plan = resolve_explicit("write a python script that emits a report.docx")
    assert plan.deliverable == DELIVERABLE_NONE
    assert plan.needs_code is True


def test_an_implicit_request_leaves_the_fields_unset():
    """The hole the planner model exists to fill: nothing explicit to go on, so
    the fields are absent rather than guessed."""
    plan = resolve_explicit("draft me something for the review meeting")
    assert not plan.is_set("deliverable")
    assert not plan.is_set("length_words")
    assert plan.disagreements == []


def test_sources_record_which_layer_resolved_each_field():
    deterministic = resolve("make a pptx for the review", "document")
    assert deterministic.source_of("capability") == FieldSource.explicit
    assert deterministic.source_of("deliverable") == FieldSource.explicit
    assert deterministic.source_of("needs_documents") == FieldSource.explicit

    defaulted = resolve("hello there", "general").with_defaults()
    assert defaulted.source_of("capability") == FieldSource.explicit
    assert defaulted.source_of("deliverable") == FieldSource.default
    assert defaulted.source_of("needs_documents") == FieldSource.default
    # Six tracked fields; only the classifier's label was resolved deterministically.
    assert defaulted.source_counts() == {"explicit": 1, "model": 0, "default": 5}


def test_an_empty_label_fails_open_on_documents():
    """A job that predates classification, or a directly-invoked node agent,
    must behave as it did before: documents are considered and the extract
    node's narrower gate is open too."""
    assert capability_plan("").needs_documents is True
    assert capability_plan("").needs_findings is True
    assert capability_plan("general").needs_documents is False
    assert capability_plan("general").needs_findings is False
    assert capability_plan("vision").needs_documents is True
    assert capability_plan("vision").needs_findings is False
    assert capability_plan("coding").needs_code is True


def test_only_an_assessment_request_opens_the_findings_gate():
    """The extract node's only possible output is a typed tank-inspection
    findings object, so an attachment task that is not an assessment must not
    pay for a model turn that can only degrade."""
    assert resolve("Assess Tank 204 using the inspection reports and our SOP.", "document").needs_findings
    assert resolve("Summarize the attached vessel report.", "general").needs_findings
    assert resolve("read the nameplate on this tank", "vision").needs_findings
    # A document request, but not an assessment of one.
    assert resolve("convert this image with tables into excel", "vision").needs_documents
    assert not resolve("convert this image with tables into excel", "vision").needs_findings
    assert not resolve("What does the SOP say about hydro testing?", "document").needs_findings


def test_the_regex_widens_the_requirement_without_relabelling():
    """The backstop that gives a misclassified coding request its compute node
    must add ``needs_code`` without overwriting the classifier's label."""
    plan = resolve("reverse this string in python and test it", "general")
    assert plan.needs_code is True
    assert plan.capability == "general"


def test_to_trace_is_json_ready():
    trace = resolve("create a doc of 1000 words on merge sort", "document").to_trace()
    assert trace["type"] == "plan_resolved"
    assert trace["deliverable"] == DELIVERABLE_WORD
    assert trace["sources"]["deliverable"] == "explicit"
    assert trace["length_words"] == 1000
