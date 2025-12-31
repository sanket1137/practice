"""
Check if cached videos are from old or current bookings
"""
import json
import requests
from pathlib import Path
from datetime import datetime, date

# Setup
player_dir = Path(__file__).parent
cache_manifest_path = player_dir / "cache" / "cache_manifest.json"
screen_id = "c8f0d020-f581-4fa3-b482-c5026ded5a4f"
api_url = "http://localhost:5257"

# Admin token (from your previous sessions)
admin_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjU3YjJkYjFlLTQ0N2ItNDY3Mi05YzdmLWY2MTg2YjI3YzI2ZiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6ImFkbWluQGNjbXMuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQWRtaW4iLCJleHAiOjE3Njc5MjQwNTMsImlzcyI6IkNDTVMiLCJhdWQiOiJDQ01TQ2xpZW50cyJ9.TwKLp9w0K_eenI4fFcCFwKcOKt1MojVVvmQQQTxGx0I"

# Get today's date
today = date.today()
print("=" * 80)
print(f"BOOKING STATUS CHECK - {today}")
print("=" * 80)
print(f"Screen ID: {screen_id}")

# Load cache manifest
with open(cache_manifest_path) as f:
    manifest = json.load(f)

booking_ids = list(manifest['bookings'].keys())
print(f"\nBookings in cache manifest: {len(booking_ids)}")

# Query each booking from database
for booking_id in booking_ids:
    print(f"\n{'-' * 80}")
    try:
        response = requests.get(
            f"{api_url}/api/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            booking = response.json().get('data', {})
            
            # Parse dates
            start_date = datetime.fromisoformat(booking['startDate'].replace('Z', '+00:00')).date()
            end_date = datetime.fromisoformat(booking['endDate'].replace('Z', '+00:00')).date()
            
            # Determine status
            if today < start_date:
                status = "[FUTURE]"
                status_detail = f"Starts in {(start_date - today).days} days"
            elif today > end_date:
                days_ago = (today - end_date).days
                status = f"[EXPIRED] ({days_ago} days ago)"
                status_detail = f"Ended {days_ago} day(s) ago"
            else:
                status = "[ACTIVE/ONGOING]"
                days_left = (end_date - today).days
                status_detail = f"Ends in {days_left} day(s)" if days_left > 0 else "Ends today"
            
            print(f"Booking ID: {booking_id}")
            print(f"Status: {status} - {status_detail}")
            print(f"Campaign: {booking.get('campaignName', 'N/A')}")
            print(f"Start Date: {start_date}")
            print(f"End Date: {end_date}")
            print(f"Booking Status: {booking.get('status', 'Unknown')}")
            print(f"Screen ID: {booking.get('screenId', 'N/A')}")
            
            # Get creative info from manifest
            videos = manifest['bookings'][booking_id].get('videos', [])
            print(f"Cached Videos: {len(videos)}")
            for video in videos:
                print(f"  - {video['creative_id']}.mp4")
                
        elif response.status_code == 404:
            print(f"Booking ID: {booking_id}")
            print(f"Status: [NOT FOUND IN DATABASE]")
            print(f"Note: Booking was deleted but cache not cleaned")
        else:
            print(f"Booking ID: {booking_id}")
            print(f"ERROR: API returned {response.status_code}")
            
    except Exception as e:
        print(f"Booking ID: {booking_id}")
        print(f"ERROR: {e}")

# Summary
print(f"\n{'=' * 80}")
print("SUMMARY:")
print("=" * 80)
print(f"Today: {today}")
print(f"Screen ID: {screen_id}")
print(f"\nRecommendation:")
print("- [ACTIVE] bookings: Keep videos (currently playing or scheduled for today)")
print("- [EXPIRED] bookings (>1 day ago): Should be cleaned up automatically")
print("- [NOT FOUND]: Orphaned cache - can delete manually")
print("=" * 80)
