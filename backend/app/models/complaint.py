from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(
        String(32), default="pending_triage", server_default="pending_triage"
    )

    complaint_source: Mapped[str | None] = mapped_column(String(64))
    customer_name: Mapped[str | None] = mapped_column(String(255))

    product_name: Mapped[str | None] = mapped_column(String(255))
    product_strength_grade: Mapped[str | None] = mapped_column(String(128))
    batch_lot_number: Mapped[str | None] = mapped_column(String(64), index=True)
    manufacturing_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    quantity_affected: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    quantity_unit: Mapped[str] = mapped_column(String(16), default="kg", server_default="kg")

    complaint_type: Mapped[str | None] = mapped_column(String(64))
    complaint_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text)

    initial_severity: Mapped[str | None] = mapped_column(String(16))
    priority: Mapped[str | None] = mapped_column(String(16))

    source_text: Mapped[str | None] = mapped_column(Text)
    ai_risk: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
