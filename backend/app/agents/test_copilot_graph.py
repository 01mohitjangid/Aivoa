from types import SimpleNamespace

from app.agents import copilot_graph as graph_module
from app.agents.copilot_graph import answer, ground, run_copilot
from app.schemas.copilot import ChatIn


class FakeLLM:
    def __init__(self):
        self.messages = None

    def invoke(self, messages):
        self.messages = messages
        return SimpleNamespace(
            content="## Next step\n**Quarantine batch MF-2409-114** and open an investigation."
        )


def test_ground_builds_context_and_answer_threads_history(monkeypatch):
    llm = FakeLLM()
    monkeypatch.setattr(graph_module, "get_llm", lambda **_: llm)
    request = ChatIn(
        message="What should we do first?",
        history=[
            {"role": "user", "content": "Which batch is affected?"},
            {"role": "assistant", "content": "Batch MF-2409-114."},
        ],
        complaint={"batch_lot_number": "MF-2409-114", "customer_name": "", "description": "x"},
        source_text="Subject: discoloured tablets",
        risk={"severity": "Major", "priority": "High", "rationale": "r", "risk_factors": []},
    )
    state = {"request": request.model_dump(mode="json")}

    context = ground(state)["context"]
    assert '"batch_lot_number": "MF-2409-114"' in context
    assert "customer_name" not in context
    assert "AI RISK ASSESSMENT" in context and "SOURCE DOCUMENT" in context
    state["context"] = context

    assert (
        answer(state)["answer"]
        == "Next step\nQuarantine batch MF-2409-114 and open an investigation."
    )
    roles = [type(m).__name__ for m in llm.messages]
    assert roles == ["SystemMessage", "HumanMessage", "AIMessage", "HumanMessage"]
    assert "MF-2409-114" in llm.messages[0].content
    assert llm.messages[-1].content == "What should we do first?"

    assert run_copilot(ChatIn(message="hi")).startswith("Next step\nQuarantine")
    assert "(empty - nothing extracted or typed yet)" in llm.messages[0].content
