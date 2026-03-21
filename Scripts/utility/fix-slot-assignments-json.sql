-- Update DailySlotAssignmentsJson for Screen 13 bookings
-- Shift all dates from Dec 19 to Dec 18 to match server UTC date

-- First, let's see current JSON for one booking
SELECT TOP 1
    Id,
    DailySlotAssignmentsJson
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status = 'Approved'
    AND IsDeleted = 0;

-- Update: Replace "2025-12-19" with "2025-12-18" in all JSON assignments
-- Replace "2025-12-20" with "2025-12-19", etc.
UPDATE Bookings
SET DailySlotAssignmentsJson = REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(DailySlotAssignmentsJson,
                                        '2025-12-28', '2025-12-27'),
                                    '2025-12-27', '2025-12-26'),
                                '2025-12-26', '2025-12-25'),
                            '2025-12-25', '2025-12-24'),
                        '2025-12-24', '2025-12-23'),
                    '2025-12-23', '2025-12-22'),
                '2025-12-22', '2025-12-21'),
            '2025-12-21', '2025-12-20'),
        '2025-12-20', '2025-12-19'),
    '2025-12-19', '2025-12-18'),
    -- Also update StartDate to Dec 18
    StartDate = '2025-12-18',
    UpdatedAt = GETUTCDATE()
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status IN ('Approved', 'Active', 'Pending')
    AND IsDeleted = 0;

-- Verify the changes
SELECT 
    Id,
    Status,
    StartDate,
    EndDate,
    DailySlotAssignmentsJson
FROM Bookings
WHERE ScreenId = 'be6830be-1e29-4f9b-957d-5c3af3e19895'
    AND Status IN ('Approved', 'Active', 'Pending')
    AND IsDeleted = 0;
