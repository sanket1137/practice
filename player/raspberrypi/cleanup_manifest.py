"""
Cleanup Script - Remove Corrupt Cache Manifest Entries

This script removes:
1. Entries with null booking_id or creative_id
2. Entries pointing to non-existent files
3. Entries with old slot-based paths
"""

import json
import os
from pathlib import Path

# Load manifest
manifest_path = Path(__file__).parent / 'cache' / 'cache_manifest.json'
with open(manifest_path, 'r') as f:
    manifest = json.load(f)

# Cleanup
removed_bookings = []
total_removed_videos = 0

for booking_id, booking_data in list(manifest['bookings'].items()):
    # Remove bookings with None/null ID
    if booking_id == "None" or booking_id == "null" or not booking_id:
        print(f"Removing corrupt booking: {booking_id}")
        del manifest['bookings'][booking_id]
        removed_bookings.append(booking_id)
        continue
    
    # Check videos in this booking
    videos_to_remove = []
    for idx, video in enumerate(booking_data['videos']):
        creative_id = video.get('creative_id')
        file_path = video.get('file_path')
        
        # Remove if creative_id is null
        if not creative_id or creative_id == "null":
            print(f"  Removing video with null creative_id from booking {booking_id}")
            videos_to_remove.append(idx)
            total_removed_videos += 1
            continue
        
        # Remove if file doesn't exist
        if not os.path.exists(file_path):
            print(f"  Removing missing file: {file_path}")
            videos_to_remove.append(idx)
            total_removed_videos += 1
            continue
        
        # Update slot-based paths to creative-based
        if 'slot_' in file_path:
            old_path = file_path
            new_filename = f"{creative_id}.mp4"
            new_path = os.path.join(os.path.dirname(__file__), 'video_cache', new_filename)
            
            # Rename file if it exists
            if os.path.exists(old_path):
                os.rename(old_path, new_path)
                video['file_path'] = new_path
                print(f"  Migrated: {os.path.basename(old_path)} → {new_filename}")
    
    # Remove marked videos
    for idx in reversed(videos_to_remove):
        booking_data['videos'].pop(idx)
    
    # Remove booking if no videos left
    if not booking_data['videos']:
        print(f"Removing empty booking: {booking_id}")
        del manifest['bookings'][booking_id]
        removed_bookings.append(booking_id)

# Save cleaned manifest
with open(manifest_path, 'w') as f:
    json.dump(manifest, f, indent=2)

print("\n" + "=" * 60)
print("CLEANUP COMPLETE")
print("=" * 60)
print(f"Removed {len(removed_bookings)} corrupt bookings")
print(f"Removed {total_removed_videos} corrupt video entries")
print(f"Remaining bookings: {len(manifest['bookings'])}")
print("\nManifest has been cleaned and saved!")
