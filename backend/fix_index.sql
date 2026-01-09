-- Drop the existing index
DROP INDEX IF EXISTS IX_OwnerContents_ScreenId_SlotNumber ON OwnerContents;
GO

-- Recreate with filter
CREATE UNIQUE INDEX IX_OwnerContents_ScreenId_SlotNumber 
ON OwnerContents(ScreenId, SlotNumber) 
WHERE IsDeleted = 0;
GO
