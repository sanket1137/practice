#!/usr/bin/env python3
"""
CMS pairing CLI for the Raspberry Pi player.

Usage (run on the Pi, interactively):
    python3 cms_pair.py [--server https://ccms.pixelspot.in]

Prompts for the 6-character pairing code the CMS owner just generated in
the dashboard. On success, writes the returned screenId + apiKey into
`config.json`, overwriting any previous credentials.

Posts to:  POST {server}/api/v1/cms/pairing/claim
Body:      { code, deviceFingerprint, deviceModel, osVersion, appVersion }
Response:  ApiResponse<ClaimPairingCodeResponse>
"""

import argparse
import json
import os
import platform
import socket
import sys
import uuid

import requests

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


def device_fingerprint() -> str:
    """Stable fingerprint combining hostname + MAC address."""
    try:
        mac = uuid.getnode()
        host = socket.gethostname()
        return f"{host}-{mac:012x}"
    except Exception:
        return str(uuid.uuid4())


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(description="Claim a CMS pairing code")
    parser.add_argument(
        "--server",
        default=os.environ.get("CCMS_SERVER", "https://ccms.pixelspot.in"),
        help="CCMS backend base URL",
    )
    parser.add_argument("--code", help="6-character pairing code (skip prompt)")
    args = parser.parse_args()

    code = (args.code or input("Enter 6-character pairing code: ").strip()).upper()
    if len(code) != 6:
        print(f"Error: code must be exactly 6 characters (got {len(code)})", file=sys.stderr)
        return 2

    url = f"{args.server.rstrip('/')}/api/v1/cms/pairing/claim"
    body = {
        "code": code,
        "deviceFingerprint": device_fingerprint(),
        "deviceModel": platform.machine() or "raspberrypi",
        "osVersion": f"{platform.system()} {platform.release()}",
        "appVersion": "1.0.0-rpi",
    }

    print(f"Claiming code {code} at {url}...")
    try:
        resp = requests.post(url, json=body, timeout=15)
    except requests.RequestException as e:
        print(f"Network error: {e}", file=sys.stderr)
        return 3

    if resp.status_code != 200:
        print(f"HTTP {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
        return 4

    envelope = resp.json()
    if not envelope.get("success"):
        print(f"Server error: {envelope.get('message')}", file=sys.stderr)
        return 5

    data = envelope.get("data") or {}
    screen_id = data.get("screenId")
    api_key = data.get("apiKey")
    screen_name = data.get("screenName") or "screen"
    if not screen_id or not api_key:
        print(f"Malformed response: {envelope}", file=sys.stderr)
        return 6

    cfg = load_config()
    cfg["screen_id"] = screen_id
    cfg["api_key"] = api_key
    cfg.setdefault("api_url", args.server.rstrip("/"))
    save_config(cfg)

    print(f"✓ Paired with '{screen_name}' (screenId={screen_id})")
    print(f"  Credentials saved to {CONFIG_PATH}")
    print("  Restart the player to pick up the new configuration.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
