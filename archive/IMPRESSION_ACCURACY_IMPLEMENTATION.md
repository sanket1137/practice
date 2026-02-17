# Impression Accuracy & Deduplication Implementation

## Overview

This implementation ensures **100% accurate impression counts** in the database while maintaining **real-time SignalR updates** for the dashboard. It follows Option B as requested - SignalR broadcasts for real-time display only, with no DB writes from SignalR.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RASPBERRY PI PLAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Video Plays → record_impression() → ImpressionStore (SQLite)   │
│                           ↓                                      │
│                  Single Source of Truth                          │
│                  slot_play_key = SHA256(screenId+date+slot+sec)  │
│                           ↓                                      │
│              Every 10 min: sync_daily_data()                     │
│                           ↓                                      │
│              POST /api/player/sync (REST)                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      .NET SERVER                                 │
├─────────────────────────────────────────────────────────────────┤
│  PlayerController.Sync()                                        │
│       ↓                                                          │
│  Check SlotPlayKey exists in DB?                                │
│       ├─ Yes → Skip (duplicate) → duplicateCount++              │
│       └─ No  → Insert → savedCount++                            │
│       ↓                                                          │
│  Response: { impressionsSaved, duplicatesIgnored }              │
│       ↓                                                          │
│  Player marks impressions as synced → SQLite cleanup            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   SIGNALR (Real-time Only)                       │
├─────────────────────────────────────────────────────────────────┤
│  emit_ad_completed() → SignalR broadcast → Dashboard counter    │
│  (NO DATABASE WRITE - purely for UI feedback)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Deduplication Key

The `slot_play_key` is generated as:
```
SHA256(screenId + date (YYYYMMDD) + slot_number + timestamp_second)
```

This ensures that the **same slot cannot record more than one impression per second**, which is the physical limit of video playback.

Example:
- Screen: `abc123`
- Date: `20250113`
- Slot: `3`
- Second: `45678` (since midnight)

```
slot_play_key = SHA256("abc123|20250113|3|45678") 
             = "a1b2c3d4e5f6..."
```

## Files Modified/Created

### Player Side (Python)

1. **player/impression_store.py** (NEW)
   - Single source of truth for impressions
   - SQLite with UNIQUE constraint on `slot_play_key`
   - Methods: `record_impression()`, `get_pending_impressions()`, `mark_synced()`

2. **player/ccms_player.py** (MODIFIED)
   - Removed dual in-memory tracking (campaign_summaries, owner_content_summaries)
   - Uses ImpressionStore for all impression recording
   - Updated `sync_daily_data()` to use flat impressions array

### Server Side (.NET)

1. **CCMS.Domain/Entities/Impression.cs** (MODIFIED)
   - Added `SlotPlayKey` property for UNIQUE constraint

2. **CCMS.Shared/DTOs/Player/SyncDtos.cs** (MODIFIED)
   - Added `FlatImpression` class with `SlotPlayKey`
   - Added `Impressions` array to `DailySyncData`

3. **CCMS.Api/Controllers/PlayerController.cs** (MODIFIED)
   - Added handling for new flat impressions format
   - Server-side deduplication using `SlotPlayKey`
   - Maintains backwards compatibility with legacy format

### Database Migration

**add_slot_play_key_column.sql**
```sql
ALTER TABLE "Impressions" ADD COLUMN IF NOT EXISTS "SlotPlayKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Impressions_SlotPlayKey" 
ON "Impressions" ("SlotPlayKey") WHERE "SlotPlayKey" IS NOT NULL;
```

## How It Works

### Recording an Impression

1. Video finishes playing → `_handle_video_ended(item)`
2. Calls `record_impression(item)`
3. ImpressionStore generates `slot_play_key`
4. SQLite INSERT with `ON CONFLICT(slot_play_key) DO NOTHING`
5. Returns `(success, impression_id, is_new)` for logging

### Sync Process (Every 10 minutes)

1. `sync_daily_data()` called
2. Gets pending impressions from ImpressionStore
3. Sends flat array to `/api/player/sync`
4. Server checks each `SlotPlayKey` - skips if exists
5. Returns count of saved/skipped
6. Player calls `mark_synced()` to clean up SQLite

### Real-time Dashboard

1. Video completes → `emit_ad_completed(item)`
2. SignalR broadcasts `AdCompleted` event
3. Dashboard receives event, increments counter
4. **NO DATABASE WRITE** from SignalR path

## Duplicate Prevention Layers

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| 1. Player SQLite | `UNIQUE(slot_play_key)` | Prevent same slot recorded twice in same second |
| 2. Server Check | Query by `SlotPlayKey` | Idempotent sync handling |
| 3. DB Index | `IX_Impressions_SlotPlayKey` | Fast duplicate detection + constraint |

## Testing

### Test Duplicate Prevention

```bash
# Run player, let it record impressions
# Force re-sync same data
# Check server logs: "duplicatesIgnored: X"
# Verify DB count hasn't increased
```

### Test Real-time Counter

1. Open dashboard
2. Play video on screen
3. See counter increment immediately (SignalR)
4. Wait 10 min for sync
5. Verify DB count matches counter

## Deployment Steps

1. **Database Migration**
   ```bash
   psql $DATABASE_URL -f add_slot_play_key_column.sql
   ```

2. **Deploy Backend**
   - Rebuild and deploy CCMS.Api

3. **Update Player**
   - Copy `impression_store.py` to player
   - Update `ccms_player.py`
   - Restart player service

## Rollback Plan

If issues occur:
1. Server still supports legacy format (backwards compatible)
2. Remove ImpressionStore import in ccms_player.py
3. Restore old in-memory tracking methods

## Summary

✅ **Accurate DB counts** - No duplicates via SlotPlayKey UNIQUE constraint
✅ **Real-time SignalR** - Dashboard counters update immediately
✅ **Offline support** - SQLite stores until sync succeeds
✅ **Backwards compatible** - Legacy format still works
✅ **Fraud prevention** - Verification hash on all impressions
