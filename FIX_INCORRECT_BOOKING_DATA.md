# 🔧 Fixing Incorrect Booking Data

## Issue
The booking ID `092108cd-16b1-4b1d-87f0-05f2861ee1d1` has incorrect pricing because it was created **before** the per-minute pricing fix was applied.

### Current (Incorrect) Data:
```json
{
    "expectedImpressions": 1560,
    "totalPrice": 140.00,  ❌ WRONG
    "startDate": "2025-12-09",
    "endDate": "2025-12-10"
}
```

### Correct Data Should Be:
```
Expected Impressions: 1,560 plays
Price Per Slot Per Minute: ₹70
Total Price: ₹70 × 1,560 = ₹109,200 ✅
```

---

## Solution

### Option 1: Delete and Recreate (Recommended) ✅

1. **Delete the Old Booking**:
   - Go to Bookings page
   - Find the booking for "09/12/2025 - 10/12/2025"
   - Delete it (you may need to add a delete function if not available)

2. **Create New Booking**:
   - Go to Campaign → Create Booking
   - Select Screen 4
   - Select dates: 09/12/2025 - 10/12/2025
   - ✅ **New price will be**: INR 109,200

### Option 2: SQL Fix (Database Update)

If you want to fix the existing booking in the database:

```sql
-- Update the booking price to correct value
UPDATE Bookings
SET TotalPrice = 109200  -- 70 × 1560
WHERE Id = '092108cd-16b1-4b1d-87f0-05f2861ee1d1';
```

---

## Why This Happened

1. **Old Code** (before fix):
   ```csharp
   totalPrice = pricePerSlot * operatingDays
   totalPrice = 70 * 2 = 140  ❌
   ```

2. **New Code** (after fix):
   ```csharp
   totalPrice = pricePerSlot * totalImpressions
   totalPrice = 70 * 1560 = 109,200  ✅
   ```

---

## Backend Status

✅ **Backend restarted** with the correct pricing logic  
✅ **All new bookings** will use per-minute pricing  
⚠️ **Old bookings** (created before fix) have incorrect prices

---

## Next Steps

1. **Delete the incorrect booking** (if possible via UI)
2. **Create a new booking** with same details
3. **Verify** the new price shows **INR 109,200**

OR

1. **Run the SQL fix** to update the database directly
2. **Refresh** the bookings page

---

## Verification

After fixing, the booking should show:
```
Period: 09/12/2025 - 10/12/2025
Impressions: 1,560 plays
Total Price: INR 109,200
Breakdown: (INR 70/minute × 1,560 minutes)
```

---

**Backend**: ✅ Restarted with fix  
**Status**: Ready for new bookings with correct pricing
