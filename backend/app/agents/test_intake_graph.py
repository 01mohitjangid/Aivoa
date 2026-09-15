import json
from types import SimpleNamespace

import pytest

from app.agents import intake_graph as graph_module
from app.agents.intake_graph import (
    assess_risk,
    check_completeness,
    extract_fields,
    run_intake,
)

EXTRACT_REPLY = """Here is the JSON:
```json
{"complaint_source": "email", "customer_name": "  MedPharma Distributors Ltd ",
 "product_name": "Metformin HCl Tablets", "product_strength_grade": "500 mg",
 "batch_lot_number": "MF-2409-114", "manufacturing_date": "MFG 03/2026",
 "expiry_date": "February 2028", "quantity_affected": "1,200 strips",
 "quantity_unit": "blister strips", "complaint_type": "Physical Defect",
 "complaint_date": "1 September 2026", "description": "Brown spots on ~15% of tablets.",
 "initial_severity": "high", "priority": "unknown"}
```"""
RISK_REPLY = json.dumps(
    {
        "severity": "MAJOR",
        "priority": "urgent",
        "rationale": "Discolouration suggests degradation; product is on the market.",
        "risk_factors": ["visible defect", "distributed batch"],
    }
)


class FakeLLM:
    def __init__(self, replies):
        self.replies = list(replies)
        self.prompts = []

    def invoke(self, messages):
        self.prompts.append(messages)
        return SimpleNamespace(content=self.replies.pop(0))


@pytest.fixture
def fake_llm(monkeypatch):
    llm = FakeLLM([EXTRACT_REPLY, RISK_REPLY])
    monkeypatch.setattr(graph_module, "get_llm", lambda **_: llm)
    return llm


def test_nodes_normalize_model_output(fake_llm):
    state = {"raw_text": "Complaint email body..."}

    fields = extract_fields(state)["fields"]
    assert fields["customer_name"] == "MedPharma Distributors Ltd"
    assert fields["manufacturing_date"] == "2026-03-01"
    assert fields["expiry_date"] == "2028-02-01"
    assert fields["complaint_date"] == "2026-09-01"
    assert fields["quantity_affected"] == "1200.000"
    assert fields["quantity_unit"] == "blister strips"
    assert fields["initial_severity"] == "Major"
    assert fields["priority"] is None

    state["fields"] = fields
    risk = assess_risk(state)["risk"]
    assert risk == {
        "severity": "Major",
        "priority": "High",
        "rationale": "Discolouration suggests degradation; product is on the market.",
        "risk_factors": ["visible defect", "distributed batch"],
    }
    assert "MF-2409-114" in fake_llm.prompts[1][1].content

    fields["batch_lot_number"] = None
    assert check_completeness({"fields": fields})["missing_fields"] == ["batch_lot_number"]


def test_run_intake_streams_progress_then_result(fake_llm):
    events = list(run_intake("Complaint email body..."))

    assert [e.progress for e in events[:-1]] == [15, 60, 85, 100]
    result = events[-1].result
    assert result is not None and events[-1].progress is None
    assert result.fields.initial_severity == "Major" and result.fields.priority == "High"
    assert result.fields.batch_lot_number == "MF-2409-114"
    assert result.missing_fields == []
    assert result.source_text == "Complaint email body..."


def test_non_json_reply_raises(monkeypatch):
    monkeypatch.setattr(graph_module, "get_llm", lambda **_: FakeLLM(["I cannot help."]))
    with pytest.raises(ValueError, match="no JSON object"):
        extract_fields({"raw_text": "x"})
