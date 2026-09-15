import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import String

from app.models import Complaint
from app.schemas.risk import (
    Priority,
    RiskAssessment,
    Severity,
    clean_strings,
    norm_priority,
    norm_severity,
)

_LIMITS = {
    c.name: c.type.length
    for c in Complaint.__table__.columns
    if isinstance(c.type, String) and c.type.length
}
_DATE_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%d %B %Y",
    "%d %b %Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%B %Y",
    "%b %Y",
    "%m/%Y",
    "%Y-%m",
)


def parse_date(value: Any) -> date | None:
    if value is None or isinstance(value, date):
        return value
    text = re.sub(r"^(?:mfg|mfd|exp|expiry|retest)\b[\s.:]*", "", str(value).strip(), flags=re.I)
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_quantity(value: Any) -> Decimal | None:
    if value is None:
        return None
    match = re.search(r"\d[\d,]*(?:\.\d+)?", str(value))
    if not match:
        return None
    try:
        number = Decimal(match.group().replace(",", "")).quantize(Decimal("0.001"))
    except InvalidOperation:
        return None
    return number if 0 <= number < Decimal("1e9") else None


class ExtractedFields(BaseModel):
    complaint_source: str | None = None
    customer_name: str | None = None
    product_name: str | None = None
    product_strength_grade: str | None = None
    batch_lot_number: str | None = None
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    quantity_affected: Decimal | None = None
    quantity_unit: str | None = None
    complaint_type: str | None = None
    complaint_date: date | None = None
    description: str | None = None
    initial_severity: Severity | None = None
    priority: Priority | None = None

    @model_validator(mode="before")
    @classmethod
    def _clean(cls, data: Any) -> Any:
        return clean_strings(data, _LIMITS)

    @field_validator("manufacturing_date", "expiry_date", "complaint_date", mode="before")
    @classmethod
    def _lenient_date(cls, value: Any) -> date | None:
        return parse_date(value)

    @field_validator("quantity_affected", mode="before")
    @classmethod
    def _lenient_quantity(cls, value: Any) -> Decimal | None:
        return parse_quantity(value)

    @field_validator("initial_severity", mode="before")
    @classmethod
    def _norm_severity(cls, value: Any) -> str | None:
        return norm_severity(value)

    @field_validator("priority", mode="before")
    @classmethod
    def _norm_priority(cls, value: Any) -> str | None:
        return norm_priority(value)


class ExtractTextIn(BaseModel):
    text: str = Field(min_length=20, max_length=200_000)


class IntakeResult(BaseModel):
    fields: ExtractedFields
    risk: RiskAssessment
    missing_fields: list[str]
    source_text: str


class IntakeEvent(BaseModel):
    progress: int | None = None
    message: str | None = None
    result: IntakeResult | None = None
    error: str | None = None
