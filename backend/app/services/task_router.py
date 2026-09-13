"""Deterministic, rule-based task classification.

No LLM is used to classify tasks. Rules are ordered (first match wins) and kept
in one place so they are easy to extend. Reserved types (document/vision) exist
for future file/image inputs; their models are disabled by default in the
registry, so jobs for those types currently fail cleanly at model selection.
"""

import re

from pydantic import BaseModel

TASK_GENERAL = "general"
TASK_CODING = "coding"
TASK_DOCUMENT = "document"
TASK_VISION = "vision"


class TaskClassification(BaseModel):
    """Result of classifying a user message."""

    task_type: str
    reason: str


class TaskRule:
    """A deterministic match rule: if any keyword appears, classify as task_type."""

    def __init__(self, task_type: str, reason: str, keywords: tuple[str, ...] = (), pattern: str = "") -> None:
        self.task_type = task_type
        self.reason = reason
        self.keywords = keywords
        self.pattern = re.compile(pattern) if pattern else None

    def matches(self, text: str) -> bool:
        if self.pattern is not None and self.pattern.search(text):
            return True
        return any(keyword in text for keyword in self.keywords)


class TaskRouter:
    """Classify a user message into a task type using deterministic rules only."""

    def __init__(self) -> None:
        self._rules = (
            TaskRule(
                TASK_CODING,
                "Programming intent detected",
                (
                    "```",
                    "def ",
                    "function ",
                    "class ",
                    "import ",
                    "print(",
                    "console.log",
                    "=>",
                    "javascript",
                    "typescript",
                    "python",
                    "java ",
                    "sql ",
                    "select ",
                    "insert ",
                    "update ",
                    "delete ",
                    "debug",
                    "debugging",
                    "bug",
                    "fix this",
                    "write code",
                    "write a program",
                    "write some code",
                    "code block",
                    "code snippet",
                    "code review",
                    "code",
                    "script",
                    "refactor",
                    "regex",
                    "bash",
                    "html",
                    "css",
                    "algorithm",
                ),
            ),
            TaskRule(
                TASK_VISION,
                "Image/vision request detected",
                (
                    "image",
                    "photo",
                    "picture",
                    "screenshot",
                    "vision",
                    "see this image",
                    "look at this image",
                    "attached image",
                ),
            ),
            TaskRule(
                TASK_GENERAL,
                "Knowledge base search request detected",
                pattern=r"\b(search|query|look up|find)\b.*\b(documents?|knowledge|manuals?|files)\b",
            ),
            TaskRule(
                TASK_DOCUMENT,
                "Document processing requested",
                (
                    "docx",
                    "upload this file",
                    "report file",
                    "read this file",
                    "read the file",
                    "process this document",
                    "summarize the file",
                    "summarize this file",
                    "summarize the document",
                    "summarize this document",
                ),
                pattern=r"\b(summar|analy|read|parse|extract|review|translate|convert|draft|proofread|check)\w*\b.*\b(pdf|docx|document|file|spreadsheet|sheet)\b",
            ),
        )

    def classify(self, message: str) -> TaskClassification:
        text = (message or "").lower()
        for rule in self._rules:
            if rule.matches(text):
                return TaskClassification(task_type=rule.task_type, reason=rule.reason)
        return TaskClassification(
            task_type=TASK_GENERAL,
            reason="No specific intent detected",
        )
