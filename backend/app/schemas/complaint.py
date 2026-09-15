from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.risk import Priority, RiskAssessment, Severity


class ComplaintBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    complaint_source: str | None = Field(None, max_length=64)
    customer_name: str | None = Field(None, max_length=255)
    product_name: str | None = Field(None, max_length=255)
    product_strength_grade: str | None = Field(None, max_length=128)
    batch_lot_number: str | None = Field(None, max_length=64)
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    quantity_affected: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=3)
    quantity_unit: str = Field("kg", max_length=16)
    complaint_type: str | None = Field(None, max_length=64)
    complaint_date: date | None = None
    description: str = Field(min_length=1)
    initial_severity: Severity | None = None
    priority: Priority | None = None
    source_text: str | None = None
    ai_risk: RiskAssessment | None = None


class ComplaintCreate(ComplaintBase):
    @model_validator(mode="before")
    @classmethod
    def drop_blank_strings(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if not (isinstance(v, str) and not v.strip())}
        return data


class ComplaintOut(ComplaintBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    created_at: datetime
