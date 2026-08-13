-- Phase 2.1: Add SlotAvailability table and Creative locking fields
-- Run this after stopping the backend application

-- 1. Add Creative locking fields
ALTER TABLE Creatives 
ADD IsLocked BIT NOT NULL DEFAULT 0,
    LockedReason NVARCHAR(MAX) NULL;

-- 2. Create SlotAvailabilities table
CREATE TABLE SlotAvailabilities (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    ScreenId UNIQUEIDENTIFIER NOT NULL,
    Date DATETIME2 NOT NULL,
    TotalSlots INT NOT NULL,
    BookedSlots INT NOT NULL DEFAULT 0,
    SlotBookings NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    IsDeleted BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    -- Foreign key
    CONSTRAINT FK_SlotAvailabilities_Screens_ScreenId 
        FOREIGN KEY (ScreenId) REFERENCES Screens(Id) ON DELETE CASCADE,
    
    -- Unique constraint
    CONSTRAINT UQ_SlotAvailabilities_ScreenId_Date 
        UNIQUE (ScreenId, Date),
    
    -- Check constraints
    CONSTRAINT CK_SlotAvailability_BookedSlotsNonNegative 
        CHECK (BookedSlots >= 0),
    CONSTRAINT CK_SlotAvailability_BookedSlotsNotExceedTotal 
        CHECK (BookedSlots <= TotalSlots)
);

-- 3. Create index for performance
CREATE INDEX IX_SlotAvailabilities_ScreenId_Date 
    ON SlotAvailabilities(ScreenId, Date);

PRINT 'Migration completed successfully!';
