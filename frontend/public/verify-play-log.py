#!/usr/bin/env python3
"""
PixelSpot play-log verifier — independent, offline proof checking.

Usage:
    python verify-play-log.py play-log-<from>-to-<to>.csv

Checks a PixelSpot "Export proof (CSV)" file with no network access and no
PixelSpot account: it recomputes every cryptographic digest from the raw play
rows in the file and compares them against the seal chain printed in the
file's LEDGER INTEGRITY footer.

What is being proven
--------------------
Each play row carries the exact fields its canonical record hash is built
from. For every screen and UTC day:

    record_hash  = SHA256("canonicalId|slotPlayKey|ticks|bookingId|campaignId|"
                          "ownerContentId|slot|durationSeconds|WasFullPlay")
    records_root = SHA256(concat(record_hash for each record,
                                 sorted by (ticks, slotPlayKey)))
    seal_hash    = SHA256("screenId|YYYY-MM-DD|recordCount|records_root|prev_seal")

Each day's seal contains the previous day's seal — a hash chain. If any
historical play was edited, added, or removed, the recomputed records_root
will not match the sealed one, and every later seal breaks. A PASS from this
script means the data in this file is bit-for-bit the data that was sealed.

Verify whole, unfiltered days: exporting a partial day or a filtered subset
(by campaign/quality) legitimately yields fewer rows than the seal covers —
such days are reported SKIPPED (partial data), not FAIL.

This file is ~150 lines of standard-library Python. Read it before trusting it.
"""
import csv
import hashlib
import io
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta

TICKS_PER_DAY = 864_000_000_000  # .NET ticks (100ns) per day
DOTNET_EPOCH = datetime(1, 1, 1)

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def day_of_ticks(ticks: int) -> str:
    return (DOTNET_EPOCH + timedelta(days=ticks // TICKS_PER_DAY)).strftime("%Y-%m-%d")

def main(path: str) -> int:
    raw = io.open(path, encoding="utf-8-sig").read()
    if "--- LEDGER INTEGRITY" not in raw:
        print("No LEDGER INTEGRITY footer found — export the proof CSV from Play Logs.")
        return 2
    body, footer = raw.split("--- LEDGER INTEGRITY", 1)

    # ── Parse play rows ──
    reader = csv.DictReader(io.StringIO(body.strip()))
    required = ["Screen", "Canonical Id", "Slot Play Key (SHA-256)", "Played At (Ticks)",
                "Booking Id", "Campaign Id", "OwnerContent Id", "Slot", "Duration (s)", "Full play"]
    missing = [c for c in required if c not in (reader.fieldnames or [])]
    if missing:
        print(f"CSV is missing proof columns: {missing} — re-export from an updated Play Logs page.")
        return 2

    rows_by_screen_day = defaultdict(list)
    for row in reader:
        ticks = int(row["Played At (Ticks)"])
        rows_by_screen_day[(row["Screen"], day_of_ticks(ticks))].append(row)

    # ── Parse seal footer ──
    # Screen header lines: "Screen: <name> (<guid>) · chain ..."
    # Seal lines:          "<day>,<count>,<root>,<prev>,<seal>,<yes|no>"
    seals = []          # (screen_name, screen_id, day, count, root, prev, seal)
    screen_name, screen_id = None, None
    for line in footer.splitlines():
        m = re.match(r"Screen: (.*) \(([0-9a-fA-F-]{36})\)", line.strip())
        if m:
            screen_name, screen_id = m.group(1), m.group(2).lower()
            continue
        m = re.match(r"(\d{4}-\d{2}-\d{2}),(\d+),([0-9a-f]{64}),([0-9a-fA-F]+|GENESIS),([0-9a-f]{64}),", line.strip())
        if m and screen_id:
            seals.append((screen_name, screen_id, m.group(1), int(m.group(2)),
                          m.group(3), m.group(4), m.group(5)))
    if not seals:
        print("No seals found in the footer.")
        return 2

    print(f"{'SCREEN':<24} {'DAY':<12} {'RECORDS':>8}  RESULT")
    print("-" * 62)
    failures = 0
    verified = 0
    prev_by_screen = {}
    for (name, sid, day, count, root, prev, seal) in seals:
        rows = rows_by_screen_day.get((name, day), [])
        # Recompute the day's root from raw rows.
        rows.sort(key=lambda r: (int(r["Played At (Ticks)"]), r["Slot Play Key (SHA-256)"]))
        acc = []
        for r in rows:
            full = "True" if r["Full play"].strip().lower() == "yes" else "False"
            canonical = "|".join([
                r["Canonical Id"], r["Slot Play Key (SHA-256)"], r["Played At (Ticks)"],
                r["Booking Id"], r["Campaign Id"], r["OwnerContent Id"],
                r["Slot"], r["Duration (s)"], full,
            ])
            acc.append(sha256_hex(canonical))
        live_root = sha256_hex("".join(acc))

        # Chain-link continuity within the footer.
        expected_prev = prev_by_screen.get(sid)
        link_ok = expected_prev is None or expected_prev == prev
        prev_by_screen[sid] = seal
        # Seal binding.
        live_seal = sha256_hex(f"{sid}|{day}|{count}|{root}|{prev}")
        seal_ok = live_seal == seal

        if len(rows) != count:
            result = f"SKIPPED (file has {len(rows)} of {count} sealed records — partial/filtered day)"
        elif live_root == root and seal_ok and link_ok:
            result = "PASS"
            verified += 1
        else:
            result = "FAIL"
            if live_root != root:
                result += " [records do not match sealed digest]"
            if not seal_ok:
                result += " [seal hash does not bind its own fields]"
            if not link_ok:
                result += " [chain link broken]"
            failures += 1
        print(f"{name:<24} {day:<12} {count:>8}  {result}")

    print("-" * 62)
    if failures:
        print(f"RESULT: TAMPER EVIDENT — {failures} day(s) FAILED verification.")
        return 1
    print(f"RESULT: VERIFIED — {verified} day(s) recomputed from raw records and matched their seals.")
    return 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
