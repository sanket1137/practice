-- Check the DailySlotAssignmentsJson for Active bookings
SELECT TOP 3
    Id,
    Status,
    StartDate,
    EndDate,
    SlotNumbers,
    DailySlotAssignmentsJson
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status = 4  -- Active
    AND IsDeleted = 0
ORDER BY CreatedAt;
