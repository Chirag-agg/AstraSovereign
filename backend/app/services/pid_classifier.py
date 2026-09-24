"""P&ID tag classification and normalization service.

Classifies recognized text fragments from engineering drawings into standard
P&ID tag categories (line numbers, equipment tags, instrument loops, and
revisions) according to ISA-5.1 standards and project conventions.

Deterministic precedence is enforced via ``pid_tag_patterns.yaml`` so that
ambiguous text (for example, ``TK-200`` matching both equipment and instrument
tag rules) resolves unambiguously to the highest-priority classification.
"""

from dataclasses import dataclass, field
import logging
from pathlib import Path
import re
from typing import Any, Optional
import yaml

logger = logging.getLogger("app.pid_classifier")

DEFAULT_PATTERNS_PATH = Path(__file__).resolve().parent.parent / "config" / "pid_tag_patterns.yaml"


class TagClassificationError(Exception):
    """Raised when pattern configuration fails to load or compile."""


@dataclass(frozen=True)
class TagClassificationResult:
    """The deterministic classification of a recognized P&ID text tag."""

    subtype: str  # "line_number" | "equipment_tag" | "instrument_tag" | "revision"
    normalized_tag: str
    matched_text: str
    groups: dict[str, str] = field(default_factory=dict)
    is_structurally_valid: bool = True
    validation_reason: Optional[str] = None


# ANSI/ISA-5.1 Instrumentation Identification Reference (Table 1)
ISA_FIRST_LETTERS = {
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
    "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
}

ISA_FIRST_MODIFIERS = {"D", "F", "J", "Q", "S", "X"}

ISA_SUCCEEDING_LETTERS = {
    "A", "C", "E", "G", "I", "K", "R", "S", "T", "V", "W", "Y", "Z",
}

def _build_valid_isa_prefixes() -> set[str]:
    """Generate the set of recognized ANSI/ISA-5.1 instrument function letter prefixes."""
    variables = [
        "P", "PD", "T", "TD", "F", "FQ", "FD", "FF", "L", "LD",
        "A", "V", "Z", "W", "S", "E", "I", "J", "K", "R", "H", "X", "U",
    ]
    functions = ["T", "I", "C", "V", "S", "E", "G", "R", "Y", "A"]
    valid = set()

    for var in variables:
        for fn in functions:
            valid.add(f"{var}{fn}")
            if fn in ("S", "A"):
                for mod in ("H", "L", "HH", "LL"):
                    valid.add(f"{var}{fn}{mod}")
            if fn == "I":
                valid.add(f"{var}IC")
                valid.add(f"{var}IT")
                valid.add(f"{var}IR")
            if fn == "C":
                valid.add(f"{var}CV")

    # Safety valves, regulators, and specialized emergency instrument combinations
    special_codes = [
        "PSV", "PSE", "TSV", "TSE", "FSV", "LSV", "BDV", "SDV", "ESV",
        "HCV", "HIC", "ZSO", "ZSC", "SOV", "TW", "PCV", "TCV", "FCV",
        "LCV", "PRV", "TRV", "FRV", "LRV", "PDIC", "TDIC", "FDIC", "LDIC",
        "PDIT", "TDIT", "FDIT", "LDIT", "FIT", "LIT", "TIT", "PIT",
    ]
    for code in special_codes:
        valid.add(code)

    return valid


NON_INSTRUMENT_ACRONYMS = {
    "PID", "P&ID", "DWG", "REV", "REVISION", "ISO", "AREA",
    "SHT", "SHEET", "PROJ", "PROJECT", "DRAWING", "SPEC",
    "DIAG", "UNIT", "TAG", "TITLE", "DOC", "NO", "SIZE", "ID",
}


VALID_ISA_PREFIXES = _build_valid_isa_prefixes()


def is_valid_isa_prefix(prefix: str) -> bool:
    """Verify whether an instrument prefix conforms to ANSI/ISA-5.1 standards."""
    if not prefix:
        return False
    clean = prefix.strip().upper()
    if clean in NON_INSTRUMENT_ACRONYMS:
        return False
    return clean in VALID_ISA_PREFIXES


EQUIPMENT_PREFIX_MEANINGS = {
    "TANK": "Storage Tank",
    "TK": "Storage Tank",
    "P": "Pump",
    "E": "Heat Exchanger",
    "HX": "Heat Exchanger",
    "C": "Compressor / Column",
    "V": "Vessel / Drum",
    "R": "Chemical Reactor",
    "K": "Compressor / Blower",
    "B": "Boiler / Blower",
}


