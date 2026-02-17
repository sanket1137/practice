# DateOnly Migration Deployment Guide

## What Changed

### Backend Changes

1. **Entity Changes**:
   - `Booking.StartDate` and `Booking.EndDate`: Changed from `DateTime` to `DateOnly`
   - `Campaign.StartDate` and `Campaign.EndDate`: Changed from `DateTime` to `DateOnly`
   - `User`: Added `PreferredTimezone` (default: "Asia/Kolkata") and `PreferredCurrency` (default: "INR")
   - `Screen`: Changed default timezone to "Asia/Kolkata" and currency to "INR"

2. **DTO Changes**:
   - All date fields in `BookingDtos.cs` and `CampaignDtos.cs` now use `string` in YYYY-MM-DD format
   - Currency defaults changed from "USD" to "INR"

3. **Handler Changes**:
   - `CreateBookingCommandHandler`: Parses string dates to `DateOnly`
   - `CreateCampaignCommandHandler`: Parses string dates to `DateOnly`
   - `UpdateCampaignCommandHandler`: Parses string dates to `DateOnly`
   - All query handlers updated for `DateOnly` comparisons

4. **Service Changes**:
   - All services updated to work with `DateOnly` instead of `DateTime`

### Frontend Changes

1. **CreateBookingPage.tsx**: Sends dates as YYYY-MM-DD strings
2. **CreateCampaignPage.tsx**: Sends dates as YYYY-MM-DD strings, INR as default currency

### Database Migration

- Migration: `DateOnlyAndIndiaDefaults`
- Changes:
  - `Bookings.StartDate`: `timestamp with time zone` → `date`
  - `Bookings.EndDate`: `timestamp with time zone` → `date`
  - `Campaigns.StartDate`: `timestamp with time zone` → `date`
  - `Campaigns.EndDate`: `timestamp with time zone` → `date`
  - Added `Users.PreferredTimezone` (text)
  - Added `Users.PreferredCurrency` (text)

## Deployment Steps

### 1. Copy Files to Server

```bash
# From local machine
scp -i ~/.ssh/ccms-hetzner -r backend/* root@91.99.190.216:/opt/ccms/backend/
scp -i ~/.ssh/ccms-hetzner -r frontend/src root@91.99.190.216:/opt/ccms/frontend/
```

### 2. SSH to Server

```bash
ssh -i ~/.ssh/ccms-hetzner root@91.99.190.216
cd /opt/ccms
```

### 3. Stop Containers

```bash
docker compose down
```

### 4. Rebuild and Start

```bash
docker compose build --no-cache
docker compose up -d
```

### 5. Verify Migration Runs

The migration should run automatically on startup. Check logs:

```bash
docker compose logs -f backend
```

Look for: `Applying migration 'DateOnlyAndIndiaDefaults'`

### 6. Test

1. Create a new campaign - verify dates are stored correctly
2. Create a new booking - verify no 400 error, dates match selection
3. Check screen owner calendar - verify dates display correctly
4. Verify currency shows as INR by default

## Rollback (if needed)

The migration has a Down method that will revert changes if needed:

```bash
# SSH to server
docker compose exec backend dotnet ef database update <previous_migration_name>
```

## Root Cause Fix

**Problem**: UTC timezone conversion was causing date shifts
- User selects Feb 11 in India (IST)
- JavaScript Date serializes to UTC: "2026-02-10T18:30:00.000Z"
- Backend extracts date from UTC: Feb 10
- Validation fails because Feb 10 < Campaign start Feb 11

**Solution**: 
- Use `DateOnly` in entities (no timezone component)
- Frontend sends YYYY-MM-DD strings directly
- Backend parses to DateOnly without any conversion
- Result: Feb 11 in UI = Feb 11 stored = Feb 11 displayed
