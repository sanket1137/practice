"""Clear production Neon PostgreSQL database entirely"""
import psycopg2

# Neon PostgreSQL Production
conn = psycopg2.connect(
    host='ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech',
    database='pixelspot_ccms',
    user='neondb_owner',
    password='npg_Y9bQL3rHdXPq',
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

print("\n✅ Production database cleared!")
