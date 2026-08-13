-- Update all approved bookings for Screen 13 to start from Dec 19 instead of Dec 20

-- First, let's see what bookings exist for Screen 13
SELECT 
    Id,
    ScreenId,
    Status,
    StartDate,
    EndDate,
    DATEDIFF(day, StartDate, EndDate) as DurationDays
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status IN ('Approved', 'Active')
    AND IsDeleted = 0;

-- Update the booking dates: shift from Dec 20 to Dec 19
-- This also shifts EndDate by 1 day to maintain the same duration
UPDATE Bookings
SET 
    StartDate = DATEADD(day, -1, StartDate),
    EndDate = DATEADD(day, -1, EndDate),
    UpdatedAt = GETUTCDATE()
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status IN ('Approved', 'Active', 'Pending')
    AND IsDeleted = 0
    AND StartDate >= '2025-12-20';  -- Only shift bookings that start on or after Dec 20

-- Verify the changes
SELECT 
    Id,
    ScreenId,
    Status,
    StartDate,
    EndDate,
    DATEDIFF(day, StartDate, EndDate) as DurationDays
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status IN ('Approved', 'Active', 'Pending')
    AND IsDeleted = 0;
