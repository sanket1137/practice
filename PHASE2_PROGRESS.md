# Phase 2.1: Database & Entities - Progress Report

## ✅ Completed

### 1. Entities Created
- ✅ `SlotAvailability.cs` - Tracks slot bookings per screen per date
  - ScreenId, Date (unique combo)
  - TotalSlots, BookedSlots
  - SlotBook JSON column mapping slots to booking IDs
  - Calculated AvailableSlots property

### 2. Entities Modified
- ✅ `Creative.cs` - Added locking fields
  - `IsLocked` (bool)
  - `LockedReason` (string)

### 3. Database Context Updated
- ✅ Added `DbSet<SlotAvailability>`
- ✅ Configured SlotAvailability with:
  - Unique constraint on (ScreenId, Date)
  - Check constraints for BookedSlots validation
  - JSON serialization for SlotBookings dictionary
  - Cascade delete on Screen
  - Soft delete filter

### 4. DTOs Created
- ✅ `ScreenAvailabilityDto.cs` - For availability check API
  - DailyAvailabilityDto
  - AvailabilitySummaryDto
  
- ✅ `CreativeValidationDto.cs` - For creative validation API
  - CreativeRequirementsDto
  - DimensionDto

### 5. Migration Script
- ✅ Manual SQL migration created at:
  `backend/CCMS.Infrastructure/Migrations/Manual_AddSlotAvailabilityAndCreativeLocking.sql`

---

## ⚠️ Migration Issue

**Problem**: .NET EF Core tools have compatibility issues with .NET 10 SDK

**Solution**: Created manual SQL migration script that can be run directly on the database.

**To Apply Migration**:
```bash
# Option 1: Run SQL script directly in SQL Server Management Studio or Azure Data Studio

# Option 2: Use sqlcmd
sqlcmd -S localhost -d CCMS -i backend\CCMS.Infrastructure\Migrations\Manual_AddSlotAvailabilityAndCreativeLocking.sql

# Option 3: Use EF when SDK issue is resolved
dotnet ef database update
```

---

## 📝 Next Steps

### Phase 2.2: Services (In Progress)

#### 1. SlotAvailabilityService [TODO]
Create `CCMS.Application/Services/SlotAvailabilityService.cs`:
- `InitializeSlotAvailability()` - Create records for date range
- `IsSlotAvailable()` - Check if slot available across dates
- `FindAvailableSlot()` - Auto-find first available slot
- `BookSlot()` - Update availability when booking created
- `ReleaseSlot()` - Update when booking cancelled
- `GetAvailability()` - Get availability summary

#### 2. CreativeValidationService [TODO]
Create `CCMS.Application/Services/CreativeValidationService.cs`:
- `ValidateCreativeForScreen()` - Check dimension + duration

#### 3. Update BookingCalculationService [TODO]
Fix cost calculation formula:
```csharp
// Correct formula
costPerPlay = pricePerSlot × timeFrameMinutes
playsPerDay = operatingMinutes / timeFrameMinutes
dailyCost = playsPerDay × costPerPlay
```

### Phase 2.3: API Endpoints [TODO]
1. `GET /api/screens/{id}/availability` - Check availability
2. `GET /api/creatives/{id}/validate-for-screen/{screenId}` - Validate creative
3. Update `POST /api/bookings` - Enhance with slot logic

### Phase 2.4: Creative Locking [TODO]
1. Update `ApproveBookingCommandHandler` - Lock creative
2. Update `CancelBookingCommandHandler` - Unlock if no other bookings
3. Protect `UpdateCreativeCommandHandler` - Prevent editing locked
4. Protect `DeleteCreativeCommandHandler` - Prevent deleting locked

### Phase 2.5: Frontend [TODO]
1. Enhanced booking form
2. Availability display component
3. Cost breakdown panel
4. Creative validation UI

---

## 🏗️ Architecture Changes

### Database Schema
```
SlotAvailabilities
├── Id (PK)
├── ScreenId (FK) → Screens
├── Date
├── TotalSlots
├── BookedSlots
├── SlotBookings (JSON)
└── Soft delete fields

Creatives (Modified)
├── ... existing fields
├── IsLocked (new)
└── LockedReason (new)
```

### Data Flow
```
Screen Created → Initialize 90-day slot availability
Booking Request → Check availability → Find/Assign slot → Book slot
Booking Approved → Lock creative
Booking Cancelled → Release slot → Unlock creative (if no other bookings)
```

---

## 🧪 Testing Checklist

- [ ] SlotAvailability entity saves/retrieves correctly
- [ ] JSON SlotBookings serialization works
- [ ] Unique constraint prevents duplicate (ScreenId, Date)
- [ ] Check constraints validate BookedSlots
- [ ] Creative locking fields save correctly
- [ ] Soft delete works for SlotAvailability

---

## Files Created/Modified

### New Files:
```
CCMS.Domain/Entities/SlotAvailability.cs
CCMS.Shared/DTOs/Screens/ScreenAvailabilityDto.cs
CCMS.Shared/DTOs/Creatives/CreativeValidationDto.cs
CCMS.Infrastructure/Migrations/Manual_AddSlotAvailabilityAndCreativeLocking.sql
```

### Modified Files:
```
CCMS.Domain/Entities/Creative.cs
CCMS.Infrastructure/Data/ApplicationDbContext.cs
```

---

**Status**: Phase 2.1 Database Foundation Complete ✅  
**Next**: Implement SlotAvailabilityService and CreativeValidationService
