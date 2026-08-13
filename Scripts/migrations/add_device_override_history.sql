-- Migration: Add DeviceOverrideHistories table
-- Purpose: Persist device override requests to survive backend restarts.
--          Replaces the in-memory ConcurrentDictionary approach.
-- Date: 2025-02-10

CREATE TABLE IF NOT EXISTS "DeviceOverrideHistories" (
    "Id" uuid NOT NULL,
    "ScreenId" uuid NOT NULL,
    "Action" character varying(50) NOT NULL,
    "Reason" character varying(500) NOT NULL,
    "OldFingerprintHash" character varying(100),
    "NewFingerprintHash" character varying(100),
    "RequestedByUserId" uuid NOT NULL,
    "ExpiresAt" timestamp with time zone,
    "IsPending" boolean NOT NULL DEFAULT false,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_DeviceOverrideHistories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_DeviceOverrideHistories_Screens_ScreenId" 
        FOREIGN KEY ("ScreenId") REFERENCES "Screens"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_DeviceOverrideHistories_Users_RequestedByUserId" 
        FOREIGN KEY ("RequestedByUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT
);

-- Index for querying history by screen
CREATE INDEX IF NOT EXISTS "IX_DeviceOverrideHistory_Screen" 
    ON "DeviceOverrideHistories" ("ScreenId");

-- Index for finding active pending overrides (hot path during handshake)
CREATE INDEX IF NOT EXISTS "IX_DeviceOverrideHistory_Screen_Pending" 
    ON "DeviceOverrideHistories" ("ScreenId", "IsPending");

-- Insert into EF migration history so dotnet ef doesn't re-run
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260210120000_AddDeviceOverrideHistory', '8.0.0')
ON CONFLICT DO NOTHING;
