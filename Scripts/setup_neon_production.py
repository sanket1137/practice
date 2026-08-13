"""
Test Neon PostgreSQL connection and create the target database.

USAGE: set env vars before running:
  export NEON_HOST=... NEON_USER=... NEON_PASSWORD=...
  export NEON_DEFAULT_DB=neondb NEON_TARGET_DB=pixelspot_ccms
"""
import os

import psycopg2
from psycopg2 import sql

NEON_HOST = os.environ['NEON_HOST']
NEON_USER = os.environ['NEON_USER']
NEON_PASSWORD = os.environ['NEON_PASSWORD']
DEFAULT_DB = os.environ.get('NEON_DEFAULT_DB', 'neondb')
TARGET_DB = os.environ.get('NEON_TARGET_DB', 'pixelspot_ccms')

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
    print(f"Connected! PostgreSQL Version: {version[:50]}...")

    # Check if target database exists
    cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TARGET_DB,))
    exists = cursor.fetchone()

    if exists:
        print(f"Database '{TARGET_DB}' already exists!")
    else:
        print(f"Creating database '{TARGET_DB}'...")
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(TARGET_DB)))
        print(f"Database '{TARGET_DB}' created successfully!")

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
    print(f"Successfully connected to database: {current_db}")

    cursor2.close()
    conn2.close()

    print("\n" + "="*50)
    print("Neon PostgreSQL production database is ready!")
    print(f"   Host: {NEON_HOST}")
    print(f"   Database: {TARGET_DB}")
    print(f"   User: {NEON_USER}")
    print("="*50)

except Exception as e:
    print(f"Error: {e}")
