from models import engine
from sqlalchemy import text

# Add new columns to existing job_descriptions table
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN team VARCHAR(200)"))
        print("Added team column")
    except:
        print("team column already exists")
    
    try:
        conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN manager VARCHAR(200)"))
        print("Added manager column")
    except:
        print("manager column already exists")
    
    try:
        conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN assigned_to VARCHAR(200)"))
        print("Added assigned_to column")
    except:
        print("assigned_to column already exists")
    
    try:
        conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN start_date TIMESTAMP"))
        print("Added start_date column")
    except:
        print("start_date column already exists")
    
    try:
        conn.execute(text("ALTER TABLE job_descriptions ALTER COLUMN status SET DEFAULT 'open'"))
        print("Updated status default value")
    except:
        print("status default already set")
    
    conn.commit()
    print("\nDatabase migration complete!")