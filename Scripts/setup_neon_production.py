"""
Test Neon PostgreSQL connection and create pixelspot_ccms database
"""
import psycopg2
from psycopg2 import sql

# Neon connection details
NEON_HOST = "ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech"
NEON_USER = "neondb_owner"
NEON_PASSWORD = "npg_Y9bQL3rHdXPq"
DEFAULT_DB = "neondb"
TARGET_DB = "pixelspot_ccms"

print(f"Connecting to Neon PostgreSQL at {NEON_HOST}...")

try:
    # Connect to default database first
    conn = psycopg2.connect(
        host=NEON_HOST,
        database=DEFAULT_DB,
        user=NEON_USER,
        password=NEON_PASSWORD,
        sslmode="require"
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Check PostgreSQL version
    cursor.execute("SELECT version();")
    version = cursor.fetchone()[0]
    print(f"✅ Connected! PostgreSQL Version: {version[:50]}...")
    
    # Check if pixelspot_ccms database exists
    cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TARGET_DB,))
    exists = cursor.fetchone()
    
    if exists:
        print(f"✅ Database '{TARGET_DB}' already exists!")
    else:
        print(f"Creating database '{TARGET_DB}'...")
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(TARGET_DB)))
        print(f"✅ Database '{TARGET_DB}' created successfully!")
    
    cursor.close()
    conn.close()
    
    # Now connect to the target database to verify
    print(f"\nVerifying connection to '{TARGET_DB}'...")
    conn2 = psycopg2.connect(
        host=NEON_HOST,
        database=TARGET_DB,
        user=NEON_USER,
        password=NEON_PASSWORD,
        sslmode="require"
    )
    cursor2 = conn2.cursor()
    cursor2.execute("SELECT current_database();")
    current_db = cursor2.fetchone()[0]
    print(f"✅ Successfully connected to database: {current_db}")
    
    cursor2.close()
    conn2.close()
    
    print("\n" + "="*50)
    print("✅ Neon PostgreSQL production database is ready!")
    print(f"   Host: {NEON_HOST}")
    print(f"   Database: {TARGET_DB}")
    print(f"   User: {NEON_USER}")
    print("="*50)

except Exception as e:
    print(f"❌ Error: {e}")
