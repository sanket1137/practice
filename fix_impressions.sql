-- Fix Impressions table schema
-- Update any NULL PlayedAt to current time
UPDATE Impressions SET PlayedAt = GETUTCDATE() WHERE PlayedAt IS NULL;

-- Make PlayedAt NOT NULL
ALTER TABLE Impressions ALTER COLUMN PlayedAt datetime2 NOT NULL;

-- Add default value for PlayCount if needed  
UPDATE Impressions SET PlayCount = 1 WHERE PlayCount IS NULL;

PRINT 'Schema fix complete';
