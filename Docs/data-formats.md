# CCMS Data Format Standards

> **Last Updated:** 2026-01-09  
> **Version:** 1.0

## Purpose

This document defines the standard data formats used across the CCMS application to ensure consistency between backend, frontend, and player components.

---

## JSON Formats

### DailySlotAssignmentsJson

**Type:** `Dictionary<string, List<int>>`  
**Usage:** Specifies which slots are assigned to a booking on each day

**Standard Format:**
```json
{
  "2026-01-09": [1, 2, 3],
  "2026-01-10": [2, 4],
  "2026-01-11": [1]
}
```

**Rules:**
1. Date keys MUST use `yyyy-MM-dd` format (NO timestamp)
2. Values MUST be arrays of integers (even for single slot)
3. Empty days are omitted (not included in JSON)
4. Slot numbers are 1-indexed
5. Date keys represent dates in UTC

**Valid Examples:**
```json
// Single slot, multiple days
{"2026-01-09": [2], "2026-01-10": [2]}

// Multiple slots, single day
{"2026-01-09": [1, 2, 3, 4]}

// Rotating slots across days
{"2026-01-09": [1], "2026-01-10": [2], "2026-01-11": [3]}
```

**Invalid Examples:**
```json
// ❌ Has timestamp
{"2026-01-09T00:00:00": [2]}

// ❌ Integer value instead of array
{"2026-01-09": 2}

// ❌ Wrong date format
{"01/09/2026": [2]}

// ❌ Empty array (should omit the key)
{"2026-01-09": []}
```

**Code Usage:**
```csharp
// Creating
var assignments = new Dictionary<DateTime, List<int>>
{
    { new DateTime(2026, 1, 9), new List<int> { 1, 2 } },
    { new DateTime(2026, 1, 10), new List<int> { 3, 4 } }
};
var json = DailySlotAssignmentsHelper.CreateJson(assignments);

// Parsing (handles legacy formats automatically)
var parsed = DailySlotAssignmentsHelper.ParseJson(jsonString);

// Checking slot assignment
bool hasSlot = DailySlotAssignmentsHelper.HasSlotOnDate(json, date, slotNumber);
```

---

## Date/Time Formats

### Server-Side (Backend)

**Rule:** ALL dates/times MUST be stored and processed in UTC

**Usage:**
```csharp
// ✅ Correct
var now = DateTime.UtcNow;
booking.StartDate = startDate.ToUtc();

// ❌ Wrong
var now = DateTime.Now; // NEVER use local time
```

**Database Storage:**
- All `DateTime` columns store UTC values
- EF Core ValueConverter ensures UTC on save/read
- No timezone offset stored separately

### API Responses

**Format:** ISO 8601 with 'Z' suffix

**Example:**
```json
{
  "startDate": "2026-01-09T00:00:00.000Z",
  "endDate": "2026-01-10T23:59:59.999Z",
  "createdAt": "2026-01-09T01:30:00.000Z"
}
```

### Frontend (JavaScript/TypeScript)

**Receiving from API:**
```typescript
import { displayLocalDate } from '@/utils/dateUtils';

// Backend sends: "2026-01-09T00:00:00.000Z"
// Display to user: "Jan 09, 2026 05:30 AM" (in IST)
const localDate = displayLocalDate(booking.startDate);
```

**Sending to API:**
```typescript
import { toUTC } from '@/utils/dateUtils';

// User picks: Jan 09, 2026 10:00 AM (local time)
// Send to API: "2026-01-09T04:30:00.000Z" (UTC)
const utcDate = toUTC(selectedDate);
```

### Player (Python)

**Rule:** ALL timestamps in UTC

```python
# ✅ Correct
from datetime import datetime, timezone
timestamp = datetime.now(timezone.utc)

# ❌ Wrong
timestamp = datetime.now()  # NEVER use local time
```

---

## Enum Values

### BookingStatus

