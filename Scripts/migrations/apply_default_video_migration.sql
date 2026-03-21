-- Migration: AddDefaultVideoToScreens
-- Add default video columns to Screens table

ALTER TABLE [Screens] ADD [DefaultVideoUrl] nvarchar(500) NULL;
ALTER TABLE [Screens] ADD [HasCustomDefaultVideo] bit NOT NULL DEFAULT 0;
ALTER TABLE [Screens] ADD [DefaultVideoUploadedAt] datetime2 NULL;
ALTER TABLE [Screens] ADD [DefaultVideoSizeBytes] bigint NULL;

-- Insert migration history record
INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251228073800_AddDefaultVideoToScreens', N'8.0.0');
