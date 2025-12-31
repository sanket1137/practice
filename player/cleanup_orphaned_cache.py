"""
Cleanup orphaned videos in video_cache folder
Removes videos that are not tracked in cache_manifest.json
"""
import os
import json
from pathlib import Path

# Get paths
player_dir = Path(__file__).parent
video_cache_dir = player_dir / "video_cache"
cache_manifest_path = player_dir / "cache" / "cache_manifest.json"

def cleanup_orphaned_videos():
    """Remove videos from video_cache that aren't in the manifest"""
    
    if not video_cache_dir.exists():
        print(f"video_cache directory doesn't exist")
        return
    
    # Load manifest
    tracked_files = set()
    if cache_manifest_path.exists():
        with open(cache_manifest_path, 'r') as f:
            manifest = json.load(f)
            
        # Get all file paths from manifest
        for booking_id, booking_data in manifest.get('bookings', {}).items():
            for video in booking_data.get('videos', []):
                file_path = video.get('file_path', '')
                if file_path:
                    tracked_files.add(os.path.normpath(file_path))
        
        print(f"Found {len(tracked_files)} tracked videos in manifest")
    else:
        print("No cache manifest found - will delete all videos in video_cache")
    
    # Get all files in video_cache
    cache_files = list(video_cache_dir.glob("*.mp4"))
    print(f"Found {len(cache_files)} videos in video_cache folder")
    
    # Delete orphaned files
    deleted_count = 0
    for video_file in cache_files:
        video_path = os.path.normpath(str(video_file))
        
        if video_path not in tracked_files:
            try:
                os.remove(video_file)
                print(f"✓ Deleted orphaned video: {video_file.name}")
                deleted_count += 1
            except Exception as e:
                print(f"✗ Failed to delete {video_file.name}: {e}")
        else:
            print(f"  Keeping tracked video: {video_file.name}")
    
    print(f"\nCleanup complete: {deleted_count} orphaned videos deleted")

if __name__ == "__main__":
    cleanup_orphaned_videos()
