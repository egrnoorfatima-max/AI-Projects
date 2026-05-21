from typing import Optional
from pydantic import BaseModel

class ScheduleInterviewRequest(BaseModel):
    candidate_id: int
    position_id: Optional[int] = None
    interviewer_email: str
    candidate_email: str
    interview_date: str   # YYYY-MM-DD
    interview_time: str   # HH:MM
    duration_minutes: int = 60
    interview_type: str   # phone | video | onsite
    notes: Optional[str] = None
    custom_message: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None


class RescheduleRequest(BaseModel):
    interview_date: str   # YYYY-MM-DD
    interview_time: str   # HH:MM
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
