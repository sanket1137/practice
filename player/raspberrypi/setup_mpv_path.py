"""
MPV Path Setup Helper for Windows
Run this before importing mpv to set up the correct DLL path
"""

import os
import sys

def setup_mpv_path():
    """Setup MPV DLL path for Windows"""
    
    # Check if we're on Windows
    if sys.platform != 'win32':
        return True
    
    # Try to find MPV DLL in common locations
    possible_paths = [
        # Local mpv_lib folder
        os.path.join(os.path.dirname(__file__), 'mpv_lib'),
        
        # Microsoft Store install
        os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\WindowsApps'),
        
        # Program Files
        r'C:\Program Files\mpv',
        r'C:\Program Files (x86)\mpv',
        
        # Portable installations
        r'C:\mpv',
    ]
    
    # Add paths to environment
    for path in possible_paths:
        if os.path.exists(path):
            os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
            print(f"[MPV Setup] Added to PATH: {path}")
    
    # Try to import mpv to test
    try:
        import mpv
        print(f"[MPV Setup] ✓ MPV loaded successfully")
        return True
    except OSError as e:
        print(f"[MPV Setup] ✗ Failed to load MPV: {e}")
        print(f"[MPV Setup] Please download libmpv-2.dll and place it in: {possible_paths[0]}")
        print(f"[MPV Setup] Download from: https://sourceforge.net/projects/mpv-player-windows/files/libmpv/")
        return False

if __name__ == "__main__":
    setup_mpv_path()
