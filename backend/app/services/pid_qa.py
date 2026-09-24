"""P&ID question-answering and visual evidence citation service.

Answers engineering questions about P&ID drawings (instrument loops, connected
piping lines, equipment tags, drawing revisions, and local spatial topologies)
using extracted ``ExtractionElement`` records and provides cropped visual image
citations as auditable evidence.

Confidence flags are dynamically computed at query time against active settings
(``confidence < low_confidence_threshold``) to avoid stale persisted flags.
Topological relationships are resolved using stable content-addressed
``neighbor_tag_ids``.
"""

from dataclasses import dataclass, field
import logging
import math
from pathlib import Path
import re
from typing import Any, Optional

from app.schemas.extraction import DocumentExtraction, ExtractionElement
from app.services.pid_classifier import PIDTagClassifier
from app.services.pid_extractor import PIDSettings

logger = logging.getLogger("app.pid_qa")


@dataclass(frozen=True)
class PIDCitation:
    """Auditable evidence citation for an extracted P&ID tag."""

    tag: str
    subtype: str
    page: Optional[int]
    bbox: Optional[list[float]]
    confidence: Optional[float]
    is_low_confidence: bool
    image_path: Optional[str]
    element_id: Optional[str]
    neighbor_tags: list[str] = field(default_factory=list)
    is_structurally_valid: bool = True
    continues_on_pages: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class PIDQAResult:
    """Structured response to a P&ID technical inquiry."""

    question: str
    answer: str
    citations: list[PIDCitation]
    total_tags_found: int


