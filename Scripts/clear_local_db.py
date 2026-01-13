"""Clear local PostgreSQL database entirely"""
import psycopg2

# Correct credentials from appsettings.json
conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='pixelspotccms',
    user='rootadmin',
    password='$@Nket1703'
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

print('✅ Local database cleared!')
cur.close()
conn.close()
