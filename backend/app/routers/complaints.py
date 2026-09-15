from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.db import DbSession
from app.models import Complaint
from app.schemas.complaint import ComplaintCreate, ComplaintOut

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


@router.post("", response_model=ComplaintOut, status_code=201)
def create_complaint(payload: ComplaintCreate, db: DbSession) -> Complaint:
    complaint = Complaint(**payload.model_dump())
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("", response_model=list[ComplaintOut])
def list_complaints(db: DbSession) -> list[Complaint]:
    return list(db.scalars(select(Complaint).order_by(Complaint.created_at.desc())))


def _get_or_404(db: DbSession, complaint_id: int) -> Complaint:
    complaint = db.get(Complaint, complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint


@router.get("/{complaint_id}", response_model=ComplaintOut)
def get_complaint(complaint_id: int, db: DbSession) -> Complaint:
    return _get_or_404(db, complaint_id)


@router.put("/{complaint_id}", response_model=ComplaintOut)
def update_complaint(complaint_id: int, payload: ComplaintCreate, db: DbSession) -> Complaint:
    complaint = _get_or_404(db, complaint_id)
    for key, value in payload.model_dump().items():
        setattr(complaint, key, value)
    db.commit()
    db.refresh(complaint)
    return complaint
