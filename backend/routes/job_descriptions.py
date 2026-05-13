from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from models import JobDescription
from auth import get_current_user
from utils.dependencies import get_db
from schemas.job_description import JobDescriptionCreate, JobDescriptionUpdate, JDStatusUpdate

router = APIRouter()


def _jd_response(jd):
    return {
        "id": jd.id,
        "title": jd.title,
        "description": jd.description,
        "created_at": jd.created_at,
        "status": jd.status,
        "team": jd.team,
        "manager": jd.manager,
        "assigned_to": jd.assigned_to,
        "start_date": jd.start_date,
        "age_days": jd.age_days,
        "hired_candidate_name": jd.hired_candidate_name,
        "hired_candidate_email": jd.hired_candidate_email,
        "status_comment": jd.status_comment,
    }


@router.post("/job-descriptions")
async def create_job_description(
    request: JobDescriptionCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        jd = JobDescription(
            title=request.title,
            description=request.description,
            team=request.team,
            manager=request.manager,
            assigned_to=request.assigned_to,
            start_date=datetime.fromisoformat(request.start_date) if request.start_date else None,
            status=request.status,
        )
        db.add(jd)
        db.commit()
        db.refresh(jd)
        return _jd_response(jd)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid start_date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/job-descriptions")
async def get_job_descriptions(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        job_descriptions = (
            db.query(JobDescription)
            .order_by(JobDescription.created_at.desc())
            .all()
        )
        return [_jd_response(jd) for jd in job_descriptions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/job-descriptions/{jd_id}")
async def update_job_description(
    jd_id: int,
    request: JobDescriptionUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
        if not jd:
            raise HTTPException(status_code=404, detail="Job description not found")

        if request.title is not None:
            jd.title = request.title
        if request.description is not None:
            jd.description = request.description
        if request.team is not None:
            jd.team = request.team
        if request.manager is not None:
            jd.manager = request.manager
        if request.assigned_to is not None:
            jd.assigned_to = request.assigned_to
        if request.start_date is not None:
            jd.start_date = datetime.fromisoformat(request.start_date)
        if request.status is not None:
            jd.status = request.status

        db.commit()
        db.refresh(jd)
        return _jd_response(jd)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid start_date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/job-descriptions/{jd_id}/status")
async def update_jd_status(
    jd_id: int,
    request: JDStatusUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
        if not jd:
            raise HTTPException(status_code=404, detail="Job description not found")

        if request.status == "closed":
            if not request.hired_candidate_name or not request.hired_candidate_email:
                raise HTTPException(
                    status_code=400,
                    detail="Hired candidate name and email are required when closing a position",
                )
            jd.hired_candidate_name = request.hired_candidate_name
            jd.hired_candidate_email = request.hired_candidate_email

        jd.status = request.status
        if request.comment is not None:
            jd.status_comment = request.comment

        db.commit()
        db.refresh(jd)
        return _jd_response(jd)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
