-- Add online status tracking columns to Screens table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screens]') AND name = 'IsOnline')
BEGIN
    ALTER TABLE [Screens] ADD [IsOnline] bit NOT NULL DEFAULT 0
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screens]') AND name = 'LastSeenAt')
BEGIN
    ALTER TABLE [Screens] ADD [LastSeenAt] datetime2 NULL
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screens]') AND name = 'ConnectedDeviceId')
BEGIN
    ALTER TABLE [Screens] ADD [ConnectedDeviceId] nvarchar(max) NULL
END

-- Make DeviceId nullable
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screens]') AND name = 'DeviceId' AND is_nullable = 0)
BEGIN
    ALTER TABLE [Screens] ALTER COLUMN [DeviceId] nvarchar(100) NULL
END

-- Drop and recreate index on DeviceId (non-unique)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Screens_DeviceId' AND object_id = OBJECT_ID(N'[dbo].[Screens]'))
BEGIN
    DROP INDEX [IX_Screens_DeviceId] ON [Screens]
END

CREATE INDEX [IX_Screens_DeviceId] ON [Screens] ([DeviceId])
