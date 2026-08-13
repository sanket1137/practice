#!/bin/bash
# Quick verification script - checks API returns proxy URLs
RESP=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sanketdhole109@gmail.com","password":"Sanket@123"}')

# Extract token - try different JSON paths
TOKEN=$(echo "$RESP" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    # Try nested: {data: {token: ...}}
    if 'data' in d and isinstance(d['data'], dict):
        print(d['data'].get('token',''))
    # Try flat: {token: ...}
    elif 'token' in d:
        print(d['token'])
except: pass
" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "Login failed. Raw response (first 200 chars):"
    echo "$RESP" | head -c 200
    exit 1
fi
echo "Token obtained (${#TOKEN} chars)"

# Get slot status
SLOTS=$(curl -s http://localhost:5000/api/screens/07362a2c-3161-44cb-9ff3-7a0418368315/slots/status \
  -H "Authorization: Bearer $TOKEN")

echo "$SLOTS" | python3 -c "
import sys,json
try:
    data = json.load(sys.stdin)
    slots = data.get('data', data) if isinstance(data, dict) else data
    if isinstance(slots, dict):
        slots = slots.get('data', [])
    for slot in (slots if isinstance(slots, list) else []):
        url = slot.get('videoUrl') or 'null'
        print(f'Slot {slot.get(\"slotNumber\",\"?\")}: {url[:100]}')
except Exception as e:
    print(f'Parse error: {e}')
    print(sys.stdin.read()[:200])
"
