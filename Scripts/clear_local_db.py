"""Clear local PostgreSQL database entirely.

USAGE: set env vars before running:
  export LOCAL_DB_HOST=localhost LOCAL_DB_PORT=5432 LOCAL_DB_NAME=... LOCAL_DB_USER=... LOCAL_DB_PASSWORD=...
"""
import os

import psycopg2

conn = psycopg2.connect(
    host=os.environ.get('LOCAL_DB_HOST', 'localhost'),
    port=int(os.environ.get('LOCAL_DB_PORT', '5432')),
    database=os.environ['LOCAL_DB_NAME'],
    user=os.environ['LOCAL_DB_USER'],
    password=os.environ['LOCAL_DB_PASSWORD']
)
conn.autocommit = True
cur = conn.cursor()

print('Connected to local PostgreSQL!')

# List all tables first
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
tables = cur.fetchall()
print(f'Tables found: {tables}')

if not tables:
    print('No tables in database!')
else:
    # Drop all tables
    print(f'Dropping {len(tables)} tables...')

    for table in tables:
        table_name = table[0]
        print(f'  Dropping: {table_name}')
        cur.execute(f'DROP TABLE IF EXISTS public."{table_name}" CASCADE')

print('Local database cleared!')
cur.close()
conn.close()
