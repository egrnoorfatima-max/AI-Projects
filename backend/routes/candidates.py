from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
import os
import shutil

from models import Candidate, JobDescription, MatchResult
from parser import parse_resume, match_jd
from auth import get_current_user
from utils.dependencies import get_db
from schemas.candidate import MatchJDRequest, CandidateStatusUpdate

router = APIRouter()


@router.post("/parse-resume")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_path = f"uploads/{file.filename}"
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        parsed_data = parse_resume(file_path)

        candidate = Candidate(
            name=parsed_data.get("name"),
            email=parsed_data.get("email"),
            phone=parsed_data.get("phone"),
            location=parsed_data.get("location"),
            total_years_experience=parsed_data.get("total_years_experience"),
            current_role=parsed_data.get("current_role"),
            current_company=parsed_data.get("current_company"),
            skills=parsed_data.get("skills"),
            education=parsed_data.get("education"),
            employment_history=parsed_data.get("employment_history"),
            pdf_filename=file.filename,
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        return {**parsed_data, "id": candidate.id, "pdf_filename": candidate.pdf_filename}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/match-jd")
async def match_jd_endpoint(
    request: MatchJDRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        match_result = match_jd(request.resume_data, request.jd_text)

        match_record = MatchResult(
            candidate_id=request.candidate_id,
            jd_id=request.jd_id,
            overall_score=match_result.get("overall_score"),
            score_breakdown=match_result.get("score_breakdown"),
            matching_skills=match_result.get("matching_skills"),
            missing_skills=match_result.get("missing_skills"),
            strong_points=match_result.get("strong_points"),
            red_flags=match_result.get("red_flags"),
            scorecard=match_result.get("scorecard"),
            hire_recommendation=match_result.get("hire_recommendation"),
            recommendation_reason=match_result.get("recommendation_reason"),
            summary=match_result.get("summary"),
        )
        db.add(match_record)
        db.commit()
        db.refresh(match_record)

        return {"id": match_record.id, **match_result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/candidates")
async def get_candidates(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        candidates = db.query(Candidate).order_by(Candidate.uploaded_at.desc()).all()

        all_matches = db.query(MatchResult).all()
        all_jds = {jd.id: jd for jd in db.query(JobDescription).all()}

        latest_match_by_candidate = {}
        for match in all_matches:
            cid = match.candidate_id
            if cid not in latest_match_by_candidate or match.id > latest_match_by_candidate[cid].id:
                latest_match_by_candidate[cid] = match

        result = []
        for candidate in candidates:
            match = latest_match_by_candidate.get(candidate.id)
            latest_match_data = None
            if match:
                jd = all_jds.get(match.jd_id)
                latest_match_data = {
                    "id": match.id,
                    "position_title": jd.title if jd else None,
                    "position_id": match.jd_id,
                    "overall_score": match.overall_score,
                    "hire_recommendation": match.hire_recommendation,
                    "matched_at": match.matched_at,
                }
            result.append({
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email,
                "phone": candidate.phone,
                "location": candidate.location,
                "total_years_experience": candidate.total_years_experience,
                "current_role": candidate.current_role,
                "current_company": candidate.current_company,
                "skills": candidate.skills,
                "education": candidate.education,
                "employment_history": candidate.employment_history,
                "pdf_filename": candidate.pdf_filename,
                "uploaded_at": candidate.uploaded_at,
                "latest_match": latest_match_data,
                "status": candidate.status or "New",
                "latest_comment": candidate.latest_comment,
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/match-results/{match_id}")
async def get_match_result(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        match = db.query(MatchResult).filter(MatchResult.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match result not found")
        jd = db.query(JobDescription).filter(JobDescription.id == match.jd_id).first()
        return {
            "id": match.id,
            "candidate_id": match.candidate_id,
            "jd_id": match.jd_id,
            "position_title": jd.title if jd else None,
            "overall_score": match.overall_score,
            "score_breakdown": match.score_breakdown,
            "matching_skills": match.matching_skills,
            "missing_skills": match.missing_skills,
            "strong_points": match.strong_points,
            "red_flags": match.red_flags,
            "scorecard": match.scorecard,
            "hire_recommendation": match.hire_recommendation,
            "recommendation_reason": match.recommendation_reason,
            "summary": match.summary,
            "matched_at": match.matched_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/candidates/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: int,
    request: CandidateStatusUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        candidate.status = request.status
        if request.comment is not None:
            candidate.latest_comment = request.comment

        db.commit()
        db.refresh(candidate)
        return {
            "id": candidate.id,
            "status": candidate.status,
            "latest_comment": candidate.latest_comment,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
