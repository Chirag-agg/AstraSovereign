"""A typed per-job plan — the single home for "what is this request asking for?".

The plan is filled in layers, deterministic first:

1. ``plan_defaults.resolve_explicit`` settles everything an explicit signal can
   name (a filename, "make a pptx", "write a Word doc", "in 500 words") and
   marks it ``explicit``.
2. The small planner model (``plan_filler.PlanFiller``) fills only the fields
   layer 1 left unset, marked ``model``.
3. Anything still unset takes a safe default, marked ``default``.

Layers are combined with :meth:`JobPlan.merge`, which is **escalation-only**: a
later layer may add a requirement but never withdraw one. That is the structural
guarantee that a wrong or over-eager model cannot talk the system out of doing
something a deterministic signal already asked for. It is a property of
``merge``, not of any prompt.

Having all three layers write into one object is the point: one place to log,
test and render the decision, instead of five regexes scattered through
``nodes.py`` and a threshold buried in the classifier.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

DELIVERABLE_NONE = "none"
DELIVERABLE_WORD = "word"
DELIVERABLE_EXCEL = "excel"
DELIVERABLE_SLIDES = "slides"

# Rank, not a total order: every real deliverable outranks "none" so a later
# layer can escalate a chat answer into a file, and no layer can go back the
# other way. When two real kinds collide the stronger *source* decides (an
# explicit filename beats a model guess), which is what ``merge`` below does.
_DELIVERABLE_RANK = {
    DELIVERABLE_NONE: 0,
    DELIVERABLE_WORD: 1,
    DELIVERABLE_EXCEL: 1,
    DELIVERABLE_SLIDES: 1,
}

# The generator each deliverable needs to actually be produced. The draft node
# reads this instead of matching regexes itself.
DELIVERABLE_TOOL = {
    DELIVERABLE_WORD: "document_generation",
    DELIVERABLE_EXCEL: "document_generation",
    DELIVERABLE_SLIDES: "presentation_generation",
}


class FieldSource(str, Enum):
    """Which layer settled a field.

    ``explicit`` means "settled deterministically, without the model" — that
    covers both the regex/filename layer and the classifier's label, since
    neither is a model judgement call.
    """

    explicit = "explicit"
    model = "model"
    default = "default"


# Higher wins when two layers disagree about a source for the same field.
_SOURCE_RANK = {FieldSource.default: 0, FieldSource.model: 1, FieldSource.explicit: 2}

# Fields whose provenance is tracked. Kept as a tuple so ``to_trace`` and the
# tests agree on the set without repeating it.
TRACKED_FIELDS = (
    "capability",
    "needs_documents",
    "needs_findings",
    "needs_code",
    "deliverable",
    "length_words",
)


class JobPlan(BaseModel):
    """What the job asks for, with a source recorded per field."""

    capability: str = ""
    needs_documents: bool = False
    # Narrower than ``needs_documents``: "this request asks for the typed
    # inspection findings the extract node produces" (tank geometry and
    # shell-course readings). ``needs_documents`` says a *document* is in play,
    # which is also true of a converted image or a Q&A about a PDF.
    needs_findings: bool = False
    needs_code: bool = False
    deliverable: str = DELIVERABLE_NONE
    length_words: Optional[int] = None
    # Unset fields have NO entry here — that is the signal that a later layer is
    # free to fill them, which is what creates the hole the model fills.
    sources: dict[str, FieldSource] = Field(default_factory=dict)
    # Where the model contradicted a deterministic signal. Recorded, never acted
    # on: this is the evidence that would later earn deleting a heuristic.
    disagreements: list[str] = Field(default_factory=list)

    def set_field(self, name: str, value, source: FieldSource) -> "JobPlan":
        """Set one field and record who settled it (chainable)."""
        setattr(self, name, value)
        self.sources[name] = source
        return self

    def is_set(self, name: str) -> bool:
        """Whether any layer has settled this field yet."""
        return name in self.sources

    def merge(self, other: "JobPlan") -> "JobPlan":
        """Combine two layers, keeping the stronger requirement of each field.

        Additive by construction: booleans OR (a later "no" never clears an
        earlier "yes"; it is only recorded as provenance when nothing was
        settled), lengths take the max, and ``deliverable`` can only move up the
        rank — never back to ``none`` once something asked for a file. A differing ``capability`` is recorded as a
        disagreement and the existing value is kept, because the classifier's
        label is the established signal and the caller applies the model as a
        tie-breaker explicitly (see ``plan_filler``).
        """
        merged = self.model_copy(deep=True)

        if other.capability and other.capability != self.capability:
            if self.capability:
                merged.note_disagreement("capability", self.capability, other.capability)
            else:
                merged.set_field("capability", other.capability, other.source_of("capability"))

        for name in ("needs_documents", "needs_findings", "needs_code"):
            mine, theirs = getattr(self, name), getattr(other, name)
            if theirs and not mine:
                merged.set_field(name, True, other.source_of(name))
            elif theirs and mine:
                merged._stronger_source(name, other)
            elif not mine and other.is_set(name):
                # The later layer affirmatively said "no" where nothing was
                # settled: record that it spoke. This is what keeps a model
                # success distinguishable from a silent default — the value is
                # unchanged either way, only the provenance differs, and that is
                # exactly what `source_counts` is read for.
                merged.set_field(name, False, other.source_of(name))

        if _DELIVERABLE_RANK.get(other.deliverable, 0) > 0:
            if _DELIVERABLE_RANK.get(self.deliverable, 0) == 0:
                merged.set_field("deliverable", other.deliverable, other.source_of("deliverable"))
            elif other.deliverable != self.deliverable:
                # Two real kinds, neither "none": the stronger source wins. An
                # explicit "save as .pptx" must not be overridden by a model
                # that assumed a Word document.
                if self.source_rank("deliverable") < other.source_rank("deliverable"):
                    merged.set_field("deliverable", other.deliverable, other.source_of("deliverable"))
                if self.source_rank("deliverable") >= other.source_rank("deliverable"):
                    merged.note_disagreement("deliverable", self.deliverable, other.deliverable)

        if other.length_words is not None:
            if self.length_words is None:
                merged.set_field("length_words", other.length_words, other.source_of("length_words"))
            elif other.length_words > self.length_words:
                merged.set_field("length_words", other.length_words, other.source_of("length_words"))

        merged.disagreements.extend(other.disagreements)
        return merged

    def _stronger_source(self, name: str, other: "JobPlan") -> None:
        if self.source_rank(name) < other.source_rank(name):
            self.sources[name] = other.sources[name]

    def source_of(self, name: str) -> FieldSource:
        return self.sources.get(name, FieldSource.default)

    def source_rank(self, name: str) -> int:
        return _SOURCE_RANK[self.source_of(name)]

    def note_disagreement(self, field_name: str, kept, rejected) -> None:
        """Record, without acting on it, that a later layer proposed a different
        value for a field an earlier layer had already settled.

        The layers are named rather than "model"/"deterministic" because either
        side of a disagreement can be either.
        """
        self.disagreements.append(
            f"{field_name}: {self.source_of(field_name).value} said {kept!r}, "
            f"a later layer said {rejected!r}"
        )

    def with_defaults(self) -> "JobPlan":
        """Mark every still-unset field as ``default``.

        Neutral values, not eager ones: inventing a deliverable for a plain
        question would be absurd. The "when in doubt, produce the deliverable"
        rule lives in ``plan_defaults`` instead, where a creation verb is
        actually visible.
        """
        filled = self.model_copy(deep=True)
        for name in TRACKED_FIELDS:
            if not filled.is_set(name):
                filled.sources[name] = FieldSource.default
        return filled

    def required_tool_success(self) -> set[str]:
        """The generator the draft node must show a successful call to.

        Empty for a chat answer — which is the correct contract for a request
        that never asked for a file.
        """
        tool = DELIVERABLE_TOOL.get(self.deliverable)
        return {tool} if tool else set()

    @property
    def word_count(self) -> Optional[int]:
        """The ``content_validator`` argument, or ``None`` when no length was asked."""
        return self.length_words

    def to_trace(self) -> dict:
        """The compact, JSON-friendly entry appended to the job trace."""
        return {
            "type": "plan_resolved",
            "capability": self.capability,
            "needs_documents": self.needs_documents,
            "needs_findings": self.needs_findings,
            "needs_code": self.needs_code,
            "deliverable": self.deliverable,
            "length_words": self.length_words,
            "sources": {k: v.value for k, v in self.sources.items()},
            "disagreements": list(self.disagreements),
        }

    def source_counts(self) -> dict[str, int]:
        """How many fields each layer settled — rolled up into job metrics."""
        counts = {s.value: 0 for s in FieldSource}
        for field_name in TRACKED_FIELDS:
            counts[self.source_of(field_name).value] += 1
        return counts
