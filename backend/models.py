from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, create_engine, Boolean
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime, timedelta
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
    status = Column(String(20), default='open')  # Valid values: 'open', 'closed', 'on_hold'
    team = Column(String(200))
    manager = Column(String(200))
    assigned_to = Column(String(200))
    start_date = Column(DateTime)
    hired_candidate_name = Column(String(200), nullable=True)
    hired_candidate_email = Column(String(200), nullable=True)
    status_comment = Column(Text, nullable=True)

    # Relationships
    match_results = relationship("MatchResult", back_populates="job_description")
    interviews = relationship("Interview", back_populates="job_description")
    
    @property
    def age_days(self):
        """Computed property: days since position was opened"""
        if self.start_date:
            return (datetime.utcnow() - self.start_date).days
        return None


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
    s3_key = Column(String(500), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="New")
    latest_comment = Column(Text, nullable=True)

    # Relationships
    match_results = relationship("MatchResult", back_populates="candidate")
    interviews = relationship("Interview", back_populates="candidate")


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
    status = Column(String(50), default="New")
    comments = Column(Text, nullable=True)
    resume_s3_key = Column(String(500), nullable=True)
    matched_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="match_results")
    job_description = relationship("JobDescription", back_populates="match_results")


class GoogleToken(Base):
    __tablename__ = "google_tokens"

    id = Column(Integer, primary_key=True)
    user_email = Column(String(200), unique=True, nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey('candidates.id'), nullable=False)
    position_id = Column(Integer, ForeignKey('job_descriptions.id'), nullable=True)
    scheduled_by = Column(String(200))
    interviewer_email = Column(String(200), nullable=False)
    candidate_email = Column(String(200), nullable=False)
    interview_date = Column(String(20), nullable=False)   # YYYY-MM-DD
    interview_time = Column(String(10), nullable=False)   # HH:MM
    duration_minutes = Column(Integer, default=60)
    interview_type = Column(String(20), nullable=False)   # phone | video | onsite
    google_meet_link = Column(Text, nullable=True)
    google_event_id = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default='scheduled')      # scheduled | completed | cancelled | rescheduled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="interviews")
    job_description = relationship("JobDescription", back_populates="interviews")


DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