def validate_structural_tag(
    subtype: str,
    groups: dict[str, str],
    matched_text: str,
) -> tuple[bool, Optional[str]]:
    """Validate a pattern-matched tag against domain-specific engineering rules.

    Parameters
    ----------
    subtype : str
        The tag category ("line_number", "instrument_tag", "equipment_tag", "revision").
    groups : dict[str, str]
        Extracted regex capture groups.
    matched_text : str
        Raw string that matched the pattern.

    Returns
    -------
    tuple[bool, Optional[str]]
        (is_structurally_valid, validation_reason_if_invalid)
    """
    if subtype == "line_number":
        size = groups.get("size")
        service = groups.get("service")
        seq = groups.get("sequence")
        piping_class = groups.get("piping_class")

        missing = []
        if not size:
            missing.append("size")
        if not service:
            missing.append("service code")
        if not seq:
            missing.append("sequence number")
        if not piping_class:
            missing.append("piping spec class")

        if missing:
            return False, f"Incomplete line number (missing required segments: {', '.join(missing)})"

        try:
            size_clean = size.strip().strip('"').strip("'")
            size_val = float(size_clean)
            if size_val <= 0:
                return False, f"Invalid nominal pipe size: {size}"
        except ValueError:
            return False, f"Non-numeric nominal pipe size: {size}"

        return True, None

    elif subtype == "instrument_tag":
        func = groups.get("function", "").strip().upper()
        if not func:
            return False, "Missing instrument function prefix"
        if func in NON_INSTRUMENT_ACRONYMS:
            return False, f"Prefix '{func}' is a drawing/document metadata acronym, not an instrument function"
        if not is_valid_isa_prefix(func):
            return False, f"Prefix '{func}' does not conform to ANSI/ISA-5.1 instrument function standard"
        return True, None

    elif subtype == "equipment_tag":
        eq_type = groups.get("equipment_type", "")
        seq = groups.get("sequence", "")
        if not eq_type or not seq:
            return False, "Incomplete equipment tag (missing type or sequence)"
        eq_upper = eq_type.upper()
        if eq_upper not in EQUIPMENT_PREFIX_MEANINGS:
            return (
                False,
                f"Equipment prefix '{eq_type}' is not a recognized process equipment category "
                f"(valid: {', '.join(sorted(EQUIPMENT_PREFIX_MEANINGS.keys()))})",
            )
        return True, None

    elif subtype == "revision":
        rev_id = groups.get("revision_id", "")
        if not rev_id:
            return False, "Incomplete revision tag (missing revision identifier)"
        return True, None

    return True, None


