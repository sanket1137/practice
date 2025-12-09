# 🔍 Screen Owner "Karthik Vellore" - Empty Bookings Issue

## 🎯 Root Cause

The screen owner **Karthik Vellore** is seeing empty bookings because:

**Most Likely**: This user **has no screens** in the database.

The booking query works like this:
```
Screen Owner Bookings = Bookings WHERE booking.Screen.OwnerId == Karthik's UserId
```

If Karthik owns **0 screens** → Result is **0 bookings**

---

## 🔎 Diagnostic Steps

### Step 1: Run SQL Diagnostic Query

Open **SQL Server Management Studio** or **Azure Data Studio**:

1. Connect to your database: `PracticePixelCCMSDb`
2. Open the file: `DIAGNOSE_SCREEN_OWNER_BOOKINGS.sql`
3. Execute the queries
4. Check the results:

**Key Results to Check**:
- **Screens Owned by This User**: Should show screens
- **Bookings for This Owner's Screens**: Should show bookings

### Step 2: Analyze Results

**If "Screens Owned" = 0 rows**:
- ✅ This is the issue!
- The user has no screens
- Therefore, no bookings can exist

**If Screens exist but "Bookings" = 0 rows**:
- The screens have no booking requests yet
- Advertisers need to create bookings for these screens

---

## ✅ Solutions

### Solution 1: Create Screens for Karthik Vellore

**Option A - Via Frontend**:
1. Login as Karthik Vellore
2. Go to **Screens** page
3. Click **+ New Screen**
4. Fill in screen details
5. Save

**Option B - Via SQL (Quick Test)**:
```sql
-- Get Karthik's UserId first
DECLARE @KarthikUserId UNIQUEIDENTIFIER;
SELECT @KarthikUserId = Id FROM Users 
WHERE FirstName = 'Karthik' AND LastName = 'Vellore';

-- Create a test screen for Karthik
INSERT INTO Screens (
    Id, OwnerId, Name, Description,
    PhysicalWidth, PhysicalHeight, DimensionUnit,
    ResolutionWidth, ResolutionHeight,
    [Location], Latitude, Longitude,
    Schedule, TimeFrameMinutes, SlotsPerFrame,
    DeviceId, Status, IsOnline, LastSeenAt,
    PricePerSlot, Currency, CreatedAt, IsDeleted
)
VALUES (
    NEWID(),
    @KarthikUserId,
    'Karthik Screen 1',
    'Test screen for Karthik Vellore',
    10, 6, 'feet',
    1920, 1080,
    '{"street":"Test Street","city":"Test City","state":"TS","country":"India","postalCode":"123456"}',
    18.5204, 73.8567,
    '{"monday":{"isOperating":true,"startTime":"09:00:00","endTime":"22:00:00"},"tuesday":{"isOperating":true,"startTime":"09:00:00","endTime":"22:00:00"},"wednesday":{"isOperating":true,"startTime":"09:00:00","endTime":"22:00:00"},"thursday":{"isOperating":true,"startTime":"09:00:00","endTime":"22:00:00"},"friday":{"isOperating":true,"startTime":"09:00:00","endTime":"22:00:00"},"saturday":{"isOperating":true,"startTime":"09:00:00","endTime":"22:00:00"},"sunday":{"isOperating":true,"startTime":"09:00:00","endTime":"22:00:00"}}',
    1, 6,
    'device-karthik-001',
    1, -- Active
    1, -- Online
    GETUTCDATE(),
    50, 'INR',
    GETUTCDATE(),
    0
);
```

### Solution 2: Create Test Bookings

Once Karthik has screens, create bookings:

1. **Login as Advertiser** (`advertiser1@example.com`)
2. Go to your campaign
3. Click **Create Booking**
4. Select **Karthik's screen**
5. Fill booking details
6. Submit

Now:
1. **Login as Karthik Vellore**
2. Go to **Bookings**
3. Should see **Pending (1)**
4. Can approve/reject

### Solution 3: Use Seeded Test Account

Use the pre-seeded screen owner account that already has screens and bookings:

**Login**: `owner1@example.com`  
**Password**: `Password123!`

This account:
- ✅ Already owns 3 screens
- ✅ Has 1 pending booking waiting
- ✅ Has approved/rejected bookings

---

## 🔄 Current Data Flow

```
1. Advertiser creates booking
   ↓
2. Booking is for a specific Screen
   ↓
3. Screen has an OwnerId
   ↓
4. Screen Owner (with matching OwnerId) sees the booking
   ↓
5. Screen Owner approves/rejects
```

**If OwnerId doesn't match** → Booking not visible to that screen owner

---

## 📊 Check Database Data

**Quick Check via SQL**:
```sql
-- See all users
SELECT Email, FirstName, LastName, Role FROM Users;

-- See all screens and their owners
SELECT 
    s.Name as ScreenName,
    u.Email as OwnerEmail,
    s.Status
FROM Screens s
INNER JOIN Users u ON s.OwnerId = u.Id
WHERE s.IsDeleted = 0;

-- See all bookings and which owner should see them
SELECT 
    b.Status,
    c.Name as CampaignName,
    s.Name as ScreenName,
    u.Email as ScreenOwnerEmail
FROM Bookings b
INNER JOIN Screens s ON b.ScreenId = s.Id
INNER JOIN Users u ON s.OwnerId = u.Id
INNER JOIN Campaigns c ON b.CampaignId = c.Id
WHERE b.IsDeleted = 0;
```

---

## ✅ Expected Result

After creating screens for Karthik and creating bookings for those screens:
- ✅ Login as Karthik Vellore
- ✅ Go to Bookings
- ✅ See pending bookings
- ✅ Approve/reject functionality works

---

## 🎯 Quick Test

**Fastest way to test the feature**:
1. Use `owner1@example.com` / `Password123!`
2. This account already has everything set up
3. Go to Bookings → See pending booking
4. Test approve/reject

Then create your own data for Karthik Vellore account.

---

Run `DIAGNOSE_SCREEN_OWNER_BOOKINGS.sql` to see the exact data state! 📊
