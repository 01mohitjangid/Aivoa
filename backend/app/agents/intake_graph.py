import json
from collections.abc import Iterator
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.agents.llm import get_llm
from app.schemas.intake import ExtractedFields, IntakeEvent, IntakeResult, RiskAssessment

MAX_CHARS = 60_000
LONG_CONTEXT_CHARS = 12_000

REQUIRED_FIELDS = (
    "customer_name",
    "product_name",
    "batch_lot_number",
    "complaint_type",
    "complaint_date",
    "description",
)

COMPLAINT_SOURCES = [
    "Email",
    "Phone",
    "Letter",
    "Distributor Portal",
    "Field Sales",
    "Regulatory Authority",
    "Internal",
]
COMPLAINT_TYPES = [
    "Physical Defect",
    "Packaging Defect",
    "Labeling Error",
    "Contamination / Foreign Matter",
    "Potency / Assay OOS",
    "Dissolution Failure",
    "Stability / Degradation",
    "Adverse Event",
    "Shipping / Storage Damage",
    "Documentation / CoA",
    "Counterfeit Suspicion",
    "Other",
]

EXTRACT_SYSTEM = f"""You are the QA intake assistant of a pharmaceutical manufacturer that makes
APIs (active pharmaceutical ingredients) and FDFs (finished dosage forms).
Read the customer complaint and extract the fields for the complaint log.

Return ONLY a JSON object with exactly these keys. Use null when the text does not say.
{{
  "complaint_source": one of {json.dumps(COMPLAINT_SOURCES)} (an email message is "Email"),
  "customer_name": the company or person raising the complaint,
  "product_name": the product or API name,
  "product_strength_grade": dosage strength (e.g. "500 mg") or API grade (e.g. "EP, micronized"),
  "batch_lot_number": the batch or lot number exactly as written,
  "manufacturing_date": "YYYY-MM-DD" (use day 01 when only the month is given),
  "expiry_date": "YYYY-MM-DD" (expiry or retest date),
  "quantity_affected": number only,
  "quantity_unit": unit of that number, e.g. "kg", "tablets", "vials", "cartons",
  "complaint_type": one of {json.dumps(COMPLAINT_TYPES)},
  "complaint_date": "YYYY-MM-DD" the date the complaint was raised,
  "description": 2-4 factual sentences: the defect observed, where, how many, and any impact
}}
Never guess values that are not in the text. Do not include severity or priority."""

RISK_SYSTEM = """You are the QA risk reviewer of a pharmaceutical manufacturer. Assess the customer
complaint following GMP complaint handling (21 CFR 211.198, EU GMP Chapter 8, ICH Q9):
- Critical: potential patient harm — contamination, foreign particles in injectables,
  wrong product or label mix-up, sterility failure, potency far out of specification,
  suspected counterfeit. Usually triggers recall evaluation and regulatory reporting.
- Major: a quality defect that affects product performance or GMP compliance without direct
  patient harm — assay or dissolution OOS, significant packaging integrity issues,
  repeated defects across batches, CoA discrepancies.
- Minor: cosmetic or isolated defects with no impact on quality, safety or efficacy.
Priority follows severity and urgency: product still on the market, quantity distributed,
patient exposure, regulatory attention.

Return ONLY JSON:
{"severity": "Critical|Major|Minor", "priority": "High|Medium|Low",
 "rationale": "2-3 sentences a QA manager can act on",
 "risk_factors": ["short phrase", "..."]}"""


class IntakeState(TypedDict, total=False):
    raw_text: str
    fields: dict[str, Any]
    risk: dict[str, Any]
    missing_fields: list[str]


def _ask_json(system: str, user: str) -> dict[str, Any]:
    reply = get_llm(long_context=len(user) > LONG_CONTEXT_CHARS).invoke(
        [SystemMessage(content=system), HumanMessage(content=user)]
    )
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"model returned no JSON object: {text[:200]!r}")
    return json.loads(text[start : end + 1])


def extract_fields(state: IntakeState) -> IntakeState:
    data = _ask_json(EXTRACT_SYSTEM, state["raw_text"][:MAX_CHARS])
    return {"fields": ExtractedFields.model_validate(data).model_dump(mode="json")}


def assess_risk(state: IntakeState) -> IntakeState:
    user = (
        f"Extracted fields:\n{json.dumps(state['fields'], indent=2)}\n\n"
        f"Complaint text:\n{state['raw_text'][:MAX_CHARS]}"
    )
    return {"risk": RiskAssessment.model_validate(_ask_json(RISK_SYSTEM, user)).model_dump()}


def check_completeness(state: IntakeState) -> IntakeState:
    return {"missing_fields": [f for f in REQUIRED_FIELDS if not state["fields"].get(f)]}


def build_graph():
    graph = StateGraph(IntakeState)
    graph.add_node("extract_fields", extract_fields)
    graph.add_node("assess_risk", assess_risk)
    graph.add_node("check_completeness", check_completeness)
    graph.add_edge(START, "extract_fields")
    graph.add_edge("extract_fields", "assess_risk")
    graph.add_edge("assess_risk", "check_completeness")
    graph.add_edge("check_completeness", END)
    return graph.compile()


intake_graph = build_graph()

_AFTER_NODE = {
    "extract_fields": (60, "Fields extracted. Assessing risk and priority..."),
    "assess_risk": (85, "Risk assessed. Checking completeness..."),
    "check_completeness": (100, "Extraction complete."),
}


def run_intake(raw_text: str) -> Iterator[IntakeEvent]:
    state: IntakeState = {"raw_text": raw_text[:MAX_CHARS]}
    yield IntakeEvent(
        progress=15, message="Analyzing document content and extracting key details..."
    )
    for update in intake_graph.stream(state, stream_mode="updates"):
        for node, delta in update.items():
            state.update(delta)
            progress, message = _AFTER_NODE[node]
            yield IntakeEvent(progress=progress, message=message)
    fields = ExtractedFields.model_validate(
        state["fields"]
        | {"initial_severity": state["risk"]["severity"], "priority": state["risk"]["priority"]}
    )
    yield IntakeEvent(
        result=IntakeResult(
            fields=fields,
            risk=RiskAssessment.model_validate(state["risk"]),
            missing_fields=state["missing_fields"],
            source_text=state["raw_text"],
        )
    )
