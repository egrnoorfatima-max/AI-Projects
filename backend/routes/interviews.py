from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from httpx import request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import uuid

from models import Interview, GoogleToken, Candidate, JobDescription, MatchResult
from auth import get_current_user
from utils.dependencies import get_db
from schemas.interview import ScheduleInterviewRequest, RescheduleRequest

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]


def _get_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uris": [GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )


def _get_credentials(db: Session, user_email: str) -> Credentials:
    record = db.query(GoogleToken).filter(GoogleToken.user_email == user_email).first()
    if not record or not record.access_token:
        raise HTTPException(
            status_code=401,
            detail="Google Calendar not connected. Please connect in Settings."
        )

    creds = Credentials(
        token=record.access_token,
        refresh_token=record.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            record.access_token = creds.token
            record.token_expiry = creds.expiry
            record.updated_at = datetime.utcnow()
            db.commit()
        except Exception:
            raise HTTPException(
                status_code=401,
                detail="Google session expired. Please reconnect in Settings."
            )

    return creds


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/auth/google")
def google_auth_initiate():
    flow = _get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return RedirectResponse(auth_url)


@router.get("/auth/google/callback")
def google_auth_callback(code: str, db: Session = Depends(get_db)):
    try:
        flow = _get_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials
        user_email = os.getenv("ADMIN_EMAIL")

        record = db.query(GoogleToken).filter(GoogleToken.user_email == user_email).first()
        if record:
            record.access_token = creds.token
            record.refresh_token = creds.refresh_token or record.refresh_token
            record.token_expiry = creds.expiry
            record.updated_at = datetime.utcnow()
        else:
            record = GoogleToken(
                user_email=user_email,
                access_token=creds.token,
                refresh_token=creds.refresh_token,
                token_expiry=creds.expiry,
            )
            db.add(record)
        db.commit()
    except Exception as e:
        return HTMLResponse(f"""
        <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2 style="color:#dc2626;">Connection Failed</h2>
        <p style="color:#64748b;">{str(e)}</p>
        <p>You can close this window and try again.</p>
        <script>setTimeout(()=>window.close(),3000)</script>
        </body></html>
        """, status_code=400)

    return HTMLResponse("""
    <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
    <h2 style="color:#16a34a;">Google Calendar Connected!</h2>
    <p style="color:#64748b;">You can close this window and return to the app.</p>
    <script>
      if (window.opener) { window.opener.postMessage('google_connected', '*'); }
      setTimeout(() => window.close(), 1500);
    </script>
    </body></html>
    """)


@router.get("/auth/google/status")
def google_auth_status(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    record = db.query(GoogleToken).filter(GoogleToken.user_email == current_user).first()
    return {"connected": record is not None and bool(record.access_token)}


@router.delete("/auth/google/disconnect")
def google_disconnect(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    record = db.query(GoogleToken).filter(GoogleToken.user_email == current_user).first()
    if record:
        db.delete(record)
        db.commit()
    return {"disconnected": True}


# ── Interviews ────────────────────────────────────────────────────────────────

@router.post("/interviews/schedule")
def schedule_interview(
    request: ScheduleInterviewRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    creds = _get_credentials(db, current_user)
    service = build("calendar", "v3", credentials=creds)

    start_dt = datetime.fromisoformat(f"{request.interview_date}T{request.interview_time}:00")
    end_dt = start_dt + timedelta(minutes=request.duration_minutes)

    candidate = db.query(Candidate).filter(Candidate.id == request.candidate_id).first()
    position = (
        db.query(JobDescription).filter(JobDescription.id == request.position_id).first()
        if request.position_id else None
    )
    candidate_name = candidate.name if candidate else "Candidate"
    position_title = position.title if position else "Interview"

    event_body = {
        "summary": f"Interview: {candidate_name} — {position_title}",
        "description": request.notes or "",
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
        "attendees": [
            {"email": request.interviewer_email},
            {"email": request.candidate_email},
        ],
        "sendUpdates": "all",
    }

    conference_version = 0
    if request.interview_type == "video":
        event_body["conferenceData"] = {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
        conference_version = 1

    try:
        created = service.events().insert(
            calendarId="primary",
            body=event_body,
            conferenceDataVersion=conference_version,
            sendNotifications=True,
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Google Calendar error: {str(e)}")

    meet_link = None
    if request.interview_type == "video":
        for ep in created.get("conferenceData", {}).get("entryPoints", []):
            if ep.get("entryPointType") == "video":
                meet_link = ep.get("uri")
                break
        if not meet_link:
            meet_link = created.get("hangoutLink")

    interview = Interview(
        candidate_id=request.candidate_id,
        position_id=request.position_id,
        scheduled_by=current_user,
        interviewer_email=request.interviewer_email,
        candidate_email=request.candidate_email,
        interview_date=request.interview_date,
        interview_time=request.interview_time,
        duration_minutes=request.duration_minutes,
        interview_type=request.interview_type,
        google_meet_link=meet_link,
        google_event_id=created["id"],
        notes=request.notes,
        status="scheduled",
    )
    db.add(interview)

    # Update candidate's latest match status
    if candidate:
        match = (
            db.query(MatchResult)
            .filter(MatchResult.candidate_id == request.candidate_id)
            .order_by(MatchResult.id.desc())
            .first()
        )
        if match:
            match.status = "Interview Scheduled"
            note = f"Interview scheduled for {request.interview_date} at {request.interview_time}"
            match.comments = (match.comments + " | " + note) if match.comments else note

    db.commit()
    db.refresh(interview)

    return {
        "id": interview.id,
        "google_meet_link": meet_link,
        "google_event_id": interview.google_event_id,
        "status": interview.status,
        "interview_date": interview.interview_date,
        "interview_time": interview.interview_time,
        "interviewer_email": interview.interviewer_email,
        "candidate_email": interview.candidate_email,
        "interview_type": interview.interview_type,
        "duration_minutes": interview.duration_minutes,
    }


@router.patch("/interviews/{interview_id}/reschedule")
def reschedule_interview(
    interview_id: str,
    request: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    print("Reschedule received:", {"interview_id": interview_id, "interview_date": request.interview_date, "interview_time": request.interview_time})
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    creds = _get_credentials(db, current_user)
    service = build("calendar", "v3", credentials=creds)

    #start_dt = datetime.fromisoformat(f"{request.interview_date}T{request.interview_time}:00")
    time_str = str(request.interview_time)
    start_dt = datetime.fromisoformat(f"{request.interview_date}T{time_str}")
    end_dt = start_dt + timedelta(minutes=interview.duration_minutes)

    try:
        event = service.events().get(calendarId="primary", eventId=interview.google_event_id).execute()
        event["start"] = {"dateTime": start_dt.isoformat(), "timeZone": "UTC"}
        event["end"] = {"dateTime": end_dt.isoformat(), "timeZone": "UTC"}
        service.events().update(
            calendarId="primary",
            eventId=interview.google_event_id,
            body=event,
            sendNotifications=True,
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Google Calendar error: {str(e)}")

    interview.interview_date = request.interview_date
    interview.interview_time = request.interview_time
    interview.status = "rescheduled"
    interview.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(interview)

    return {
        "id": interview.id,
        "status": interview.status,
        "interview_date": interview.interview_date,
        "interview_time": interview.interview_time,
    }


@router.patch("/interviews/{interview_id}/cancel")
def cancel_interview(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    creds = _get_credentials(db, current_user)
    service = build("calendar", "v3", credentials=creds)

    try:
        service.events().delete(
            calendarId="primary",
            eventId=interview.google_event_id,
            sendNotifications=True,
        ).execute()
    except Exception as e:
        # If the event is already gone on Google's side, still cancel locally
        if "404" not in str(e) and "410" not in str(e):
            raise HTTPException(status_code=502, detail=f"Google Calendar error: {str(e)}")

    # Capture before first commit — avoids accessing expired attributes after flush
    candidate_id = interview.candidate_id
    interview_id_out = interview.id

    interview.status = "cancelled"
    interview.updated_at = datetime.utcnow()
    db.commit()

    # If no active interviews remain, revert both MatchResult and Candidate to "Reviewed"
    remaining_active = (
        db.query(Interview)
        .filter(
            Interview.candidate_id == candidate_id,
            Interview.status.in_(["scheduled", "rescheduled"]),
        )
        .count()
    )

    if remaining_active == 0:
        note = "Interview cancelled. Status reverted to Reviewed automatically."

        # 1. Latest match result — this is what the candidate card and panel display
        latest_match = (
            db.query(MatchResult)
            .filter(MatchResult.candidate_id == candidate_id)
            .order_by(MatchResult.id.desc())
            .first()
        )
        if latest_match:
            latest_match.status = "Reviewed"
            latest_match.comments = (
                (latest_match.comments + " | " + note) if latest_match.comments else note
            )

        # 2. Candidate row
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate:
            candidate.status = "Reviewed"
            candidate.latest_comment = (
                (candidate.latest_comment + " | " + note) if candidate.latest_comment else note
            )

        db.commit()

    return {"id": interview_id_out, "status": "cancelled"}


@router.get("/interviews/candidate/{candidate_id}")
def get_candidate_interviews(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    rows = (
        db.query(Interview)
        .filter(Interview.candidate_id == candidate_id)
        .order_by(Interview.interview_date.desc(), Interview.interview_time.desc())
        .all()
    )
    return [
        {
            "id": i.id,
            "candidate_id": i.candidate_id,
            "position_id": i.position_id,
            "scheduled_by": i.scheduled_by,
            "interviewer_email": i.interviewer_email,
            "candidate_email": i.candidate_email,
            "interview_date": i.interview_date,
            "interview_time": i.interview_time,
            "duration_minutes": i.duration_minutes,
            "interview_type": i.interview_type,
            "google_meet_link": i.google_meet_link,
            "notes": i.notes,
            "status": i.status,
            "created_at": i.created_at,
        }
        for i in rows
    ]
