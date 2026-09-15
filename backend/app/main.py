from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.routers import complaints, copilot, intake

app = FastAPI(title="Aivoa Complaint Management API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(complaints.router)
app.include_router(intake.router)
app.include_router(copilot.router)


class Health(BaseModel):
    status: str = "ok"


@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health()
