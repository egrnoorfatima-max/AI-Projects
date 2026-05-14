"""
Migrate status and comments from candidates table to match_results table.
Sets each candidate's latest match_result to their current status/comment.
Safe to re-run: ADD COLUMN IF NOT EXISTS guards against duplicate runs.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models import engine, Candidate, MatchResult
from sqlalchemy import text
from sqlalchemy.orm import Session


def migrate():
    # Step 1: Add new columns to match_results
    with engine.connect() as conn:
        for stmt, label in [
            ("ALTER TABLE match_results ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'New'", "status"),
            ("ALTER TABLE match_results ADD COLUMN IF NOT EXISTS comments TEXT", "comments"),
            ("ALTER TABLE match_results ADD COLUMN IF NOT EXISTS resume_s3_key VARCHAR(500)", "resume_s3_key"),
        ]:
            try:
                conn.execute(text(stmt))
                print(f"Added column: {label}")
            except Exception as e:
                print(f"Skipped {label}: {e}")
        conn.commit()

    # Step 2: Copy status/comment from each candidate to their latest match
    with Session(engine) as db:
        candidates = db.query(Candidate).all()
        migrated = 0

        for candidate in candidates:
            if not candidate.status:
                continue

            latest_match = (
                db.query(MatchResult)
                .filter(MatchResult.candidate_id == candidate.id)
                .order_by(MatchResult.matched_at.desc())
                .first()
            )

            if latest_match:
                latest_match.status = candidate.status
                latest_match.comments = candidate.latest_comment
                print(f"  {candidate.name}: status='{candidate.status}'")
                migrated += 1

        db.commit()
        print(f"\nMigration complete — {migrated} match record(s) updated.")


if __name__ == "__main__":
    migrate()
