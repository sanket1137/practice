import os
import sys

import psycopg2

conn = psycopg2.connect(
    host=os.environ["PGHOST"],
    database=os.environ["PGDATABASE"],
    user=os.environ["PGUSER"],
    password=os.environ["PGPASSWORD"],
    sslmode="require",
)
cur = conn.cursor()

if len(sys.argv) < 2:
    print("Usage: python reset_device_binding.py <screen_id>")
    sys.exit(1)
screen_id = sys.argv[1]

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
