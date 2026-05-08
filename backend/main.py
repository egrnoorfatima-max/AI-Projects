from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from parser import parse_resume, match_jd

# Create uploads folder if it doesn't exist
os.makedirs("uploads", exist_ok=True) 

app = FastAPI(title="Resume Parser API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MatchJDRequest(BaseModel):
    resume_data: dict
    jd_text: str

@app.get("/")
async def root():
    return {"status": "running", "message": "Resume Parser API"}

@app.post("/parse-resume")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Save the file temporarily
    file_path = f"uploads/{file.filename}"
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Parse the resume
        parsed_data = parse_resume(file_path)
        
        return parsed_data
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
async def match_jd_endpoint(request: MatchJDRequest):
    try:
        match_result = match_jd(request.resume_data, request.jd_text)
        return match_result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")