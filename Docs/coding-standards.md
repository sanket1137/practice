# CCMS Coding Standards

> **Last Updated:** 2026-01-09  
> **Version:** 1.0

## Purpose

These coding standards ensure consistency, maintainability, and prevent common errors across the CCMS codebase.

---

## General Principles

### 1. **Defensive Programming**

> If code can prevent an error, it MUST prevent it.

- Validate inputs at API boundaries
- Use factories for complex object creation
- Handle null/empty cases explicitly
- Log warnings for unexpected data

### 2. **No Manual Fixes**

> Never rely on manual database updates to fix code issues.

- Format validation in code, not in database scripts
- Use migrations for schema changes only
- Automated tests catch format mismatches

### 3. **Single Source of Truth**

> One standard format, enforced everywhere.

- Use helper classes for format creation/parsing
- Document standards in `/Docs`
- NO ad-hoc JSON construction

---

## Backend (.NET/C#)

### DateTime Handling

**Rule:** ALWAYS use UTC, NEVER local time

```csharp
// ✅ Correct
var now = DateTime.UtcNow;
booking.CreatedAt = DateTime.UtcNow;
var startDate = request.StartDate.ToUtc();

// ❌ NEVER do this
var now = DateTime.Now;
var date = DateTime.Today;
```

**Helpers:**
```csharp
using CCMS.Infrastructure.Utilities;

var utcDate = someDate.ToUtc();  // Convert to UTC
var startOfDay = DateTimeUtility.StartOfDayUtc(date);
```

### Navigation Properties

**Rule:** Always load with `.Include()` or use projections

```csharp
// ✅ Correct
var bookings = await _context.Bookings
   .Include(b => b.Creative)
    .Include(b => b.Campaign)
    .Where(b => b.ScreenId == screenId)
    .ToListAsync();

// ❌ Wrong - properties will be null
var bookings = await _context.Bookings
    .Where(b => b.ScreenId == screenId)
    .ToListAsync();
```

**Alternative - Projection:**
```csharp
var bookings = await _context.Bookings
    .Where(b => b.ScreenId == screenId)
    .Select(b => new BookingDto
    {
        Id = b.Id,
        CreativeName = b.Creative.Name,  // OK in projection
        // ...
    })
    .ToListAsync();
```

### Status Checks

**Rule:** Use `BookingStatusHelper`, don't hardcode status checks

```csharp
using CCMS.Domain.Helpers;

// ✅ Correct
var activeStatuses = BookingStatusHelper.GetActiveStatuses();
var bookings = await _repo.FindAsync(b => activeStatuses.Contains(b.Status));

// Or use extension method
if (booking.Status.IsActiveForPlaylist())
{
    // ...
}

// ❌ Wrong - easy to forget statuses
if (booking.Status == BookingStatus.Approved)  // Missing Active!
{
    // ...
}
```

### Entity Creation

**Rule:** Use factories, not direct constructors

```csharp
using CCMS.Domain.Factories;

// ✅ Correct
var booking = BookingFactory.CreateWithDailyAssignments(
    screenId, campaignId, creativeId,
    startDate, endDate, slotNumbers, price);

// ❌ Wrong - manual construction = errors
var booking = new Booking
{
    Id = Guid.NewGuid(),
    DailySlotAssignmentsJson = "..." // Wrong format!
};
```

### JSON Format Handling

**Rule:** Use helpers, never manual JSON

```csharp
using CCMS.Application.Helpers;

// ✅ Correct
var assignments = new Dictionary<DateTime, List<int>> { ... };
var json = DailySlotAssignmentsHelper.CreateJson(assignments);

// Parsing (handles all formats)
var parsed = DailySlotAssignmentsHelper.ParseJson(jsonString);

// ❌ Wrong
var json = $"{{\"2026-01-09\": {slotNumber}}}";  // BAD!
```

### Validation

**Rule:** Validate at API boundaries, not in handlers

```csharp
// In DTO/Command
[Required]
[JsonFormat(JsonFormatType.DailySlotAssignments)]
public string? DailySlotAssignmentsJson { get; set; }

// In handler - defensive check
var errors = booking.Validate();
if (errors.Any())
{
    throw new ValidationException(string.Join(", ", errors));
}
```

### Logging

**Use structured logging:**

```csharp
// ✅ Good
_logger.LogWarning("Invalid booking format. BookingId: {BookingId}, JSON: {Json}", 
    booking.Id, booking.DailySlotAssignmentsJson);

// ❌ Bad
_logger.LogWarning($"Invalid booking {booking.Id}");
```

