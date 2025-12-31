-- Update bookings for screen c8f0d020-f581-4fa3-b482-c5026ded5a4f
-- Set StartDate and EndDate to 2025-12-31
-- Add 2025-12-31 to DailySlotAssignmentsJson

DECLARE @ScreenId UNIQUEIDENTIFIER = 'c8f0d020-f581-4fa3-b482-c5026ded5a4f';
DECLARE @NewDate DATE = '2025-12-31';

-- First, let's see what bookings exist for this screen
SELECT 
    Id,
    ScreenId,
    CampaignId,
    CreativeId,
    StartDate,
    EndDate,
    SlotNumbers,
    DailySlotAssignmentsJson,
    Status
FROM Bookings
WHERE ScreenId = @ScreenId
  AND IsDeleted = 0;

-- Update each booking
-- For each booking, we'll update dates and add Dec 31 to slot assignments
UPDATE Bookings
SET 
    StartDate = @NewDate,
    EndDate = @NewDate,
    DailySlotAssignmentsJson = JSON_MODIFY(
        ISNULL(DailySlotAssignmentsJson, '{}'),
        '$.2025-12-31T00:00:00',
        CAST(JSON_VALUE(SlotNumbers, '$[0]') AS INT)
    ),
    UpdatedAt = GETUTCDATE()
WHERE ScreenId = @ScreenId
  AND IsDeleted = 0;

-- Verify the changes
SELECT 
    Id,
    StartDate,
    EndDate,
    SlotNumbers,
    DailySlotAssignmentsJson,
    CASE 
        WHEN DailySlotAssignmentsJson LIKE '%2025-12-31%' THEN 'HAS DEC 31'
        ELSE 'MISSING DEC 31'
    END AS ValidationStatus
FROM Bookings
WHERE ScreenId = @ScreenId
  AND IsDeleted = 0;

PRINT 'Bookings updated successfully!';
PRINT 'StartDate and EndDate set to 2025-12-31';
PRINT 'DailySlotAssignmentsJson updated to include Dec 31';
