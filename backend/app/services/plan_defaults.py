"""The deterministic layer of the job plan — every explicit signal, in one place.

These rules used to be scattered: five regexes in ``nodes.py``, two more inline
in ``agent.py`` that duplicated two of the five, and a threshold inside the
capability classifier. They are **moved here, not weakened** — each one still
exists for the specific observed failure named in its comment, and each has a
test in ``tests/test_plan.py``.

:func:`resolve_explicit` fills only the fields it can settle unambiguously and
marks them ``explicit``. It deliberately **does not guess**: an implicit request
("draft me something for the review meeting") leaves fields unsettled, which is
the hole the small planner model exists to fill.
"""

from __future__ import annotations

import re

from app.services.plan import (
    DELIVERABLE_EXCEL,
    DELIVERABLE_SLIDES,
    DELIVERABLE_WORD,
    FieldSource,
    JobPlan,
)

# _run_compute's "is this a computational task" precondition (no attachments,
# so no findings to compute from) used to hang entirely off the classifier's
# ``coding`` label — a small hand-curated nearest-exemplar match (measured ~88%
# held-out accuracy) sitting outside the node's control. A misclassified
# plain-text coding request ("reverse this string in python and test it") then
# skipped compute silently and fell through to draft's general model with no
# code_execution tool at all, a much larger quality gap than a wrong label.
# This is deliberately a cheap, deterministic second opinion the classifier's
# accuracy cannot regress: it only ever WIDENS the code requirement (never
# narrows it), so a classifier fix later is additive, not a replacement.
CODING_INTENT_RE = re.compile(
    r"\b(python|javascript|typescript|function|def\b|code|program|script|"
    r"algorithm|compile|debug)\b",
    re.IGNORECASE,
)

# The document nodes' viability precondition. A session keeps its attachments
# for the whole conversation, so "is anything attached?" is not the same
# question as "does this message ask about the attachments?" — gating on the
# manifest alone forced extract+retrieve (and retrieve's instruction *demands* a
# document_search) onto every later message in the thread, including "hi". The
# semantic label is the primary signal; this regex is the same cheap widening
# backstop CODING_INTENT_RE gives compute, so a document request the ~88%
# classifier labels ``general`` is still never silently stripped of retrieval.
# It names document nouns, not generic verbs, so chit-chat does not trip it.
DOCUMENT_INTENT_RE = re.compile(
    r"\b(document\w*|report\w*|procedure\w*|sop\b|spec\w*|standard\w*|"
    r"revision\w*|inspection\w*|survey\w*|nameplate\w*|reading\w*|"
    r"attach\w*|upload\w*|extract\w*|cite\w*|citation\w*|"
    r"corrosion|thickness\w*|vessel\w*|screenshot\w*|image\w*|photo\w*|picture\w*|figure\w*)\b",
    re.IGNORECASE,
)

# The extract node's own precondition, one step narrower than
# DOCUMENT_INTENT_RE. Its only possible output is a typed ``FindingsObject`` —
# tank geometry and shell-course thickness readings — so it can do nothing
# useful for a request that does not ask for that assessment. Running it
# anyway costs a full model turn to discover there are no readings to submit
# (observed: "convert this image with tables into excel" spent 20+ minutes on
# the tank extractor before the job was cancelled), and the attachment's
# extracted text still reaches draft through the manifest. Same
# cheap-widening-backstop shape as the regexes above; the caller fails open when
# the classifier had no opinion at all, so an unclassified job is never gated.
FINDINGS_INTENT_RE = re.compile(
    r"\b(tank\w*|vessel\w*|inspection\w*|survey\w*|nameplate\w*|reading\w*|"
    r"thickness\w*|corrosion|shell\w*|geometry|assess\w*)\b",
    re.IGNORECASE,
)

# draft's generic (no-assessment) path has both generator tools in scope with
# no structural gate on which one gets called, so a weak model that is more
# "used to" producing a Word document can default to document_generation even
# when the request explicitly asked for a deck (observed). This is checked
# against the ORIGINAL request text, before draft wraps it with retrieved
# context, so "make a PPT" is detected regardless of what else is in scope.
PRESENTATION_INTENT_RE = re.compile(
    r"\b(ppt|pptx|powerpoint|presentation|slide\w*|deck)\b", re.IGNORECASE
)

# "Write 500 words" / "a 500-word report" was pure prompt wording (WRITING
# RULES / DOCUMENT GENERATION RULES in agent.py's system prompt) with no
# structural check behind it (observed: a "500 words" request answered with
# ~50) — the same shape of gap as PRESENTATION_INTENT_RE and CODING_INTENT_RE:
# a weak model's compliance was the only thing enforcing it. Matches
# "500 words"/"500-word" but not a bare number, so it only fires when a length
# was actually requested. Note this sets the *length*, not a deliverable: a
# bare "write 1000 words" is a chat answer that must be long enough, and only a
# creation noun makes it a file (see DOCUMENT_CREATION_INTENT_RE).
WORD_COUNT_RE = re.compile(r"\b(\d{2,5})[\s-]*words?\b", re.IGNORECASE)

# A request that asks for a file to be produced, not answered in chat: "create a
# doc of 1000 words on merge sort" returned the right length of prose and no
# deliverable, because draft's no-assessment path never required the generator
# the request named. Same shape as PRESENTATION_INTENT_RE. "words" does not
# match \bword\b, so "write 1000 words" stays a chat answer while "write a 1000
# word report" demands the file.
DOCUMENT_CREATION_INTENT_RE = re.compile(
    r"\b(create|write|make|build|compose|generate|prepare|draft)\w*\b.*"
    r"\b(doc|docx|document|report|note|notes|memo|letter|word|pdf|spreadsheet|sheet)\b",
    re.IGNORECASE,
)

