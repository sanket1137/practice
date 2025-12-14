# Diagnostic Logging Implementation - Next Steps

## ✅ Completed

### Phase 1: Diagnostic Logging Added

**Modified Files:**
1. `GetBookingsQueryHandler.cs` - Logs booking-screen relationships
2. `BookingsController.cs` - Logs creation requests

**What the Logs Show:**
```
[DIAGNOSTIC] Booking abc12345: ScreenId=def67890, Screen.Name=Screen 8, DTO.ScreenName=Screen 8, Campaign=Campaign 4.1
[DIAGNOSTIC CREATE] ScreenId: def67890, CampaignId: ghi12345, StartDate: 2025-12-13
```

---

## 📋 Next Steps

### Once Backend Restarts:

**1. Refresh Bookings Page**
   - Navigate to http://localhost:5173/bookings
   - Check backend terminal for diagnostic output

**2. Analyze Diagnostic Logs**
   Look for patterns like:
   - `ScreenId=abcd1234` but `Screen.Name=Screen 9` → EF Core loading issue
   - `ScreenId=abcd1234` and `Screen.Name=Screen 8` but UI shows Screen 9 → Frontend issue
   - `Screen.Name=NULL` → Navigation property not loaded

**3. Create Test Booking** (Optional)
   - Create new booking for known screen
   - Check `[DIAGNOSTIC CREATE]` log shows correct ScreenId
   - Verify booking appears under correct screen

**4. Interpret Results**

| Diagnostic Pattern | Root Cause | Fix Required |
|-------------------|------------|--------------|
| ScreenId matches Screen.Name | Database has wrong ScreenId | Data migration |
| Screen.Name is NULL | EF Core not loading nav | Add AsNoTracking() |
| DTO.ScreenName wrong | AutoMapper issue | Review mapping |
| CREATE log shows wrong ID | Frontend bug | Fix screen picker |

---

## 🔧 Potential Fixes (Based on Findings)

### If Database Corruption:
```sql
-- Run this after identifying wrong mappings
UPDATE Bookings 
SET ScreenId = [correct-id]
WHERE Id = [booking-id];
```

### If EF Core Issue:
```csharp
// Add to Repository.cs
.AsNoTracking()
.Where(b => !b.IsDeleted)
```

### If Frontend Issue:
Check `CreateBookingPage.tsx` screen selection

---

## 📊 Expected Output

Backend terminal should show logs like:
```
[DIAGNOSTIC] Booking bc7d86f5: ScreenId=4bfda159, Screen.Name=screen 10, DTO.ScreenName=screen 10, Campaign=Campaign 4.1
[DIAGNOSTIC] Booking f75b3210: ScreenId=06f10487, Screen.Name=Screen 8, DTO.ScreenName=Screen 8, Campaign=sdffdgfd
```

**Look for mismatches between ScreenId and Screen.Name!**
