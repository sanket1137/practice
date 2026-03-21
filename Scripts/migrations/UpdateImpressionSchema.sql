-- Run this SQL in SQL Server Management Studio or Azure Data Studio
-- Connect to: (localdb)\MSSQLLocal DB
-- Database: CCMSDB

-- Check if PlayedAt column exists
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'Impressions' AND COLUMN_NAME = 'PlayedAt')
BEGIN
    -- Rename PlayTimestamp to PlayedAt
    EXEC sp_rename 'Impressions.PlayTimestamp', 'PlayedAt', 'COLUMN';
    PRINT 'Renamed PlayTimestamp to PlayedAt';
END

-- Drop PlayCount column if it exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'Impressions' AND COLUMN_NAME = 'PlayCount')
BEGIN
    ALTER TABLE Impressions DROP COLUMN PlayCount;
    PRINT 'Dropped PlayCount column';
END

-- Drop old indexes
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Impressions_ScreenId_SessionDate')
    DROP INDEX IX_Impressions_ScreenId_SessionDate ON Impressions;

-- Create new optimized indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Impressions_Screen_PlayedAt')
    CREATE INDEX IX_Impressions_Screen_PlayedAt ON Impressions(ScreenId, PlayedAt);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Impressions_Campaign_PlayedAt')
    CREATE INDEX IX_Impressions_Campaign_PlayedAt ON Impressions(CampaignId, PlayedAt);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Impressions_Booking_SessionDate')
    CREATE INDEX IX_Impressions_Booking_SessionDate ON Impressions(BookingId, SessionDate);

PRINT 'Migration completed successfully!';
