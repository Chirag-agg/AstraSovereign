"""Request/response schemas for the chat API."""

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    """Incoming user message."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=64_000,
        description="The user's message sent to the local model.",
    )

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message must not be empty or whitespace-only")
        return stripped


class ChatResponse(BaseModel):
    """Successful chat response returned to the client."""

    response: str
    model: str
    status: str = "success"
