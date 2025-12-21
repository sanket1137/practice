-- Check what dates are in DailySlotAssignmentsJson for Screen 13
SELECT TOP 2
    Id,
    Status,
    StartDate,
    EndDate,
    SlotNumbers,
    LEFT(DailySlotAssignmentsJson, 200) as JsonPreview
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status = 'Approved'
    AND IsDeleted = 0
ORDER BY CreatedAt;
