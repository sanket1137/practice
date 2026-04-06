import psycopg2

conn = psycopg2.connect(
    host='ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech',
    database='pixelspot_ccms',
    user='neondb_owner',
    password='npg_Y9bQL3rHdXPq',
    sslmode='require'
)
cur = conn.cursor()
screen_id = '2070e7ed-8f59-4858-958e-a4d8ec056ab7'

# Check current state
cur.execute('SELECT "DeviceFingerprintHash", "DeviceBoundAt", "VerificationStatus" FROM "Screens" WHERE "Id" = %s', (screen_id,))
row = cur.fetchone()
print(f"Current state: fingerprint={row[0][:10] + '...' if row[0] else None}, bound_at={row[1]}, verification={row[2]}")

# Clear device binding
cur.execute('UPDATE "Screens" SET "DeviceFingerprintHash" = NULL, "DeviceBoundAt" = NULL WHERE "Id" = %s', (screen_id,))
print(f"{cur.rowcount} rows updated - device binding cleared")
conn.commit()

cur.close()
conn.close()
print("Done! Refresh the player page and it will re-bind to the current device.")
