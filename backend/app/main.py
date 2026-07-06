from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .routers import (
    activity,
    calendar,
    client_insights,
    client_portal,
    clients,
    dashboard,
    export,
    exercises,
    notifications,
    programs,
    prs,
    progress,
    schedule,
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
app.include_router(client_portal.router)
app.include_router(exercises.router)
app.include_router(programs.router)
app.include_router(sessions.router)
app.include_router(schedule.router)
app.include_router(notifications.router)
app.include_router(progress.router)
app.include_router(prs.router)
app.include_router(calendar.router)
app.include_router(activity.router)
app.include_router(export.router)


@app.get("/health")
def health():
    return {"status": "ok"}


_PRIVACY_POLICY_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LiftIQ Privacy Policy</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  h2 { font-size: 1.15rem; margin-top: 2em; }
  .updated { color: #666; font-size: 0.9rem; margin-bottom: 2em; }
  a { color: #0a7d3c; }
</style>
</head>
<body>
<h1>LiftIQ Privacy Policy</h1>
<p class="updated">Last updated: 2026-07-06</p>

<p>LiftIQ ("we", "our", "the app") is a workout-tracking app used by personal trainers and
their clients. This policy explains what information we collect, how it's used, and your
choices around it.</p>

<h2>Information we collect</h2>
<p>To provide the service, we collect:</p>
<ul>
  <li><strong>Account information:</strong> name and email address, via our authentication
    provider (Clerk).</li>
  <li><strong>Profile information trainers add for their clients:</strong> phone number,
    training goals, age, gender, injuries/limitations, starting bodyweight, and an optional
    profile photo.</li>
  <li><strong>Workout data:</strong> exercises, sets, reps, weight, session notes, personal
    records, and scheduling information entered by the trainer or client.</li>
  <li><strong>Usage data:</strong> basic technical information (device type, app version)
    needed to operate and debug the service.</li>
</ul>

<h2>How we use this information</h2>
<p>Information is used solely to operate the app: authenticating users, displaying workout
history and progress, generating summaries and personal-record detection, and enabling a
trainer and their own clients to see shared training data. We do not sell personal data, and
we do not use it for advertising or share it with data brokers.</p>

<h2>Who can see your data</h2>
<p>A client's training data is visible to that client and to the trainer who created their
account. Trainers cannot see other trainers' clients. We do not make any data public.</p>

<h2>Third-party services</h2>
<p>We use the following third-party services to operate LiftIQ:</p>
<ul>
  <li><strong>Clerk</strong> — authentication and account management.</li>
  <li><strong>Render</strong> — application hosting and database storage.</li>
</ul>
<p>These providers process data on our behalf under their own privacy and security
commitments; we do not share your data with any other third party.</p>

<h2>Data retention</h2>
<p>We retain account and workout data for as long as your account is active. If a trainer
archives or deletes a client, that client's associated data is removed from active use.
You can request deletion of your data at any time by contacting us (below).</p>

<h2>Children's privacy</h2>
<p>LiftIQ is not directed at children under 13, and we do not knowingly collect information
from children under 13.</p>

<h2>Changes to this policy</h2>
<p>If this policy changes, we'll update the date at the top of this page.</p>

<h2>Contact us</h2>
<p>Questions about this policy or your data can be sent to
<a href="mailto:jerryhamada1@gmail.com">jerryhamada1@gmail.com</a>.</p>

</body>
</html>"""


@app.get("/privacy", response_class=HTMLResponse)
def privacy_policy():
    return _PRIVACY_POLICY_HTML
