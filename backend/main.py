from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
import shutil
from parser import parse_resume, match_jd
from models import SessionLocal, Candidate, JobDescription, MatchResult

# Create uploads folder if it doesn't exist
os.makedirs("uploads", exist_ok=True)

# Read port from environment variable
port = int(os.getenv("PORT", 8000))

app = FastAPI(title="Resume Parser API")

# Add CORS middleware - allow all origins for deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MatchJDRequest(BaseModel):
    candidate_id: int
    jd_id: int
    resume_data: dict
    jd_text: str

class JobDescriptionCreate(BaseModel):
    title: str
    description: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
async def root():
    return {"status": "running", "message": "Resume Parser API"}

@app.post("/parse-resume")
async def parse_resume_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Save the file temporarily
    file_path = f"uploads/{file.filename}"
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Parse the resume
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

        response = {
            **parsed_data,
            "id": candidate.id,
            "pdf_filename": candidate.pdf_filename,
        }
        return response
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        # Delete the temporary file
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/match-jd")
async def match_jd_endpoint(request: MatchJDRequest, db: Session = Depends(get_db)):
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

        response = {
            "id": match_record.id,
            **match_result,
        }
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Entry point for deployment

@app.get("/candidates")
async def get_candidates(db: Session = Depends(get_db)):
    try:
        candidates = db.query(Candidate).order_by(Candidate.uploaded_at.desc()).all()
        return [
            {
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
            }
            for candidate in candidates
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/job-descriptions")
async def create_job_description(request: JobDescriptionCreate, db: Session = Depends(get_db)):
    try:
        jd = JobDescription(
            title=request.title,
            description=request.description,
        )
        db.add(jd)
        db.commit()
        db.refresh(jd)
        
        return {
            "id": jd.id,
            "title": jd.title,
            "description": jd.description,
            "created_at": jd.created_at,
            "status": jd.status,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/job-descriptions")
async def get_job_descriptions(db: Session = Depends(get_db)):
    try:
        job_descriptions = (
            db.query(JobDescription)
            .filter(JobDescription.status == "active")
            .order_by(JobDescription.created_at.desc())
            .all()
        )
        return [
            {
                "id": jd.id,
                "title": jd.title,
                "description": jd.description,
                "created_at": jd.created_at,
                "status": jd.status,
            }
            for jd in job_descriptions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)