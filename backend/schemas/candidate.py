from typing import List, Optional
from pydantic import BaseModel


class MatchJDRequest(BaseModel):
    candidate_id: int
    jd_id: int
    resume_data: dict
    jd_text: str


class CandidateStatusUpdate(BaseModel):
    status: str
    comment: Optional[str] = None


class BulkStatusUpdateRequest(BaseModel):
    candidate_ids: List[int]
    status: str
    comment: Optional[str] = None
