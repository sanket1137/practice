UPDATE Bookings 
SET DailySlotAssignmentsJson = REPLACE(DailySlotAssignmentsJson, '2025-12-28', '2025-12-27')
WHERE DailySlotAssignmentsJson LIKE '%2025-12-28%';

SELECT Id, LEFT(DailySlotAssignmentsJson, 100) AS JsonPreview FROM Bookings;
