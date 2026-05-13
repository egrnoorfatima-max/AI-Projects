from models import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS hired_candidate_name VARCHAR(200)"))
    conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS hired_candidate_email VARCHAR(200)"))
    conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS status_comment TEXT"))
    conn.commit()
    print("Migration complete: added hired_candidate_name, hired_candidate_email, status_comment to job_descriptions")
