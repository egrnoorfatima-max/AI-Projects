from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()  # Add this line

Base = declarative_base()


class JobDescription(Base):
    __tablename__ = "job_descriptions"
    
    id = Column(Integer, primary_key=True)
    title = Column(String(200))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default='active')
    
    # Relationship to MatchResult
    match_results = relationship("MatchResult", back_populates="job_description")


class Candidate(Base):
    __tablename__ = "candidates"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(200))
    email = Column(String(200))
    phone = Column(String(50))
    location = Column(String(200))
    total_years_experience = Column(Integer)
    current_role = Column(String(200))
    current_company = Column(String(200))
    skills = Column(JSON)
    education = Column(JSON)
    employment_history = Column(JSON)
    pdf_filename = Column(String(500))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to MatchResult
    match_results = relationship("MatchResult", back_populates="candidate")


class MatchResult(Base):
    __tablename__ = "match_results"
    
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey('candidates.id'))
    jd_id = Column(Integer, ForeignKey('job_descriptions.id'))
    overall_score = Column(Integer)
    score_breakdown = Column(JSON)
    matching_skills = Column(JSON)
    missing_skills = Column(JSON)
    strong_points = Column(JSON)
    red_flags = Column(JSON)
    scorecard = Column(JSON)
    hire_recommendation = Column(String(50))
    recommendation_reason = Column(Text)
    summary = Column(Text)
    matched_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    candidate = relationship("Candidate", back_populates="match_results")
    job_description = relationship("JobDescription", back_populates="match_results")


DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
