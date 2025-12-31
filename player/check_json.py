"""Output booking status as JSON"""
import json
import requests
from datetime import datetime, date

with open('cache/cache_manifest.json') as f:
    manifest = json.load(f)

booking_id = list(manifest['bookings'].keys())[0]
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjU3YjJkYjFlLTQ0N2ItNDY3Mi05YzdmLWY2MTg2YjI3YzI2ZiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6ImFkbWluQGNjbXMuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQWRtaW4iLCJleHAiOjE3Njc5MjQwNTMsImlzcyI6IkNDTVMiLCJhdWQiOiJDQ01TQ2xpZW50cyJ9.TwKLp9w0K_eenI4fFcCFwKcOKt1MojVVvmQQQTxGx0I"

r = requests.get(f'http://localhost:5257/api/bookings/{booking_id}', headers={'Authorization': f'Bearer {token}'})

result = {}
if r.status_code == 200:
    booking = r.json()['data']
    start = datetime.fromisoformat(booking['startDate'].replace('Z', '+00:00')).date()
    end = datetime.fromisoformat(booking['endDate'].replace('Z', '+00:00')).date()
    today = date.today()
    
    days_past_end = (today - end).days if today > end else 0
    
    result = {
        "booking_id": booking_id,
        "campaign": booking.get('campaignName', 'N/A'),
        "start_date": str(start),
        "end_date": str(end),
        "today": str(today),
        "db_status": booking['status'],
        "screen_id": booking['screenId'],
        "days_past_end": days_past_end,
        "is_expired": today > end,
        "is_active": start <= today <= end,
        "is_future": today < start,
        "should_be_deleted": days_past_end > 1,
        "video_count": len(manifest['bookings'][booking_id]['videos']),
        "videos": [v['creative_id'] for v in manifest['bookings'][booking_id]['videos']]
    }
else:
    result = {"error": f"API returned {r.status_code}", "booking_id": booking_id}

with open('booking_check_result.json', 'w') as f:
    json.dump(result, f, indent=2)

print(json.dumps(result, indent=2))
