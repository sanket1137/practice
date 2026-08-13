"""Check both databases for the user.

USAGE: set env vars before running:
  export NEON_HOST=... NEON_DATABASE=... NEON_USER=... NEON_PASSWORD=...
  export LOCAL_DB_HOST=localhost LOCAL_DB_PORT=5432 LOCAL_DB_NAME=... LOCAL_DB_USER=... LOCAL_DB_PASSWORD=...
"""
import os

import psycopg2

# Check production Neon
print('=== PRODUCTION (Neon) ===')
conn = psycopg2.connect(
    host=os.environ['NEON_HOST'],
    database=os.environ['NEON_DATABASE'],
    user=os.environ['NEON_USER'],
    password=os.environ['NEON_PASSWORD'],
    sslmode='require'
)
cur = conn.cursor()
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
tables = cur.fetchall()
print(f'Tables: {len(tables)}')
if tables:
    for t in tables:
        print(f'  - {t[0]}')
    # Check for user
    try:
        cur.execute('SELECT email FROM "Users"')
        users = cur.fetchall()
        print(f'Users in production: {users}')
    except Exception:
        pass
cur.close()
conn.close()

# Check local PostgreSQL
print()
print('=== LOCAL (localhost) ===')
try:
    conn2 = psycopg2.connect(
        host=os.environ.get('LOCAL_DB_HOST', 'localhost'),
        port=int(os.environ.get('LOCAL_DB_PORT', '5432')),
        database=os.environ['LOCAL_DB_NAME'],
        user=os.environ['LOCAL_DB_USER'],
        password=os.environ['LOCAL_DB_PASSWORD']
    )
    cur2 = conn2.cursor()
    cur2.execute('SELECT email FROM "Users"')
    users = cur2.fetchall()
    print(f'Users in local: {users}')
    cur2.close()
    conn2.close()
except Exception as e:
    print(f'Local DB error: {e}')
