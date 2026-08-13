"""Clear production Neon PostgreSQL database entirely.

DESTRUCTIVE: drops every table in the target database. Double-check
NEON_DATABASE before running this against anything you care about.

USAGE: set env vars before running:
  export NEON_HOST=... NEON_DATABASE=... NEON_USER=... NEON_PASSWORD=...
"""
import os

import psycopg2

conn = psycopg2.connect(
    host=os.environ['NEON_HOST'],
    database=os.environ['NEON_DATABASE'],
    user=os.environ['NEON_USER'],
    password=os.environ['NEON_PASSWORD'],
    sslmode='require'
)
conn.autocommit = True
cur = conn.cursor()

print("Clearing production database...")

# Get all tables
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
tables = cur.fetchall()
print(f"Found {len(tables)} tables to drop")

# Drop all tables
for table in tables:
    table_name = table[0]
    print(f"  Dropping: {table_name}")
    cur.execute(f'DROP TABLE IF EXISTS public."{table_name}" CASCADE')

# Verify
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
remaining = cur.fetchall()
print(f"\nRemaining tables: {len(remaining)}")

cur.close()
conn.close()

print("\nProduction database cleared!")
