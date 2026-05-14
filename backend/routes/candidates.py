from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import os
import shutil
import traceback

from models import Candidate, JobDescription, MatchResult
from parser import parse_resume, match_jd
from auth import get_current_user
from utils.dependencies import get_db
from utils.s3_storage import upload_resume_to_s3, generate_presigned_url
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
        email = parsed_data.get("email")

        # Upload to S3 if configured
        s3_key = None
        if os.getenv("S3_BUCKET_NAME"):
            try:
                s3_key = upload_resume_to_s3(file_path, email or "unknown", file.filename)
            except Exception as s3_err:
                print(f"S3 upload failed (non-fatal): {s3_err}")

        existing = db.query(Candidate).filter(Candidate.email == email).first() if email else None

        if existing:
            # Update existing candidate — preserve status and comments
            existing.name = parsed_data.get("name")
            existing.phone = parsed_data.get("phone")
            existing.location = parsed_data.get("location")
            existing.total_years_experience = parsed_data.get("total_years_experience")
            existing.current_role = parsed_data.get("current_role")
            existing.current_company = parsed_data.get("current_company")
            existing.skills = parsed_data.get("skills")
            existing.education = parsed_data.get("education")
            existing.employment_history = parsed_data.get("employment_history")
            existing.pdf_filename = file.filename
            existing.s3_key = s3_key
            existing.uploaded_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return {**parsed_data, "id": existing.id, "pdf_filename": existing.pdf_filename, "s3_key": existing.s3_key}
        else:
            candidate = Candidate(
                name=parsed_data.get("name"),
                email=email,
                phone=parsed_data.get("phone"),
                location=parsed_data.get("location"),
                total_years_experience=parsed_data.get("total_years_experience"),
                current_role=parsed_data.get("current_role"),
                current_company=parsed_data.get("current_company"),
                skills=parsed_data.get("skills"),
                education=parsed_data.get("education"),
                employment_history=parsed_data.get("employment_history"),
                pdf_filename=file.filename,
                s3_key=s3_key,
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)
            return {**parsed_data, "id": candidate.id, "pdf_filename": candidate.pdf_filename, "s3_key": candidate.s3_key}
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

        # Check application history to build an appropriate auto-comment
        previous_matches = db.query(MatchResult).filter(
            MatchResult.candidate_id == request.candidate_id
        ).count()

        if previous_matches > 0:
            jd = db.query(JobDescription).filter(JobDescription.id == request.jd_id).first()
            position_title = jd.title if jd else "this position"
            comment = f"Re-applied for {position_title} on {datetime.utcnow().strftime('%B %d, %Y')}"
        else:
            comment = f"Applied on {datetime.utcnow().strftime('%B %d, %Y')}"

        # Fetch s3_key from the candidate record for this resume version
        candidate = db.query(Candidate).filter(Candidate.id == request.candidate_id).first()

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
            resume_s3_key=candidate.s3_key if candidate else None,
            status="New",
            comments=comment,
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
                    "status": match.status or "New",
                    "comments": match.comments,
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
                "s3_key": candidate.s3_key,
                "uploaded_at": candidate.uploaded_at,
                "latest_match": latest_match_data,
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


@router.get("/candidates/{candidate_id}/resume-url")
async def get_resume_url(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            print(f"Candidate {candidate_id} not found")
            raise HTTPException(status_code=404, detail="Candidate not found")

        print(f"Candidate found: {candidate.name}")
        print(f"S3 Key: {candidate.s3_key}")

        if not candidate.s3_key:
            print("No s3_key found for this candidate")
            raise HTTPException(status_code=404, detail="Resume not found in storage")

        print(f"Generating presigned URL for: {candidate.s3_key}")
        url = generate_presigned_url(candidate.s3_key)
        print(f"URL generated successfully")
        return {"url": url}

    except HTTPException:
        raise
    except Exception as e:
        print("="*50)
        print(f"ERROR in get_resume_url:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("Traceback:")
        traceback.print_exc()
        print("="*50)
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {str(e)}")

@router.patch("/match-results/{match_id}/status")
async def update_match_status(
    match_id: int,
    request: CandidateStatusUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    match = db.query(MatchResult).filter(MatchResult.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match result not found")

    match.status = request.status

    if request.comment:
        match.comments = request.comment

    db.commit()
    db.refresh(match)

    candidate = db.query(Candidate).filter(Candidate.id == match.candidate_id).first()
    return {
        "match_id": match.id,
        "candidate_id": match.candidate_id,
        "candidate_name": candidate.name if candidate else None,
        "status": match.status,
        "comments": match.comments,
    }


@router.get("/candidates/{candidate_id}/applications")
async def get_candidate_applications(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    matches = (
        db.query(MatchResult)
        .filter(MatchResult.candidate_id == candidate_id)
        .order_by(MatchResult.matched_at.desc())
        .all()
    )
    all_jds = {jd.id: jd for jd in db.query(JobDescription).all()}

    applications = []
    for match in matches:
        jd = all_jds.get(match.jd_id)
        applications.append({
            "match_id": match.id,
            "jd_id": match.jd_id,
            "position_title": jd.title if jd else None,
            "overall_score": match.overall_score,
            "hire_recommendation": match.hire_recommendation,
            "status": match.status or "New",
            "comments": match.comments,
            "resume_s3_key": match.resume_s3_key,
            "matched_at": match.matched_at,
        })

    return {"candidate_id": candidate_id, "applications": applications}
