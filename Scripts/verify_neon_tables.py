"""
Verify Neon production database tables.

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
cursor = conn.cursor()

# List all tables
cursor.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
""")
tables = cursor.fetchall()

print('Production Database Tables:')
print('=' * 40)
for t in tables:
    print(f'  {t[0]}')
print('=' * 40)
print(f'Total: {len(tables)} tables')

# Check migrations history
cursor.execute("""
    SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
""")
migrations = cursor.fetchall()
print('\nApplied Migrations:')
for m in migrations:
    print(f'  {m[0]}')

cursor.close()
conn.close()