class PIDTagClassifier:
    """Classifies and normalizes text into P&ID tag entities."""

    def __init__(self, patterns_path: Optional[Path] = None) -> None:
        """Initialize the classifier by loading patterns and compiling regexes.

        Parameters
        ----------
        patterns_path : Optional[Path]
            Custom path to the YAML patterns file. Defaults to
            ``backend/app/config/pid_tag_patterns.yaml``.
        """
        self._patterns_path = Path(patterns_path) if patterns_path else DEFAULT_PATTERNS_PATH
        self._precedence: list[str] = []
        self._patterns: dict[str, re.Pattern] = {}
        self._pattern_metadata: dict[str, dict[str, Any]] = {}
        self._load_patterns()

    def _load_patterns(self) -> None:
        """Load pattern configuration from YAML and compile regular expressions."""
        if not self._patterns_path.is_file():
            logger.warning(
                "pid_patterns_file_missing",
                extra={"path": str(self._patterns_path)},
            )
            # Safe fallbacks if YAML is unreadable or missing
            self._precedence = ["line_number", "equipment_tag", "instrument_tag", "revision"]
            raw_patterns = {
                "line_number": r'\b(\d{1,2}(?:\.\d+)?)"?-([A-Z0-9]+)-([0-9]{3,5})-([A-Z0-9]+)\b',
                "equipment_tag": r'\b(TANK|TK|P|E|C|V|R|HX|K|B)-([0-9]{2,4}[A-Z]?)\b',
                "instrument_tag": r'\b([A-Z]{2,4})-?([0-9]{2,4}[A-Z]?)\b',
                "revision": r'\b(?:REV|REVISION)[\s.:#-]*([A-Z0-9]{1,3})\b',
            }
            self._patterns = {k: re.compile(v, re.IGNORECASE) for k, v in raw_patterns.items()}
            return

        try:
            with open(self._patterns_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except Exception as exc:
            raise TagClassificationError(f"Failed to read patterns file: {exc}") from exc

        self._precedence = list(data.get("precedence") or [])
        raw_patterns_dict = data.get("patterns") or {}

        for name, spec in raw_patterns_dict.items():
            pattern_str = spec.get("regex")
            if not pattern_str:
                continue
            try:
                self._patterns[name] = re.compile(pattern_str, re.IGNORECASE)
                self._pattern_metadata[name] = spec
            except re.error as exc:
                raise TagClassificationError(f"Invalid regex for pattern '{name}': {exc}") from exc

        # Guarantee precedence includes all loaded patterns in case YAML omitted any
        for name in self._patterns:
            if name not in self._precedence:
                self._precedence.append(name)

    @property
    def precedence(self) -> list[str]:
        """Return the active precedence order."""
        return list(self._precedence)

    def classify(self, text: str) -> Optional[TagClassificationResult]:
        """Classify a text string into a single P&ID tag entity.

        Tests the text against each pattern in strict precedence order. Returns
        the first matching tag classification, or ``None`` if no patterns match.

        Parameters
        ----------
        text : str
            The raw string from OCR or text extraction.

        Returns
        -------
        Optional[TagClassificationResult]
            The matched classification and normalized tag, or None.
        """
        if not text:
            return None

        clean_text = self._clean_ocr_text(text)
        for subtype in self._precedence:
            pattern = self._patterns.get(subtype)
            if pattern is None:
                continue
            for match in pattern.finditer(clean_text):
                if subtype == "instrument_tag":
                    prefix = match.group(1).upper()
                    if prefix in NON_INSTRUMENT_ACRONYMS:
                        continue
                matched_str = match.group(0)
                named_groups = {}
                meta = self._pattern_metadata.get(subtype, {})
                group_defs = meta.get("groups", {})
                for group_name, idx in group_defs.items():
                    try:
                        named_groups[group_name] = match.group(idx)
                    except (IndexError, TypeError):
                        pass

                normalized = self._normalize(subtype, match)
                is_valid, reason = validate_structural_tag(subtype, named_groups, matched_str)
                return TagClassificationResult(
                    subtype=subtype,
                    normalized_tag=normalized,
                    matched_text=matched_str,
                    groups=named_groups,
                    is_structurally_valid=is_valid,
                    validation_reason=reason,
                )

        return None

    def classify_all(self, text: str) -> list[TagClassificationResult]:
        """Find and classify all distinct P&ID tags present in a text string.

        Useful when an OCR line contains multiple tags (e.g. ``LT-204 and FT-204``).

        Parameters
        ----------
        text : str
            The raw text string to scan.

        Returns
        -------
        list[TagClassificationResult]
            All matched classifications in order of appearance.
        """
        if not text:
            return []

        results: list[TagClassificationResult] = []
        # Find spans matched by any pattern respecting precedence
        clean_text = self._clean_ocr_text(text)
        matched_spans: list[tuple[int, int]] = []

        for subtype in self._precedence:
            pattern = self._patterns.get(subtype)
            if pattern is None:
                continue
            for match in pattern.finditer(clean_text):
                if subtype == "instrument_tag":
                    prefix = match.group(1).upper()
                    if prefix in NON_INSTRUMENT_ACRONYMS:
                        continue
                start, end = match.span()
                # Check for overlap with existing higher-precedence matches
                overlaps = any(
                    max(start, prev_start) < min(end, prev_end)
                    for prev_start, prev_end in matched_spans
                )
                if overlaps:
                    continue

                matched_spans.append((start, end))
                named_groups = {}
                meta = self._pattern_metadata.get(subtype, {})
                group_defs = meta.get("groups", {})
                for group_name, idx in group_defs.items():
                    try:
                        named_groups[group_name] = match.group(idx)
                    except (IndexError, TypeError):
                        pass

                is_valid, reason = validate_structural_tag(subtype, named_groups, match.group(0))
                results.append(
                    TagClassificationResult(
                        subtype=subtype,
                        normalized_tag=self._normalize(subtype, match),
                        matched_text=match.group(0),
                        groups=named_groups,
                        is_structurally_valid=is_valid,
                        validation_reason=reason,
                    )
                )

        # Sort by appearance in original string
        return sorted(results, key=lambda r: text.find(r.matched_text))

    @staticmethod
    def _normalize(subtype: str, match: re.Match) -> str:
        """Produce a canonical normalized tag identifier.

        Standardizes punctuation, removes stray quotes or spaces, and ensures
        consistent casing.
        """
        raw = match.group(0).strip()
        if subtype == "instrument_tag":
            # Ensure hyphen between prefix and loop number (e.g. PT204A -> PT-204A)
            prefix, loop = match.group(1).upper(), match.group(2).upper()
            return f"{prefix}-{loop}"
        elif subtype == "line_number":
            # Canonicalize: SIZE"-SERVICE-SEQUENCE[-CLASS]
            size = match.group(1).strip().strip('"').strip("'")
            service = match.group(2).upper()
            seq = match.group(3)
            raw_class = match.group(4) if match.lastindex and match.lastindex >= 4 else None
            if raw_class:
                return f'{size}"-{service}-{seq}-{raw_class.upper()}'
            return f'{size}"-{service}-{seq}'
        elif subtype == "equipment_tag":
            eq_type = match.group(1).upper()
            seq = match.group(2).upper()
            return f"{eq_type}-{seq}"
        elif subtype == "revision":
            rev_id = match.group(1).upper()
            return f"REV {rev_id}"

        return raw.upper()

    @staticmethod
    def _clean_ocr_text(text: str) -> str:
        """Normalize raw OCR text: strip unicode primes, curly quotes, and extra whitespace."""
        if not text:
            return ""
        return (
            text.replace("\u2032", "'")
            .replace("\u2033", '"')
            .replace("‘", "'")
            .replace("’", "'")
            .replace("“", '"')
            .replace("”", '"')
            .strip()
        )