```csharp
public enum BookingStatus
{
    Pending = 0,      // Awaiting approval
    Approved = 1,     // Approved, scheduled to play
    Active = 2,       // Currently playing (auto-set by background service)
    Completed = 3,    // Past end date
    Cancelled = 4,    // Cancelled by user
    Rejected = 5      // Rejected by admin
}
```

**Query Patterns:**
```csharp
// When checking "active" bookings (for playlist/slots)
using CCMS.Domain.Helpers;

var activeStatuses = BookingStatusHelper.GetActiveStatuses();
// Returns: [Approved, Active]

var bookings = await _repo.FindAsync(b => 
    activeStatuses.Contains(b.Status) &&
    b.StartDate <= now &&
    b.EndDate >= now);
```

---

## Navigation Properties

### Loading Pattern

**Rule:** Always use `.Include()` for navigation properties

```csharp
// ✅ Correct - Load navigation properties
var bookings = await _context.Bookings
    .Include(b => b.Creative)
    .Include(b => b.Campaign)
    .Where(b => b.ScreenId == screenId)
    .ToListAsync();

// ❌ Wrong - Navigation properties will be null
var bookings = await _context.Bookings
    .Where(b => b.ScreenId == screenId)
    .ToListAsync();
// bookings[0].Creative will be NULL!
```

---

## Validation

### Required Fields

All entities must have:
- `Id` (Guid, never empty)
- `CreatedAt` (DateTime UTC)
- `IsDeleted` (bool, default false)

Bookings specifically:
- `ScreenId` (not empty)
- `CampaignId` (not empty)
- `CreativeId` (not empty)
- `SlotNumbers` (at least one slot)
- `StartDate` <= `EndDate`
- `PricePerSlot` >= 0

### JSON Validation

```csharp
// Use helper to validate
var errors = DailySlotAssignmentsHelper.ValidateJson(jsonString);
if (errors.Any())
{
    throw new ValidationException(string.Join(", ", errors));
}
```

---

## Migration from Legacy Formats

### DailySlotAssignmentsJson

The `DailySlotAssignmentsHelper.ParseJson()` method automatically handles:

1. **Legacy timestamp format:**
   - Input: `{"2026-01-09T00:00:00": [2]}`
   - Parsed as: `{2026-01-09: [2]}`

2. **Legacy integer format:**
   - Input: `{"2026-01-09": 2}`
   - Parsed as: `{2026-01-09: [2]}`

3. **Mixed formats:**
   - Automatically detects and converts

**Normalizing Existing Data:**
```csharp
// Convert to standard format
var normalized = DailySlotAssignmentsHelper.NormalizeJson(oldJson);
booking.DailySlotAssignmentsJson = normalized;
await _repo.UpdateAsync(booking);
```

---

## Best Practices

1. **Always use helpers:**
   - `DailySlotAssignmentsHelper` for slot assignments
   - `BookingStatusHelper` for status checks
   - `DateTimeUtility` for date conversions

2. **Always use factories:**
   - `BookingFactory.CreateWithDailyAssignments()` for new bookings

3. **Never manually create:**
   - Don't manually construct JSON strings
   - Don't manually set booking properties
   - Don't manually parse dates

4. **Validate before saving:**
   ```csharp
   // Validate entity
   var errors = booking.Validate();
   if (errors.Any()) throw new ValidationException(...);
   
   // Validate JSON formats
   var jsonErrors = DailySlotAssignmentsHelper.ValidateJson(booking.DailySlotAssignmentsJson);
   if (jsonErrors.Any()) throw new ValidationException(...);
   ```

---

## Future Additions

Document new formats here as they're added:

- SlotPricingJson (if implemented)
- ScheduleOverrideJson (if needed)
- CustomMetadataJson (if added)

---

**Questions?** Contact the development team or refer to code examples in:
- `CCMS.Application/Helpers/DailySlotAssignmentsHelper.cs`
- `CCMS.Domain/Factories/BookingFactory.cs`
- `CCMS.Domain/Helpers/BookingStatusHelper.cs`
