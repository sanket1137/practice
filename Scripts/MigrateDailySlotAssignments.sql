-- ============================================
-- CCMS Data Format Migration Script
-- Purpose: Fix legacy DailySlotAssignmentsJson formats
-- Author: CCMS Development Team
-- Date: 2026-01-09
-- ============================================

-- ============================================
-- STEP 1: Identify problematic bookings
-- ============================================
SELECT 
    Id,
    ScreenId,
    DailySlotAssignmentsJson,
    CASE
        WHEN DailySlotAssignmentsJson LIKE '%T00:00:00%' THEN 'Has Timestamp'
        WHEN DailySlotAssignmentsJson LIKE '%":%' 
            AND DailySlotAssignmentsJson NOT LIKE '%[%' THEN 'Integer Value (not array)'
        WHEN DailySlotAssignmentsJson IS NULL THEN 'NULL (OK)'
        ELSE 'OK'
    END AS FormatIssue,
    Status,
    StartDate,
    EndDate
FROM Bookings
WHERE DailySlotAssignmentsJson IS NOT NULL
ORDER BY 
    CASE 
        WHEN DailySlotAssignmentsJson LIKE '%T00:00:00%' THEN 1
        WHEN DailySlotAssignmentsJson NOT LIKE '%[%' THEN 2
        ELSE 3
    END;

-- ============================================
-- STEP 2: Backup before migration
-- ============================================
-- Create backup table
SELECT * 
INTO Bookings_Backup_20260109
FROM Bookings;

PRINT 'Backup created: Bookings_Backup_20260109';

-- ============================================
-- STEP 3: Fix timestamp format
-- ============================================
-- Convert {"2026-01-09T00:00:00":2} → {"2026-01-09":[2]}
UPDATE Bookings
SET DailySlotAssignmentsJson = 
    REPLACE(
        REPLACE(DailySlotAssignmentsJson, 'T00:00:00', ''),
        ':', ':[')  -- Add array brackets
WHERE DailySlotAssignmentsJson LIKE '%T00:00:00%';

PRINT 'Fixed timestamp format';

-- ============================================
-- STEP 4: Fix integer values (no arrays)
-- ============================================
-- This is complex - we'll log these for manual review
SELECT 
    Id,
    DailySlotAssignmentsJson,
    'NEEDS MANUAL FIX: Convert int to array' AS Action
FROM Bookings
WHERE DailySlotAssignmentsJson IS NOT NULL
  AND DailySlotAssignmentsJson LIKE '%":%'
  AND DailySlotAssignmentsJson NOT LIKE '%[%';

-- For simple cases (single key-value):
-- {"2026-01-09": 2} → {"2026-01-09": [2]}
UPDATE Bookings
SET DailySlotAssignmentsJson = 
    REPLACE(
        REPLACE(DailySlotAssignmentsJson, ': ', ':['),
        '}', ']}')
WHERE DailySlotAssignmentsJson IS NOT NULL
  AND DailySlotAssignmentsJson LIKE '%": %'
  AND DailySlotAssignmentsJson NOT LIKE '%[%'
  AND LEN(DailySlotAssignmentsJson) - LEN(REPLACE(DailySlotAssignmentsJson, ':', '')) = 1;  -- Only one key-value pair

PRINT 'Fixed simple integer formats';

-- ============================================
-- STEP 5: Verify results
-- ============================================
SELECT 
    CASE
        WHEN DailySlotAssignmentsJson LIKE '%T00:00:00%' THEN 'Still has timestamp'
        WHEN DailySlotAssignmentsJson LIKE '%":%' 
            AND DailySlotAssignmentsJson NOT LIKE '%[%' THEN 'Still has int value'
        WHEN DailySlotAssignmentsJson IS NULL THEN 'NULL'
        ELSE 'Standardized'
    END AS FormatStatus,
    COUNT(*) AS Count
FROM Bookings
GROUP BY 
    CASE
        WHEN DailySlotAssignmentsJson LIKE '%T00:00:00%' THEN 'Still has timestamp'
        WHEN DailySlotAssignmentsJson LIKE '%":%' 
            AND DailySlotAssignmentsJson NOT LIKE '%[%' THEN 'Still has int value'
        WHEN DailySlotAssignmentsJson IS NULL THEN 'NULL'
        ELSE 'Standardized'
    END;

-- ============================================
-- STEP 6: Manual review candidates
-- ============================================
-- These bookings have complex formats that need manual review
SELECT 
    Id,
    ScreenId,
    DailySlotAssignmentsJson,
    'Complex format - review manually' AS Note
FROM Bookings
WHERE DailySlotAssignmentsJson IS NOT NULL
  AND (
      DailySlotAssignmentsJson LIKE '%T00:00:00%'
      OR (DailySlotAssignmentsJson LIKE '%":%' AND DailySlotAssignmentsJson NOT LIKE '%[%')
  );

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
/*
-- Uncomment to rollback changes
UPDATE Bookings
SET DailySlotAssignmentsJson = b.DailySlotAssignmentsJson
FROM Bookings_Backup_20260109 b
WHERE Bookings.Id = b.Id;

PRINT 'Rolled back to backup';
*/

-- ============================================
-- CLEANUP (after verification)
-- ============================================
/*
-- Uncomment after verifying migration success
DROP TABLE Bookings_Backup_20260109;
PRINT 'Backup table dropped';
*/

PRINT 'Migration complete! Review manual candidates above.';
