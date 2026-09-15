import logging

from fastapi import APIRouter, HTTPException

from app.agents.copilot_graph import run_copilot
from app.schemas.copilot import ChatIn, ChatOut

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.post("/chat", response_model=ChatOut)
def chat(payload: ChatIn) -> ChatOut:
    try:
        return ChatOut(reply=run_copilot(payload))
    except Exception as exc:
        log.exception("copilot failed")
        raise HTTPException(status_code=502, detail=f"AI copilot failed: {exc}") from exc
