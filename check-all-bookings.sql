-- Check ALL bookings for Screen 13 (no status filter)
SELECT 
    Id,
    Status,
    StartDate,
    EndDate,
    SlotNumbers,
    IsDeleted,
    LEFT(DailySlotAssignmentsJson, 150) as JsonPreview
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
ORDER BY CreatedAt;

-- Also count total bookings for this screen
SELECT COUNT(*) as TotalBookings
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895';
