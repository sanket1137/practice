"""
Simple check: Are cached videos from old or current bookings?
"""
import json
import requests
from datetime import datetime, date

# Get booking ID from manifest
with open('cache/cache_manifest.json') as f:
    manifest = json.load(f)

booking_id = list(manifest['bookings'].keys())[0]
print(f"Checking booking: {booking_id}")

# Query the booking
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjU3YjJkYjFlLTQ0N2ItNDY3Mi05YzdmLWY2MTg2YjI3YzI2ZiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6ImFkbWluQGNjbXMuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQWRtaW4iLCJleHAiOjE3Njc5MjQwNTMsImlzcyI6IkNDTVMiLCJhdWQiOiJDQ01TQ2xpZW50cyJ9.TwKLp9w0K_eenI4fFcCFwKcOKt1MojVVvmQQQTxGx0I"

r = requests.get(
    f'http://localhost:5257/api/bookings/{booking_id}',
    headers={'Authorization': f'Bearer {token}'}
)

if r.status_code == 200:
    booking = r.json()['data']
    
    # Parse dates
    start = datetime.fromisoformat(booking['startDate'].replace('Z', '+00:00')).date()
    end = datetime.fromisoformat(booking['endDate'].replace('Z', '+00:00')).date()
    today = date.today()
    
    print(f"\nBooking Details:")
    print(f"  Campaign: {booking.get('campaignName', 'N/A')}")
    print(f"  Start Date: {start}")
    print(f"  End Date: {end}")
    print(f"  Today: {today}")
    print(f"  Status (DB): {booking['status']}")
    print(f"  Screen ID: {booking['screenId']}")
    
    # Determine if active, expired, or future
    if today < start:
        print(f"\n  STATUS: FUTURE (starts in {(start - today).days} days)")
    elif today > end:
        days_past = (today - end).days
        print(f"\n  STATUS: EXPIRED {days_past} day(s) ago")
        if days_past > 1:
            print(f"  ACTION: Should be auto-deleted by cleanup")
        else:
            print(f"  ACTION: Will be deleted tomorrow (needs >1 day buffer)")
    else:
        print(f"\n  STATUS: ACTIVE/ONGOING")
        if today == end:
            print(f"  ACTION: Ends today - will be kept until tomorrow")
        else:
            print(f"  ACTION: Keep (ends in {(end - today).days} days)")
    
    # Check videos
    videos = manifest['bookings'][booking_id]['videos']
    print(f"\n  Cached Videos: {len(videos)}")
    for v in videos:
        print(f"    - {v['creative_id']}.mp4")
        
elif r.status_code == 404:
    print(f"\nERROR: Booking not found in database!")
    print(f"ACTION: This is orphaned cache - can be deleted manually")
else:
    print(f"\nERROR: API returned {r.status_code}")

print(f"\n" + "="*60)
print("CONCLUSION:")
videos_count = len(list(manifest['bookings'].values())[0]['videos'])
print(f"The {videos_count} video(s) in video_cache are from this booking.")
print("="*60)
