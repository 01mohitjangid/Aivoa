import logging
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.agents.intake_graph import run_intake
from app.documents import UnsupportedDocument, extract_text
from app.schemas.intake import ExtractTextIn, IntakeEvent

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/intake", tags=["intake"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
STREAM_DOC = {
    200: {"content": {"application/x-ndjson": {"schema": IntakeEvent.model_json_schema()}}}
}


def _ndjson(raw_text: str) -> Iterator[str]:
    try:
        for event in run_intake(raw_text):
            yield event.model_dump_json(exclude_none=True) + "\n"
    except Exception as exc:
        log.exception("intake graph failed")
        yield IntakeEvent(error=f"AI extraction failed: {exc}").model_dump_json(exclude_none=True)
        yield "\n"


def _stream(raw_text: str) -> StreamingResponse:
    return StreamingResponse(_ndjson(raw_text), media_type="application/x-ndjson")


@router.post("/extract", response_class=StreamingResponse, responses=STREAM_DOC)
def extract_from_text(payload: ExtractTextIn) -> StreamingResponse:
    return _stream(payload.text)


@router.post("/upload", response_class=StreamingResponse, responses=STREAM_DOC)
async def extract_from_file(file: UploadFile) -> StreamingResponse:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 10MB")
    try:
        text = extract_text(file.filename or "", data)
    except UnsupportedDocument as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Could not read the document") from exc
    if len(text.strip()) < 20:
        raise HTTPException(
            status_code=422, detail="No readable text found in the document (scanned image?)"
        )
    return _stream(text)
