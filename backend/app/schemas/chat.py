"""Request/response schemas for the chat API."""

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    """Incoming chat message submitted as a job."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=64_000,
        description="The user's message sent to the local model.",
    )
    task_type: str = Field(
        default="general",
        max_length=64,
        description="Optional task category (routing is not implemented yet).",
    )
    priority: int = Field(
        default=0,
        ge=0,
        le=1000,
        description="Optional job priority (scheduling not implemented yet).",
    )

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message must not be empty or whitespace-only")
        return stripped
