"""Deterministic, rule-based task classification.

No LLM is used to classify tasks. Rules are ordered (first match wins) and kept
in one place so they are easy to extend. Reserved types (document/vision) exist
for future file/image inputs; their models are disabled by default in the
registry, so jobs for those types currently fail cleanly at model selection.
"""

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

    def __init__(self, task_type: str, reason: str, keywords: tuple[str, ...]) -> None:
        self.task_type = task_type
        self.reason = reason
        self.keywords = keywords

    def matches(self, text: str) -> bool:
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
                TASK_DOCUMENT,
                "Document processing requested",
                (
                    "document",
                    "docx",
                    "pdf",
                    "spreadsheet",
                    "excel",
                    "report file",
                    "upload this",
                    "summarize this file",
                    "read this file",
                ),
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
