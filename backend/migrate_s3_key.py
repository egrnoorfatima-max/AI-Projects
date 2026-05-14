"""Add s3_key column to candidates table."""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

cur.execute("""
    ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500)
""")

conn.commit()
cur.close()
conn.close()
print("Migration complete: s3_key column added to candidates.")