class PIDQuestionAnswerer:
    """Answers queries against extracted P&ID drawing artifacts with visual citations."""

    def __init__(
        self,
        settings: Optional[PIDSettings] = None,
        classifier: Optional[PIDTagClassifier] = None,
    ) -> None:
        self.settings = settings or PIDSettings.load()
        self.classifier = classifier or PIDTagClassifier()

    def answer_question(
        self,
        question: str,
        extraction: DocumentExtraction,
    ) -> PIDQAResult:
        """Analyze a question against document extraction elements and formulate an answer.

        Parameters
        ----------
        question : str
            The user or agent inquiry (e.g. "What instruments connect to TANK-204?").
        extraction : DocumentExtraction
            The extracted document artifact containing ``pid_tag`` elements.

        Returns
        -------
        PIDQAResult
            Formulated technical answer with verified visual citations.
        """
        all_elements = [e for e in extraction.elements if e.type == "pid_tag"]
        if not all_elements:
            # Fallback: check all elements if type was left as text with subtype
            all_elements = [
                e
                for e in extraction.elements
                if e.subtype in ("instrument_tag", "line_number", "equipment_tag", "revision")
            ]

        if not all_elements:
            return PIDQAResult(
                question=question,
                answer=(
                    f"No P&ID tags were found in '{extraction.filename}'. Ensure the document "
                    "was ingested with the 'pid' document kind."
                ),
                citations=[],
                total_tags_found=0,
            )

        q_clean = question.strip()
        q_upper = q_clean.upper()

        # Build ID lookup map for resolving neighbor tags
        element_map: dict[str, ExtractionElement] = {
            e.element_id: e for e in all_elements if e.element_id
        }

        # Check for specific intent:
        # 1. Revision inquiry
        if any(w in q_upper for w in ("REVISION", "REV NO", "REV NUMBER", "WHICH REV")):
            rev_elements = [e for e in all_elements if e.subtype == "revision"]
            if rev_elements:
                citations = [self._make_citation(e, element_map) for e in rev_elements]
                rev_texts = ", ".join(c.tag for c in citations)
                answer = f"The drawing revision identified on '{extraction.filename}' is: {rev_texts}."
                return PIDQAResult(
                    question=question,
                    answer=answer,
                    citations=citations,
                    total_tags_found=len(citations),
                )

        # 2. Extract potential tag mentions directly from the question
        mentioned_tags = self.classifier.classify_all(q_clean)
        mentioned_tag_strings = {t.normalized_tag for t in mentioned_tags}

        # 3. Tag topology / neighbor search (e.g. "What connects to TANK-204?")
        is_topology_query = any(
            w in q_upper
            for w in (
                "CONNECT",
                "CONNECTED",
                "NEAR",
                "TOPOLOGY",
                "ATTACHED",
                "NEIGHBOR",
                "FEED",
                "DISCHARGE",
                "INLET",
                "OUTLET",
            )
        )

        matched_elements: list[ExtractionElement] = []

        if mentioned_tag_strings:
            for elem in all_elements:
                norm = self._norm(elem.text)
                if norm in mentioned_tag_strings:
                    matched_elements.append(elem)

            # If it's a topology query and we found anchor tags, include their neighbors
            if is_topology_query and matched_elements:
                anchor = matched_elements[0]
                neighbor_ids = anchor.neighbor_tag_ids or []
                neighbor_elements = [element_map[nid] for nid in neighbor_ids if nid in element_map]

                citations = [self._make_citation(anchor, element_map)]
                citations.extend(self._make_citation(n, element_map) for n in neighbor_elements)

                neighbor_desc = []
                for n in neighbor_elements:
                    conf_note = (
                        " [LOW CONFIDENCE]"
                        if n.confidence is not None and n.confidence < self.settings.low_confidence_threshold
                        else ""
                    )
                    neighbor_desc.append(f"- **{n.text}** ({n.subtype}{conf_note})")

                items_text = "\n".join(neighbor_desc) if neighbor_desc else "- None detected within proximity radius."
                answer = (
                    f"**Anchor Tag:** {anchor.text} ({anchor.subtype})\n\n"
                    f"**Spatially Associated / Connected Tags:**\n{items_text}\n\n"
                    "Visual evidence crops are attached for audit verification."
                )
                return PIDQAResult(
                    question=question,
                    answer=answer,
                    citations=citations,
                    total_tags_found=len(citations),
                )

        # 4. Filter by specific category (e.g. "List all instruments", "All pumps")
        if not matched_elements:
            if "INSTRUMENT" in q_upper or "TRANSMITTER" in q_upper or "VALVE" in q_upper:
                matched_elements = [e for e in all_elements if e.subtype == "instrument_tag"]
            elif "LINE" in q_upper or "PIPING" in q_upper:
                matched_elements = [e for e in all_elements if e.subtype == "line_number"]
            elif "EQUIPMENT" in q_upper or "PUMP" in q_upper or "TANK" in q_upper or "VESSEL" in q_upper:
                matched_elements = [e for e in all_elements if e.subtype == "equipment_tag"]
            else:
                # Substring match on tag text or loop digits
                digits = re.findall(r"\b\d{2,4}\b", q_clean)
                for elem in all_elements:
                    if any(d in elem.text for d in digits) or elem.text.upper() in q_upper:
                        matched_elements.append(elem)

        if not matched_elements:
            # Fallback to returning all summary tags if query was general
            if any(w in q_upper for w in ("TAG", "WHAT IS IN", "SUMMARY", "LIST", "DRAWING")):
                matched_elements = all_elements[:15]

        if not matched_elements:
            return PIDQAResult(
                question=question,
                answer=(
                    f"Could not find any tags matching your query '{question}' in "
                    f"'{extraction.filename}'. Available tag categories: instrument loops, "
                    "piping lines, equipment, revisions."
                ),
                citations=[],
                total_tags_found=0,
            )

        citations = [self._make_citation(e, element_map) for e in matched_elements]

        # Construct concise, informative answer with low-confidence advisories
        lines = [f"Found **{len(citations)}** relevant tag(s) in '{extraction.filename}':\n"]
        for c in citations:
            low_conf_str = " ⚠️ *(Low confidence — check crop)*" if c.is_low_confidence else ""
            conf_display = f"{c.confidence:.0%}" if c.confidence is not None else "N/A"
            neighbors_str = f" | proximate to: {', '.join(c.neighbor_tags)}" if c.neighbor_tags else ""
            continues_str = (
                f" | continues on page(s): {', '.join(str(p) for p in c.continues_on_pages)}"
                if c.continues_on_pages
                else ""
            )
            lines.append(
                f"- **{c.tag}** [{c.subtype}] — Confidence: {conf_display}{low_conf_str}{neighbors_str}{continues_str}"
            )

        lines.append("\n*Visual citations with bounding box crops are provided for verification.*")
        answer = "\n".join(lines)

        return PIDQAResult(
            question=question,
            answer=answer,
            citations=citations,
            total_tags_found=len(citations),
        )

    def _make_citation(
        self,
        elem: ExtractionElement,
        element_map: dict[str, ExtractionElement],
    ) -> PIDCitation:
        """Create a visual PIDCitation with dynamic low-confidence calculation."""
        is_low_conf = (
            elem.confidence is not None
            and elem.confidence < self.settings.low_confidence_threshold
        )
        neighbor_names = [
            element_map[nid].text
            for nid in (elem.neighbor_tag_ids or [])
            if nid in element_map
        ]

        struct_valid = (
            elem.is_structurally_valid
            if elem.is_structurally_valid is not None
            else True
        )

        return PIDCitation(
            tag=elem.text,
            subtype=elem.subtype or "unknown",
            page=elem.page,
            bbox=elem.bbox,
            confidence=elem.confidence,
            is_low_confidence=is_low_conf,
            image_path=elem.image_path,
            element_id=elem.element_id,
            neighbor_tags=neighbor_names,
            is_structurally_valid=struct_valid,
            continues_on_pages=list(elem.continues_on_pages or []),
        )

    @staticmethod
    def _norm(tag_text: str) -> str:
        return tag_text.strip().upper()
