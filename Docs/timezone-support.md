# Timezone Support Implementation

## Added Timezone Field to Screen Entity

### Purpose
Enable screens to operate in their local timezone regardless of server location.

### Changes

#### 1. Screen Entity
Added property:
```csharp
public string Timezone { get; set; } = "UTC";
```

**Valid Values:**
- `"Asia/Kolkata"` - India (IST, UTC+5:30)
- `"America/Los_Angeles"` - US West Coast (PST, UTC-8)
- `"America/New_York"` - US East Coast (EST, UTC-5)
- `"Europe/London"` - UK (GMT, UTC+0/+1)
- `"UTC"` - Default universal time

### How It Works

#### Backend
```csharp
// Screen stores timezone
var screen = await _screenRepo.GetByIdAsync(screenId);
// screen.Timezone = "Asia/Kolkata"
// screen.Schedule.Monday.StartTime = 06:00
// screen.Schedule.Monday.EndTime = 22:00
```

#### Player
```python
# Player checks if within operating hours
from datetime import datetime
import pytz

# Get screen's timezone
screen_tz = pytz.timezone(screen_timezone)  # e.g., "Asia/Kolkata"

# Convert current UTC to screen's local time
now_utc = datetime.now(pytz.UTC)
now_local = now_utc.astimezone(screen_tz)

# Check if within operating hours
current_time = now_local.time()
if start_time <= current_time <= end_time:
    # Play content
```

### Examples

#### India Screen
```
Timezone: Asia/Kolkata
Operating: 06:00-22:00 IST

Current UTC: 2026-01-09 00:30:00 (12:30 AM)
Current Local: 2026-01-09 06:00:00 (6:00 AM IST)
Status: ✅ Within operating hours → PLAY
```

#### US Screen  
```
Timezone: America/Los_Angeles
Operating: 10:00-20:00 PST

Current UTC: 2026-01-09 18:00:00 (6:00 PM)
Current Local: 2026-01-09 10:00:00 (10:00 AM PST)
Status: ✅ Within operating hours → PLAY
```

### Benefits

1. **Accurate Timing** - Screens operate in their local time
2. **Global Deployment** - Server can be anywhere
3. **No Confusion** - Clear timezone for each screen
4. **Future-Proof** - Handles DST automatically (IANA timezones)

### Migration

Database migration created: `AddTimezoneToScreen`

Existing screens will default to `"UTC"`.

**Update existing screens:**
```sql
-- Set timezone for existing screens
UPDATE Screens SET Timezone = 'Asia/Kolkata' WHERE Location LIKE '%India%';
UPDATE Screens SET Timezone = 'America/Los_Angeles' WHERE Location LIKE '%California%';
```

### Next Steps

1. Apply migration: `dotnet ef database update`
2. Update player to use timezone
3. Add timezone selector in screen creation UI
4. Update documentation

---

**Status:** ✅ Entity Updated, Migration Created
**Impact:** Ensures operating hours work globally!