# A spreadsheet was the one deliverable the noun lists above could not tell
# apart from a Word document ("make a spreadsheet of the corrosion rates" fell
# into the generic document branch). Named separately so the plan routes it to
# the Excel generator rather than the Word one.
SPREADSHEET_INTENT_RE = re.compile(
    r"\b(spreadsheet|sheet|xlsx|excel|workbook|csv)\b", re.IGNORECASE
)

# The strongest explicit signal there is: the user named the output file. An
# extension is unambiguous in a way no verb+noun heuristic is, so it is checked
# before every other deliverable rule.
EXPLICIT_DELIVERABLE_FILE_RE = re.compile(
    r"\b[\w.-]+\.(docx|xlsx|pptx|pdf)\b", re.IGNORECASE
)

DELIVERABLE_FOR_EXTENSION = {
    ".docx": DELIVERABLE_WORD,
    ".pdf": DELIVERABLE_WORD,
    ".xlsx": DELIVERABLE_EXCEL,
    ".pptx": DELIVERABLE_SLIDES,
}

# Labels that name a document-domain request outright. Anything else (coding,
# general) must earn the document nodes through DOCUMENT_INTENT_RE.
_DOCUMENT_LABELS = {"document", "vision"}


def _deliverable_from(text: str) -> str:
    """The deliverable an explicit signal names, or "" when none does.

    A deck is checked first and unguarded, exactly as the draft node's gate had
    it. The coding guard then suppresses every remaining rule — "write a script
    that emits a document" (or that saves one as ``report.docx``) is a coding
    request whose deliverable is the script, and demanding a generator for it
    would fight the sandbox contract. Within what is left the order is
    strongest-signal-first: a named file, then a spreadsheet, then the generic
    creation verb+noun form, so "make a spreadsheet" cannot fall into the
    generic document branch.
    """
    if PRESENTATION_INTENT_RE.search(text):
        return DELIVERABLE_SLIDES
    if CODING_INTENT_RE.search(text):
        return ""
    extension = EXPLICIT_DELIVERABLE_FILE_RE.search(text)
    if extension:
        return DELIVERABLE_FOR_EXTENSION.get(
            f".{extension.group(1).lower()}", DELIVERABLE_WORD
        )
    if SPREADSHEET_INTENT_RE.search(text):
        return DELIVERABLE_EXCEL
    if DOCUMENT_CREATION_INTENT_RE.search(text):
        return DELIVERABLE_WORD
    return ""


def resolve_explicit(task: str) -> JobPlan:
    """Settle every field an explicit signal in ``task`` determines.

    Fields with no explicit signal are left unset (absent from ``sources``) so
    a later layer may fill them. Note ``needs_code`` never relabels
    ``capability``: the classifier owns the label, and this regex only widens
    the requirement, exactly as the node-level backstop it replaces did.
    """
    text = task or ""
    plan = JobPlan()

    if CODING_INTENT_RE.search(text):
        plan.set_field("needs_code", True, FieldSource.explicit)
    if DOCUMENT_INTENT_RE.search(text):
        plan.set_field("needs_documents", True, FieldSource.explicit)
    if FINDINGS_INTENT_RE.search(text):
        plan.set_field("needs_findings", True, FieldSource.explicit)

    deliverable = _deliverable_from(text)
    if deliverable:
        plan.set_field("deliverable", deliverable, FieldSource.explicit)

    match = WORD_COUNT_RE.search(text)
    if match:
        plan.set_field("length_words", int(match.group(1)), FieldSource.explicit)

    return plan


def capability_plan(label: str, *, fail_open: bool = True) -> JobPlan:
    """The classifier's contribution to the plan.

    ``label`` is the ``SemanticCapabilityClassifier`` result, and it is recorded
    as ``explicit`` because it is deterministic (same message, same label) —
    "explicit" here means "settled without the model", which is the distinction
    the three-valued ``FieldSource`` draws.

    ``fail_open`` preserves the historical behaviour for an empty label (a job
    that predates classification, or a directly-invoked node agent): documents
    are *considered* and the extract node's gate is left open, so behaviour
    there is unchanged and a gate can only be closed by a label the classifier
    actually produced.
    """
    plan = JobPlan()
    if label:
        plan.set_field("capability", label, FieldSource.explicit)
    if (not label and fail_open) or label in _DOCUMENT_LABELS:
        plan.set_field("needs_documents", True, FieldSource.explicit)
    if not label and fail_open:
        # No opinion about the capability is no opinion about the extraction
        # either, so this gate opens with it rather than silently closing on
        # every unclassified job.
        plan.set_field("needs_findings", True, FieldSource.explicit)
    if label == "coding":
        plan.set_field("needs_code", True, FieldSource.explicit)
    return plan


def resolve(task: str, label: str = "") -> JobPlan:
    """The full deterministic layer: the classifier's label widened by every
    explicit signal in the request text.

    ``capability_plan`` is the receiver so its label survives a conflicting
    regex — the merge records the difference as a disagreement but keeps the
    label, which is what "only widen, never relabel" means in practice.
    """
    return capability_plan(label).merge(resolve_explicit(task))
