"""Check both databases for the user"""
import psycopg2

# Check production Neon
print('=== PRODUCTION (Neon) ===')
conn = psycopg2.connect(
    host='ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech',
    database='pixelspot_ccms',
    user='neondb_owner',
    password='npg_Y9bQL3rHdXPq',
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
    except:
        pass
cur.close()
conn.close()

# Check local PostgreSQL
print()
print('=== LOCAL (localhost) ===')
try:
    conn2 = psycopg2.connect(
        host='localhost',
        port=5432,
        database='pixelspotccms',
        user='rootadmin',
        password='rootadmin'
    )
    cur2 = conn2.cursor()
    cur2.execute('SELECT email FROM "Users"')
    users = cur2.fetchall()
    print(f'Users in local: {users}')
    cur2.close()
    conn2.close()
except Exception as e:
    print(f'Local DB error: {e}')
