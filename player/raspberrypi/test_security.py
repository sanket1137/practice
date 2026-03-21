"""
Test script for CCMS Player Security Features
Tests handshake with API key verification and device binding
"""

import json
import time
import sys
import os

# Add player directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
from security_manager import PlayerSecurityManager, SecurePlayerConfig

# Load config
with open('config.json') as f:
    config = json.load(f)

SCREEN_ID = config['screen_id']
API_KEY = config['api_key']
SERVER_URL = config['server_url']

print("=" * 60)
print("CCMS Player Security Test")
print("=" * 60)
print(f"Screen ID: {SCREEN_ID}")
print(f"Server URL: {SERVER_URL}")
print(f"API Key: {API_KEY[:20]}...")
print()

# Initialize security manager
security_manager = PlayerSecurityManager(api_key=API_KEY, screen_id=SCREEN_ID)
device_fingerprint = SecurePlayerConfig.generate_device_fingerprint()
print(f"Device Fingerprint: {device_fingerprint[:32]}...")
print()

# Test 1: Handshake with valid credentials
print("Test 1: Handshake with VALID credentials")
print("-" * 40)

nonce = security_manager.generate_nonce()
timestamp = int(time.time())

handshake_payload = {
    "screenId": SCREEN_ID,
    "apiKey": API_KEY,
    "deviceFingerprint": device_fingerprint,
    "nonce": nonce,
    "timestamp": timestamp,
    "playerVersion": "1.1.0"
}

try:
    response = requests.post(
        f"{SERVER_URL}/api/player/handshake",
        json=handshake_payload,
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            result = data.get('data', {})
            print(f"✅ Handshake SUCCESS!")
            print(f"   Server Time: {result.get('serverTime')}")
            print(f"   Device Binding Status: {result.get('deviceBindingStatus')}")
            print(f"   Session Token: {result.get('sessionToken', 'N/A')[:30]}...")
            print(f"   Sync Interval: {result.get('syncIntervalMinutes')} minutes")
            
            playlist = result.get('playlist', {})
            if playlist:
                items = playlist.get('playlist', [])
                print(f"   Playlist Items: {len(items)}")
        else:
            print(f"❌ Handshake failed: {data.get('message')}")
    elif response.status_code == 401:
        print(f"❌ Unauthorized: {response.text}")
    else:
        print(f"❌ HTTP Error: {response.text}")
except Exception as e:
    print(f"❌ Request failed: {e}")

print()

# Test 2: Handshake with WRONG API key
print("Test 2: Handshake with WRONG API key")
print("-" * 40)

wrong_payload = {
    "screenId": SCREEN_ID,
    "apiKey": "WRONG-API-KEY-12345",
    "deviceFingerprint": device_fingerprint,
    "nonce": security_manager.generate_nonce(),
    "timestamp": int(time.time()),
    "playerVersion": "1.1.0"
}

try:
    response = requests.post(
        f"{SERVER_URL}/api/player/handshake",
        json=wrong_payload,
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 401:
        print(f"✅ Correctly rejected with 401 Unauthorized")
    else:
        print(f"⚠️ Unexpected status code: {response.status_code}")
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"❌ Request failed: {e}")

print()

# Test 3: Handshake with different device fingerprint
print("Test 3: Handshake with DIFFERENT device fingerprint")
print("-" * 40)

diff_fingerprint_payload = {
    "screenId": SCREEN_ID,
    "apiKey": API_KEY,
    "deviceFingerprint": "DIFFERENT-DEVICE-FINGERPRINT-" + str(int(time.time())),
    "nonce": security_manager.generate_nonce(),
    "timestamp": int(time.time()),
    "playerVersion": "1.1.0"
}

try:
    response = requests.post(
        f"{SERVER_URL}/api/player/handshake",
        json=diff_fingerprint_payload,
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 401:
        print(f"✅ Correctly rejected (device bound to different fingerprint)")
    elif response.status_code == 200:
        data = response.json()
        result = data.get('data', {})
        status = result.get('deviceBindingStatus')
        if status == 'mismatch':
            print(f"✅ Device mismatch detected: {status}")
        else:
            print(f"⚠️ Accepted with status: {status}")
    else:
        print(f"⚠️ Status: {response.status_code} - {response.text}")
except Exception as e:
    print(f"❌ Request failed: {e}")

print()
print("=" * 60)
print("Security Tests Complete")
print("=" * 60)
