from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import (
    activity,
    calendar,
    client_insights,
    clients,
    dashboard,
    export,
    exercises,
    programs,
    prs,
    progress,
    sessions,
    trainer,
)

app = FastAPI(title="FitTrack Pro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trainer.router)
app.include_router(dashboard.router)
app.include_router(clients.router)
app.include_router(client_insights.router)
app.include_router(exercises.router)
app.include_router(programs.router)
app.include_router(sessions.router)
app.include_router(progress.router)
app.include_router(prs.router)
app.include_router(calendar.router)
app.include_router(activity.router)
app.include_router(export.router)


@app.get("/health")
def health():
    return {"status": "ok"}
