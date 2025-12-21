"""Test player configuration"""
import json
from pathlib import Path

# Test config
config_file = Path("config.json")
with open(config_file) as f:
    config = json.load(f)

print("Config loaded:")
print(f"  Screen ID: {config.get('screen_id')}")
print(f"  API Key: {config.get('api_key')[:20]}...")
print(f"  Server: {config.get('server_url')}")

# Test dependencies
try:
    import signalrcore
    print("OK: signalrcore installed")
except ImportError:
    print("MISSING: signalrcore - Install with: pip install signalrcore")

try:
    import requests
    print("OK: requests installed")
except ImportError:
    print("MISSING: requests - Install with: pip install requests")

try:
    import vlc
    print("OK: python-vlc installed")
except ImportError:
    print("MISSING: python-vlc - Install with: pip install python-vlc")

try:
    import schedule
    print("OK: schedule installed")
except ImportError:
    print("MISSING: schedule - Install with: pip install schedule")

print("\nIf all dependencies are OK, run: python ccms_player.py")
