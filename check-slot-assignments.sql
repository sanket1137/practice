-- Check the DailySlotAssignmentsJson for Screen 13 bookings
SELECT 
    Id,
    Status,
    StartDate,
    EndDate,
    DailySlotAssignmentsJson,
    SlotNumbers
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status = 'Approved'
    AND IsDeleted = 0;

-- The DailySlotAssignmentsJson contains dates like "2025-12-20", "2025-12-21", etc.
-- We need to regenerate this JSON with the new dates (Dec 19-26/27/28)
-- This is complex to do in SQL, so it's better to delete and recreate the bookings
-- OR use a backend endpoint to regenerate the assignments

-- For now, let's see what the JSON looks like
