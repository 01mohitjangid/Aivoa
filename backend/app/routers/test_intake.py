import json

from fastapi.testclient import TestClient

from app.main import app
from app.routers import intake as intake_router
from app.schemas.intake import ExtractedFields, IntakeEvent, IntakeResult, RiskAssessment

client = TestClient(app)


def fake_run_intake(raw_text: str):
    yield IntakeEvent(progress=15, message="working")
    yield IntakeEvent(
        result=IntakeResult(
            fields=ExtractedFields(customer_name="Acme"),
            risk=RiskAssessment(severity="Minor", priority="Low"),
            missing_fields=["batch_lot_number"],
            source_text=raw_text,
        )
    )


def lines(response):
    return [json.loads(line) for line in response.text.splitlines() if line]


def test_text_and_upload_routes_stream_ndjson_events(monkeypatch):
    monkeypatch.setattr(intake_router, "run_intake", fake_run_intake)

    text = "Customer reports discoloured tablets in batch MF-2409-114."
    res = client.post("/api/intake/extract", json={"text": text})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    events = lines(res)
    assert events[0] == {"progress": 15, "message": "working"}
    assert events[1]["result"]["fields"]["customer_name"] == "Acme"
    assert events[1]["result"]["source_text"] == text

    res = client.post("/api/intake/upload", files={"file": ("c.txt", text.encode(), "text/plain")})
    assert res.status_code == 200 and lines(res)[-1]["result"]["source_text"] == text

    assert client.post("/api/intake/extract", json={"text": "too short"}).status_code == 422
    assert (
        client.post(
            "/api/intake/upload", files={"file": ("x.png", b"1234", "image/png")}
        ).status_code
        == 415
    )
    corrupt = client.post(
        "/api/intake/upload", files={"file": ("x.pdf", b"garbage", "application/pdf")}
    )
    assert corrupt.status_code == 422 and corrupt.json()["detail"] == "Could not read the document"
    big = b"a" * (10 * 1024 * 1024 + 1)
    assert (
        client.post(
            "/api/intake/upload", files={"file": ("big.txt", big, "text/plain")}
        ).status_code
        == 413
    )


def test_failure_inside_the_graph_is_reported_in_band(monkeypatch):
    def boom(raw_text):
        yield IntakeEvent(progress=15, message="working")
        raise RuntimeError("GROQ_API_KEY is not set")

    monkeypatch.setattr(intake_router, "run_intake", boom)
    events = lines(client.post("/api/intake/extract", json={"text": "x" * 40}))
    assert events[-1] == {"error": "AI extraction failed: GROQ_API_KEY is not set"}
