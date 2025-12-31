"""
Test script to verify cache cleanup logic
Shows what's tracked, what would be deleted, and why
"""
import json
import os
from pathlib import Path
from datetime import datetime, timedelta
import requests

# Setup
player_dir = Path(__file__).parent
cache_manifest_path = player_dir / "cache" / "cache_manifest.json"
video_cache_dir = player_dir / "video_cache"
screen_id = "c8f0d020-f581-4fa3-b482-c5026ded5a4f"
api_url = "http://localhost:5257"
api_key = "test-api-key"

print("=" * 60)
print("CACHE CLEANUP VERIFICATION")
print("=" * 60)

# 1. Check files in video_cache
print(f"\n1. FILES IN video_cache FOLDER:")
cache_files = list(video_cache_dir.glob("*.mp4"))
print(f"   Total files: {len(cache_files)}")
for f in cache_files:
    size_mb = f.stat().st_size / (1024 * 1024)
    age_days = (datetime.now() - datetime.fromtimestamp(f.stat().st_mtime)).days
    print(f"   - {f.name} ({size_mb:.2f} MB, {age_days} days old)")

# 2. Check manifest
print(f"\n2. CACHE MANIFEST STATUS:")
if cache_manifest_path.exists():
    with open(cache_manifest_path) as f:
        manifest = json.load(f)
    
    print(f"   Bookings tracked: {len(manifest['bookings'])}")
    print(f"   Last cleanup: {manifest.get('last_cleanup', 'Never')}")
    
    tracked_files = set()
    for booking_id, booking_data in manifest['bookings'].items():
        print(f"\n   Booking {booking_id}:")
        print(f"     Campaign: {booking_data.get('campaign_id', 'N/A')}")
        print(f"     Videos: {len(booking_data.get('videos', []))}")
        for video in booking_data.get('videos', []):
            file_path = video.get('file_path', '')
            creative_id = video.get('creative_id', '')
            tracked_files.add(os.path.basename(file_path))
            print(f"       - {creative_id}.mp4")
    
    # 3. Find orphaned files
    print(f"\n3. ORPHANED FILES (not in manifest):")
    orphaned = []
    for f in cache_files:
        if f.name not in tracked_files:
            orphaned.append(f.name)
            print(f"   - {f.name} ← Can be deleted safely")
    
    if not orphaned:
        print("   None - all files are tracked")
    
else:
    print("   No manifest found!")

# 4. Query backend for expired bookings
print(f"\n4. BACKEND EXPIRED BOOKINGS CHECK:")
try:
    response = requests.get(
        f"{api_url}/api/player/expired-cache/{screen_id}",
        headers={"X-API-Key": api_key},
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json().get('data', {})
        expired = data.get('expiredBookings', [])
        checked_at = data.get('checkedAt', '')
        
        print(f"   Checked at: {checked_at}")
        print(f"   Expired bookings: {len(expired)}")
        
        if expired:
            print(f"\n   Bookings safe to delete:")
            for exp in expired:
                print(f"     - Booking: {exp['bookingId']}")
                print(f"       End Date: {exp['endDate']}")
                print(f"       Safe to delete: {exp['safeToDelete']}")
        else:
            print(f"   ✓ No expired bookings - all videos are still in use")
            print(f"   (Bookings must be >1 day past EndDate to be removed)")
    else:
        print(f"   ERROR: API returned {response.status_code}")
        print(f"   {response.text}")
        
except Exception as e:
    print(f"   ERROR: {e}")

# 5. Summary
print(f"\n" + "=" * 60)
print("SUMMARY:")
print("=" * 60)
print(f"Total files in cache: {len(cache_files)}")
if cache_manifest_path.exists():
    print(f"Files tracked in manifest: {len(tracked_files)}")
    print(f"Orphaned files (can delete): {len(orphaned)}")
print(f"Expired bookings (backend): {len(expired) if 'expired' in locals() else 'Unknown'}")
print()
print("CLEANUP BEHAVIOR:")
print("- Tracked files are kept if booking is still active")
print("- Tracked files are deleted if booking ended >1 day ago")
print("- Orphaned files are NOT auto-deleted (manual cleanup needed)")
print("=" * 60)
