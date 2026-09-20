"""Request/response schemas for the auth API."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=512)


class SessionInfo(BaseModel):
    user_id: str
    username: str
    role: str