---

## Frontend (React/TypeScript)

### Date Handling

**Rule:** Convert UTC ↔ Local only for display

```typescript
import { displayLocalDate, toUTC } from '@/utils/dateUtils';

// Displaying dates from API
<p>Start: {displayLocalDate(booking.startDate)}</p>

// Sending dates to API
const data = {
    startDate: toUTC(selectedDate)  // Convert to UTC
};
```

### Type Safety

**Rule:** Use proper TypeScript types

```typescript
// ✅ Correct
interface Booking {
    id: string;
    startDate: string;  // ISO 8601 UTC
    endDate: string;
    status: BookingStatus;
}

// ❌ Wrong
const booking: any = { ... };  // NEVER use any
```

### API Calls

**Rule:** Handle errors properly

```typescript
try {
    const response = await api.post('/bookings', data);
    // Success
} catch (error) {
    if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to create booking');
    }
}
```

---

## Player (Python)

### DateTime Usage

**Rule:** Always UTC, add timezone.utc explicitly

```python
from datetime import datetime, timezone

# ✅ Correct
timestamp = datetime.now(timezone.utc)
session_date = datetime.now(timezone.utc).date()

# ❌ Wrong
timestamp = datetime.now()  # Local time!
```

### JSON Parsing

**Rule:** Handle missing/malformed data

```python
def parse_booking(data: dict) -> Booking:
    try:
       daily_assignments = json.loads(data.get('dailySlotAssignmentsJson', '{}'))
        # ...
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON in booking {data['id']}")
        daily_assignments = {}
```

---

## Code Review Checklist

Before submitting PR, verify:

### General
- [ ] All DateTime uses `DateTime.UtcNow` (not `.Now`)
- [ ] JSON formats use helper classes
- [ ] Navigation properties loaded with `.Include()`
- [ ] Status checks use `BookingStatusHelper`
- [ ] Entity creation uses factories

### Validation
- [ ] Input validated at API level
- [ ] Error messages are descriptive
- [ ] Edge cases handled (null, empty, invalid)

### Testing
- [ ] Unit tests for new helpers/factories
- [ ] Integration tests for database queries
- [ ] Format parsing tests cover edge cases

### Documentation
- [ ] New formats documented in `/Docs/data-formats.md`
- [ ] Breaking changes noted in PR description
- [ ] Examples added for complex code

---

## Common Pitfalls

### 1. Nullable vs Non-Nullable Guid

```csharp
public class Booking
{
    public Guid CreativeId { get; set; }  // NOT nullable
}

// ✅ Correct
if (booking.CreativeId != Guid.Empty)

// ❌ Wrong
if (booking.CreativeId.HasValue)  // COMPILE ERROR!
```

### 2. Missing Status Values

```csharp
// ❌ Wrong - only checks Approved
b.Status == BookingStatus.Approved

// ✅ Correct - checks all active statuses
BookingStatusHelper.GetActiveStatuses().Contains(b.Status)
```

### 3. Manual JSON Creation

```csharp
// ❌ Wrong
var json = $"{{\"2026-01-09\": [{slotNumber}]}}";

// ✅ Correct
var assignments = new Dictionary<DateTime, List<int>> 
{ 
    { date, new List<int> { slotNumber } } 
};
var json = DailySlotAssignmentsHelper.CreateJson(assignments);
```

### 4. Timezone Issues

```csharp
// ❌ Wrong - comparing UTC to local
if (booking.StartDate.Date == DateTime.Today)

// ✅ Correct - both UTC
if (booking.StartDate.Date == DateTime.UtcNow.Date)
```

---

## Tools & Helpers

### Required Using Statements

```csharp
// For dates
using CCMS.Infrastructure.Utilities;

// For booking status
using CCMS.Domain.Helpers;

// For slot assignments
using CCMS.Application.Helpers;

// For entity creation
using CCMS.Domain.Factories;
```

### Helper Classes Location

| Helper | Location | Purpose |
|--------|----------|---------|
| `DailySlotAssignmentsHelper` | `CCMS.Application/Helpers` | JSON format handling |
| `BookingStatusHelper` | `CCMS.Domain/Helpers` | Status checks |
| `BookingFactory` | `CCMS.Domain/Factories` | Entity creation |
| `DateTimeUtility` | `CCMS.Infrastructure/Utilities` | Date conversion |

---

## Questions?

- Check `/Docs/data-formats.md` for format specifications
- Review code examples in helper classes
- Ask in team chat if unclear

**Remember:** Code that prevents errors is better than code that handles errors!
