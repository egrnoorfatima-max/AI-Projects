from models import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text(
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'New'"
    ))
    conn.execute(text(
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS latest_comment TEXT"
    ))
    conn.commit()
    print("Migration complete: added status and latest_comment columns to candidates table")
