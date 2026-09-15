import os
from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.complaint import ComplaintCreate


def test_blank_fields_dropped_values_stripped_and_limits_enforced():
    c = ComplaintCreate(
        description="  Tablets discoloured in blister ",
        customer_name="   ",
        product_name="  Metformin HCl  ",
        quantity_unit="",
        quantity_affected="12.5",
        complaint_date="2026-09-01",
    )
    assert c.customer_name is None
    assert c.product_name == "Metformin HCl"
    assert c.description == "Tablets discoloured in blister"
    assert c.quantity_unit == "kg"
    assert c.quantity_affected == Decimal("12.5")
    assert c.complaint_date == date(2026, 9, 1)

    for bad in (
        {"description": "   "},
        {"description": "x", "initial_severity": "Urgent"},
        {"description": "x", "customer_name": "n" * 256},
        {"description": "x", "quantity_affected": "-1"},
        {"description": "x", "quantity_affected": "1.2345"},
    ):
        with pytest.raises(ValidationError):
            ComplaintCreate(**bad)


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL not set")
def test_create_list_get_roundtrip_against_test_db():
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.db import get_db
    from app.main import app
    from app.models import Complaint

    test_session = sessionmaker(bind=create_engine(TEST_DATABASE_URL), expire_on_commit=False)

    def override_db():
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    created_id = None
    try:
        created = client.post(
            "/api/complaints",
            json={
                "description": "roundtrip",
                "batch_lot_number": "RT-001",
                "customer_name": "",
                "ai_risk": {"severity": "major", "priority": "High", "rationale": "r"},
            },
        )
        assert created.status_code == 201, created.text
        body = created.json()
        created_id = body["id"]
        assert body["status"] == "pending_triage" and body["customer_name"] is None
        assert body["ai_risk"] == {
            "severity": "Major",
            "priority": "High",
            "rationale": "r",
            "risk_factors": [],
        }

        assert client.get(f"/api/complaints/{created_id}").json()["batch_lot_number"] == "RT-001"
        assert any(c["id"] == created_id for c in client.get("/api/complaints").json())
        assert client.get("/api/complaints/999999").status_code == 404
        updated = client.put(
            f"/api/complaints/{created_id}", json={"description": "edited", "priority": "Low"}
        )
        assert updated.status_code == 200 and updated.json()["priority"] == "Low"
        assert updated.json()["batch_lot_number"] is None
        assert client.put("/api/complaints/999999", json={"description": "x"}).status_code == 404
        assert client.post("/api/complaints", json={"description": ""}).status_code == 422
    finally:
        app.dependency_overrides.clear()
        if created_id is not None:
            with test_session() as db:
                db.delete(db.get(Complaint, created_id))
                db.commit()
