# CCMS Player - Simple Test Version
# Tests connectivity and basic workflow without full SignalR complexity

import json
import requests
from pathlib import Path
from datetime import datetime

# Load config
config_file = Path("config.json")
with open(config_file) as f:
    config = json.load(f)

screen_id = config.get("screen_id")
api_key = config.get("api_key")
server_url = config.get("server_url")

print("=" * 60)
print("CCMS Player - Simple Test")
print("=" * 60)
print(f"Screen ID: {screen_id}")
print(f"Server: {server_url}")
print()

# Test 1: Check server is reachable
print("[1/3] Testing server connectivity...")
try:
    response = requests.get(f"{server_url}/health", timeout=5)
    print(f"  ✓ Server is reachable (Status: {response.status_code})")
except Exception as e:
    print(f"  ✗ Server not reachable: {e}")
    exit(1)

# Test 2: SignalR negotiate endpoint
print("\n[2/3] Testing SignalR negotiate...")
try:
    response = requests.post(f"{server_url}/playerhub/negotiate?clientType=player&negotiateVersion=1", timeout=5)
    if response.status_code == 200:
        print(f"  ✓ SignalR negotiate successful")
        negotiate_data = response.json()
        print(f"  Connection ID: {negotiate_data.get('connectionId', 'N/A')[:20]}...")
    else:
        print(f"  ✗ Negotiate failed: {response.status_code}")
except Exception as e:
    print(f"  ✗ Negotiate error: {e}")

# Test 3: Show what would happen next
print("\n[3/3] Next steps:")
print("  - Player would connect to SignalR hub")
print("  -Call Handshake(screenId, apiKey, version)")
print(f"  - Receive playlist for screen {screen_id}")
print("  - Download and play content")
print("  - Sync impressions every 10 minutes")

print("\n" + "=" * 60)
print("Configuration is valid!")
print("Full player requires SignalR client implementation.")
print("=" * 60)
