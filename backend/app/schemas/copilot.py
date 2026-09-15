from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.intake import ExtractedFields, RiskAssessment


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    complaint: ExtractedFields = Field(default_factory=ExtractedFields)
    source_text: str | None = Field(None, max_length=60_000)
    risk: RiskAssessment | None = None


class ChatOut(BaseModel):
    reply: str
