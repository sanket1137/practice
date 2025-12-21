# Test Screen Setup Instructions

## Step 1: Create Screen via UI

1. **Login** to `http://localhost:5174` as a **ScreenOwner** or **Admin** user
2. **Navigate** to Screens page
3. **Click** "Add Screen" button
4. **Fill in the form:**
   - **Name:** Test Screen 24/7
   - **Location:** Test Street 123, Test City, Test State, 12345
   - **Resolution:** 1920x1080
   - **Orientation:** Landscape
   - **Screen Type:** Indoor
   - **Operating Schedule:** Set ALL days from 00:00 to 23:59
   - **Slots Per Frame:** 6
   - **Time Frame (minutes):** 1
   - **Price Per Slot:** $100
5. **Save** the screen
6. **Copy** the Screen ID from the URL or details page

## Step 2: Get API Key

After creating the screen:
1. Go to screen details page
2. Click "Generate API Key" or "View API Key"
3. **IMPORTANT:** Save this key - it won't be shown again!

## Step 3: Configure Player

1. Open `player/config.json.template`
2. Copy to `player/config.json`
3. Update with your values:
   ```json
   {
     "screen_id": "PASTE-SCREEN-ID-HERE",
     "api_key": "PASTE-API-KEY-HERE",
     "server_url": "http://localhost:5257",
     "sync_interval_minutes": 10,
     "log_retention_days": 30
   }
   ```

## Step 4: Test Player Connection

```bash
cd player
python ccms_player.py
```

Should output:
- ✅ Connecting to server...
- ✅ Handshake successful
- ✅ Playlist received
- ✅ Starting playback...

## Quick SQL Insert (Alternative)

If you have database access, run this to create a test screen:

```sql
-- Replace 'YOUR-USER-ID' with actual user GUID from Users table
INSERT INTO Screens (
    Id, Name, DeviceId, OwnerId, 
    Location_Street, Location_City, Location_State, Location_Country, Location_PostalCode,
    Resolution, Orientation, ScreenType,
    Schedule_Monday_IsOpen, Schedule_Monday_OpenTime, Schedule_Monday_CloseTime,
    Schedule_Tuesday_IsOpen, Schedule_Tuesday_OpenTime, Schedule_Tuesday_CloseTime,
    Schedule_Wednesday_IsOpen, Schedule_Wednesday_OpenTime, Schedule_Wednesday_CloseTime,
    Schedule_Thursday_IsOpen, Schedule_Thursday_OpenTime, Schedule_Thursday_CloseTime,
    Schedule_Friday_IsOpen, Schedule_Friday_OpenTime, Schedule_Friday_CloseTime,
    Schedule_Saturday_IsOpen, Schedule_Saturday_OpenTime, Schedule_Saturday_CloseTime,
    Schedule_Sunday_IsOpen, Schedule_Sunday_OpenTime, Schedule_Sunday_CloseTime,
    SlotsPerFrame, TimeFrameMinutes, PricePerSlot,
    IsOnline, IsDeleted, CreatedAt, UpdatedAt
)
VALUES (
    NEWID(), 'Test Screen 24/7', 'RPI-TEST-001', 'YOUR-USER-ID',
    'Test Street 123', 'Test City', 'Test State', 'Test Country', '12345',
    '1920x1080', 'Landscape', 'Indoor',
    1, '00:00:00', '23:59:00',
    1, '00:00:00', '23:59:00',
    1, '00:00:00', '23:59:00',
    1, '00:00:00', '23:59:00',
    1, '00:00:00', '23:59:00',
    1, '00:00:00', '23:59:00',
    1, '00:00:00', '23:59:00',
    6, 1, 100.00,
    0, 0, GETUTCDATE(), GETUTCDATE()
);

-- Get the Screen ID
SELECT TOP 1 Id, Name FROM Screens WHERE Name = 'Test Screen 24/7';
```

## Verification

After setup, verify:
- [ ] Screen shows in Screens list
- [ ] Operating schedule shows 24/7 (all green)
- [ ] Player can connect and get playlist
- [ ] WebSocket shows screen online after player connects
