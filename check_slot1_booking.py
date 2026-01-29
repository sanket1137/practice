import psycopg2
from datetime import date

conn = psycopg2.connect('host=localhost port=5432 dbname=ccms user=postgres password=admin')
cur = conn.cursor()

cur.execute("""
    SELECT b.id, b.slot_number, c.name, c.url, b.start_date, b.end_date, b.status 
    FROM "Bookings" b 
    JOIN "Creatives" c ON b.creative_id = c.id 
    WHERE b.screen_id = '33a535f1-1ed0-4519-a03c-0f81fa8e9cac' 
    AND b.slot_number = 1 
    AND b.status IN ('Approved', 'Active') 
    AND CURRENT_DATE BETWEEN b.start_date AND b.end_date 
    ORDER BY b.start_date DESC 
    LIMIT 1
""")

row = cur.fetchone()
if row:
    print(f"✅ Found active booking for Slot 1:")
    print(f"   Booking ID: {row[0]}")
    print(f"   Slot: {row[1]}")
    print(f"   Creative: {row[2]}")
    print(f"   URL: {row[3]}")
    print(f"   Period: {row[4]} to {row[5]}")
    print(f"   Status: {row[6]}")
else:
    print("❌ No active booking found for Slot 1")

cur.close()
conn.close()
