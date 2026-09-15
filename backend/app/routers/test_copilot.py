from fastapi.testclient import TestClient

from app.main import app
from app.routers import copilot as copilot_router

client = TestClient(app)


def test_chat_returns_reply_and_reports_llm_failures(monkeypatch):
    monkeypatch.setattr(copilot_router, "run_copilot", lambda req: f"echo: {req.message}")
    res = client.post("/api/copilot/chat", json={"message": "Is this critical?"})
    assert res.status_code == 200 and res.json() == {"reply": "echo: Is this critical?"}

    assert client.post("/api/copilot/chat", json={"message": ""}).status_code == 422

    def boom(req):
        raise RuntimeError("GROQ_API_KEY is not set")

    monkeypatch.setattr(copilot_router, "run_copilot", boom)
    res = client.post("/api/copilot/chat", json={"message": "hi"})
    assert res.status_code == 502 and "GROQ_API_KEY" in res.json()["detail"]
