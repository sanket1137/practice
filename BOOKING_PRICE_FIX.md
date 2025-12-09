# ✅ Booking Price Calculation Fix - Per-Minute Pricing

## Issue
The booking calculation was using the old per-day pricing model instead of the new per-minute pricing model.

### Before (Incorrect):
- **Display**: "INR 70 (70/day × 1 days)"
- **Calculation**: `totalPrice = pricePerSlot × operatingDays`
- **Example**: ₹70 × 1 day = ₹70

### Problem:
- Screen has ₹70 **per slot per minute**, not per day
- 780 plays = 780 minutes of operating time
- Should be ₹70/min × 780 min = ₹54,600

---

## Fix Applied

### Backend Changes ✅
**File**: `CCMS.Application/Features/Bookings/Commands/CreateBookingCommandHandler.cs`

**Before**:
```csharp
// Calculate total price (per operating day)
var totalPrice = screen.PricePerSlot * calculation.OperatingDays;
```

**After**:
```csharp
// Calculate total price (per-minute pricing)
// PricePerSlot is now per minute, and each impression = 1 minute of operating time
var totalPrice = screen.PricePerSlot * calculation.TotalExpectedImpressions;
```

### Frontend Changes ✅
**File**: `frontend/src/pages/bookings/CreateBookingPage.tsx`

**Before**:
```typescript
const totalPrice = selectedScreenDetails.pricePerSlot * operatingDays;
```
**Display**: `({pricePerSlot}/day × {operatingDays} days)`

**After**:
```typescript
// Per-minute pricing: price per slot × total minutes (impressions)
const totalPrice = selectedScreenDetails.pricePerSlot * totalImpressions;
```
**Display**: `({currency} {pricePerSlot}/minute × {totalImpressions} minutes)`

---

## Correct Calculation Logic

### Pricing Model:
- **Price Per Slot Per Minute**: What advertisers pay per slot per minute
- **Operating Minutes**: Total minutes screen operates during booking period
- **Total Impressions**: Number of times the ad plays (= operating minutes with 1-minute frames)

### Example Calculation:
```
Screen: ₹70 per slot per minute
Time Frame: 1 minute
Booking: 1 day (13 hours operation)

Operating Minutes = 13 hours × 60 = 780 minutes
Total Impressions = 780 (one ad plays per minute)
Total Price = ₹70/minute × 780 minutes = ₹54,600
```

### Formula:
```
Total Price = Price Per Slot Per Minute × Total Impressions
```

Where:
- **Total Impressions** = Sum of all operating minutes across all days in the booking period

---

## Updated Display

### New Booking Summary:
```
Screen: Screen 4
Total Days: 1 days
Operating Days: 1 days
Expected Impressions: 780 plays

Total Price: INR 54,600
(INR 70/minute × 780 minutes)
```

---

## Files Modified

### Backend:
- `CCMS.Application/Features/Bookings/Commands/CreateBookingCommandHandler.cs`

### Frontend:
- `frontend/src/pages/bookings/CreateBookingPage.tsx`

---

## Testing

### Test Scenario 1: Single Day Booking
- **Screen**: ₹70/slot/minute, 13 hours/day operation
- **Booking**: 1 day
- **Expected**: 780 impressions, ₹54,600

### Test Scenario 2: Multi-Day Booking
- **Screen**: ₹70/slot/minute, 13 hours/day operation
- **Booking**: 7 days (all operating)
- **Expected**: 5,460 impressions (780 × 7), ₹3,82,200

### Test Scenario 3: Weekend Closed
- **Screen**: ₹70/slot/minute, 13 hours weekday, closed weekends
- **Booking**: 7 days (5 operating)
- **Expected**: 3,900 impressions (780 × 5), ₹2,73,000

---

## Impact

### ✅ Correct:
- Booking prices now reflect per-minute pricing
- Calculations match revenue estimates shown during screen creation
- Display shows transparent breakdown per minute

### ⚠️ Important:
- **Existing bookings** may have incorrect prices if created before this fix
- Screen owners should be aware pricing is now per-minute
- This aligns with the screen registration revenue calculator

---

**Status**: ✅ FIXED  
**Backend**: Restarted automatically  
**Frontend**: Hot-reloaded automatically

**Test the fix**: Create a new booking and verify the price calculation!
