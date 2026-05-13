from typing import Optional
from pydantic import BaseModel


class JobDescriptionCreate(BaseModel):
    title: str
    description: str
    team: str
    manager: str
    assigned_to: str
    start_date: Optional[str] = None
    status: str = "open"


class JobDescriptionUpdate(BaseModel):
    title: str
    description: str
    team: str
    manager: str
    assigned_to: str
    start_date: Optional[str] = None
    status: Optional[str] = None


class JDStatusUpdate(BaseModel):
    status: str
    hired_candidate_name: Optional[str] = None
    hired_candidate_email: Optional[str] = None
    comment: Optional[str] = None
