"""
Verify Neon production database tables
"""
import psycopg2

conn = psycopg2.connect(
    host='ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech',
    database='pixelspot_ccms',
    user='neondb_owner',
    password='npg_Y9bQL3rHdXPq',
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
    print(f'  ✅ {t[0]}')
print('=' * 40)
print(f'Total: {len(tables)} tables')

# Check migrations history
cursor.execute("""
    SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
""")
migrations = cursor.fetchall()
print('\nApplied Migrations:')
for m in migrations:
    print(f'  📦 {m[0]}')

cursor.close()
conn.close()
