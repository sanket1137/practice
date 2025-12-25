-- Add Live Streaming columns to Screens table
-- Run this manually in SQL Server Management Studio or via sqlcmd

USE PracticePixelCCMSDb;
GO

-- Add columns if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Screens') AND name = 'LiveStreamingEnabled')
BEGIN
    ALTER TABLE Screens ADD LiveStreamingEnabled BIT NOT NULL DEFAULT 0;
    PRINT 'Added LiveStreamingEnabled column';
END
ELSE
BEGIN
    PRINT 'LiveStreamingEnabled column already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Screens') AND name = 'LastStreamedAt')
BEGIN
    ALTER TABLE Screens ADD LastStreamedAt DATETIME2(7) NULL;
    PRINT 'Added LastStreamedAt column';
END
ELSE
BEGIN
    PRINT 'LastStreamedAt column already exists';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Screens') AND name = 'CurrentViewerCount')
BEGIN
    ALTER TABLE Screens ADD CurrentViewerCount INT NOT NULL DEFAULT 0;
    PRINT 'Added CurrentViewerCount column';
END
ELSE
BEGIN
    PRINT 'CurrentViewerCount column already exists';
END

-- Verify the columns were added
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Screens'
    AND COLUMN_NAME IN ('LiveStreamingEnabled', 'LastStreamedAt', 'CurrentViewerCount');

PRINT 'Migration complete!';
