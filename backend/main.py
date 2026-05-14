from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routes import candidates, job_descriptions, auth_routes

os.makedirs("uploads", exist_ok=True)
port = int(os.getenv("PORT", 8000))

app = FastAPI(title="Resume Parser API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(candidates.router)
app.include_router(job_descriptions.router)


@app.get("/")
async def root():
    return {"status": "running", "message": "Resume Parser API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)
