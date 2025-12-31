"""
Check booking status without needing API authentication
Uses cache manifest and file modification times
"""
import json
import os
from datetime import datetime, date, timedelta
from pathlib import Path

print("=" * 70)
print("CACHED VIDEO STATUS CHECK")
print("=" * 70)

# Read manifest
manifest_path = Path('cache/cache_manifest.json')
with open(manifest_path) as f:
    manifest = json.load(f)

print(f"\nToday: {date.today()}")
print(f"Screen ID: c8f0d020-f581-4fa3-b482-c5026ded5a4f")

# Check each booking
for booking_id, booking_data in manifest['bookings'].items():
    print(f"\n{'-' * 70}")
    print(f"Booking ID: {booking_id}")
    print(f"Campaign ID: {booking_data.get('campaign_id', 'Unknown')}")
    print(f"Last Accessed: {booking_data.get('last_accessed', 'Unknown')}")
    
    # Check video files
    videos = booking_data.get('videos', [])
    print(f"Videos: {len(videos)}")
    
    for video in videos:
        creative_id = video.get('creative_id', '')
        file_path = video.get('file_path', '')
        
        if os.path.exists(file_path):
            file_stat = os.stat(file_path)
            file_size_mb = file_stat.st_size / (1024 * 1024)
            file_age_days = (datetime.now() - datetime.fromtimestamp(file_stat.st_mtime)).days
            
            print(f"  - {creative_id}.mp4")
            print(f"    Size: {file_size_mb:.2f} MB")
            print(f"    Age: {file_age_days} days old")
            print(f"    Last Modified: {datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d')}")
        else:
            print(f"  - {creative_id}.mp4 (FILE MISSING!)")

# Get actual files in video_cache
print(f"\n{'=' * 70}")
print("FILES IN video_cache FOLDER:")
print("=" * 70)

video_cache = Path('video_cache')
cache_files = list(video_cache.glob('*.mp4'))
print(f"Total files: {len(cache_files)}\n")

for f in sorted(cache_files):
    size_mb = f.stat().st_size / (1024 * 1024)
    age_days = (datetime.now() - datetime.fromtimestamp(f.stat().st_mtime)).days
    last_mod = datetime.fromtimestamp(f.stat().st_mtime).strftime('%Y-%m-%d %H:%M')
    print(f"{f.name}")
    print(f"  Size: {size_mb:.2f} MB | Age: {age_days} days | Modified: {last_mod}")

# Summary
print(f"\n{'=' * 70}")
print("ANALYSIS:")
print("=" * 70)
print(f"Based on file age:")
print(f"- Files modified TODAY (0 days old): Current/active bookings")
print(f"- Files modified YESTERDAY (1 day old): Recent bookings (cleanup buffer)")
print(f"- Files modified 2+ days ago: OLD bookings (should be cleaned)")
print()
print("If files are 2+ days old but still in cache:")
print("  Reason 1: Booking EndDate is within last 24 hours")
print("  Reason 2: Booking is still active (EndDate in future)")
print("  Reason 3: Cleanup hasn't run yet")
print("=" * 70)
