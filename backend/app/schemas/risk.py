import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Severity = Literal["Critical", "Major", "Minor"]
Priority = Literal["High", "Medium", "Low"]

_SEVERITY = {
    "critical": "Critical",
    "major": "Major",
    "high": "Major",
    "minor": "Minor",
    "low": "Minor",
}
_PRIORITY = {
    "high": "High",
    "urgent": "High",
    "critical": "High",
    "medium": "Medium",
    "moderate": "Medium",
    "normal": "Medium",
    "low": "Low",
}
_NULL_WORDS = {"", "null", "none", "n/a", "na", "unknown", "not specified", "not mentioned"}


def norm_severity(value: Any) -> str | None:
    return _SEVERITY.get(str(value).strip().lower()) if value is not None else None


def norm_priority(value: Any) -> str | None:
    return _PRIORITY.get(str(value).strip().lower()) if value is not None else None


def clean_strings(data: Any, limits: dict[str, int] | None = None) -> Any:
    if not isinstance(data, dict):
        return data
    out: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, str):
            value = re.sub(r"[ \t]+", " ", value).strip()
            if value.lower() in _NULL_WORDS:
                value = None
            elif limits and key in limits:
                value = value[: limits[key]]
        out[key] = value
    return out


class RiskAssessment(BaseModel):
    severity: Severity | None = None
    priority: Priority | None = None
    rationale: str = ""
    risk_factors: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _clean(cls, data: Any) -> Any:
        return clean_strings(data)

    @field_validator("severity", mode="before")
    @classmethod
    def _norm_severity(cls, value: Any) -> str | None:
        return norm_severity(value)

    @field_validator("priority", mode="before")
    @classmethod
    def _norm_priority(cls, value: Any) -> str | None:
        return norm_priority(value)
