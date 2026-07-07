#!/bin/bash
python3 -c "import json; open('/tmp/pt.json','w').write(json.dumps({'deviceFingerprint':'test-fp-abc','deviceModel':'Firestick4K','osVersion':'9','appVersion':'1.0.0'}))"
curl -s -X POST https://ccms.pixelspot.in/api/v1/player/pairing/request -H 'Content-Type: application/json' -d @/tmp/pt.json
