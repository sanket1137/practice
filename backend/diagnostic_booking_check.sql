-- Diagnostic Query: Check Bookings for Screen
-- Run this in SSMS or Azure Data Studio to see why bookings aren't appearing

DECLARE @ScreenId UNIQUEIDENTIFIER = '0552b0c3-450a-4e28-9f5c-1e49af6c3642';
DECLARE @Today DATE = '2025-12-30';

SELECT  
    b.Id AS BookingId,
    b.Status,
    b.StartDate,
    b.EndDate,
    b.DailySlotAssignmentsJson,
    c.Id AS CampaignId,
    c.Name AS CampaignName,
    cr.Id AS CreativeId,
    cr.FileUrl,
    CASE 
        WHEN b.IsDeleted = 1 THEN 'DELETED'
        WHEN b.Status NOT IN (2, 3, 4) THEN 'WRONG STATUS (' + CAST(b.Status AS VARCHAR) + ')'
        WHEN b.StartDate > @Today THEN 'NOT STARTED YET'
        WHEN b.EndDate < @Today THEN 'ENDED'
        WHEN b.DailySlotAssignmentsJson IS NULL THEN 'NO SLOT ASSIGNMENTS'
        WHEN b.DailySlotAssignmentsJson NOT LIKE '%' + CAST(@Today AS VARCHAR) + '%' THEN 'NO SLOTS FOR TODAY'
        ELSE 'SHOULD APPEAR'
    END AS ValidationStatus
FROM Bookings b
LEFT JOIN Campaigns c ON b.CampaignId = c.Id
LEFT JOIN Creatives cr ON b.CreativeId = cr.Id
WHERE b.ScreenId = @ScreenId
  AND b.IsDeleted = 0
ORDER BY b.StartDate DESC;

-- Also check screen configuration
SELECT 
    Id,
    Name,
    SlotsPerFrame,
    TimeFrameMinutes,
    OperatingHours
FROM Screens
WHERE Id = @ScreenId;
