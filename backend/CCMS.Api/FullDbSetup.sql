CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Users" (
        "Id" uniqueidentifier NOT NULL,
        "Email" nvarchar(255) NOT NULL,
        "PasswordHash" nvarchar(max) NOT NULL,
        "FirstName" nvarchar(100) NOT NULL,
        "LastName" nvarchar(100) NOT NULL,
        "PhoneNumber" nvarchar(max),
        "Role" int NOT NULL,
        "ProfileImageUrl" nvarchar(max),
        "IsEmailVerified" bit NOT NULL,
        "LastLoginAt" datetime2,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Campaigns" (
        "Id" uniqueidentifier NOT NULL,
        "AdvertiserId" uniqueidentifier NOT NULL,
        "Name" nvarchar(200) NOT NULL,
        "Description" nvarchar(max) NOT NULL,
        "Budget" decimal(18,2) NOT NULL,
        "Currency" nvarchar(max) NOT NULL,
        "StartDate" datetime2 NOT NULL,
        "EndDate" datetime2 NOT NULL,
        "Status" int NOT NULL,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Campaigns" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Campaigns_Users_AdvertiserId" FOREIGN KEY ("AdvertiserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Organizations" (
        "Id" uniqueidentifier NOT NULL,
        "Name" nvarchar(200) NOT NULL,
        "Description" nvarchar(max) NOT NULL,
        "LogoUrl" nvarchar(max),
        "OwnerId" uniqueidentifier NOT NULL,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Organizations" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Organizations_Users_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "RefreshTokens" (
        "Id" uniqueidentifier NOT NULL,
        "UserId" uniqueidentifier NOT NULL,
        "Token" nvarchar(450) NOT NULL,
        "ExpiresAt" datetime2 NOT NULL,
        "IsRevoked" bit NOT NULL,
        "RevokedByIp" nvarchar(max),
        "RevokedAt" datetime2,
        "CreatedByIp" nvarchar(max),
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_RefreshTokens" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_RefreshTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Screens" (
        "Id" uniqueidentifier NOT NULL,
        "OwnerId" uniqueidentifier NOT NULL,
        "Name" nvarchar(200) NOT NULL,
        "Description" nvarchar(max) NOT NULL,
        "PhysicalWidth" decimal(18,2) NOT NULL,
        "PhysicalHeight" decimal(18,2) NOT NULL,
        "DimensionUnit" nvarchar(max) NOT NULL,
        "ResolutionWidth" int NOT NULL,
        "ResolutionHeight" int NOT NULL,
        "Location_Street" nvarchar(200) NOT NULL,
        "Location_City" nvarchar(100) NOT NULL,
        "Location_State" nvarchar(100) NOT NULL,
        "Location_Country" nvarchar(100) NOT NULL,
        "Location_PostalCode" nvarchar(20) NOT NULL,
        "Latitude" decimal(18,2) NOT NULL,
        "Longitude" decimal(18,2) NOT NULL,
        "Schedule_Monday_StartTime" time NOT NULL,
        "Schedule_Monday_EndTime" time NOT NULL,
        "Schedule_Monday_IsOperating" bit NOT NULL,
        "Schedule_Tuesday_StartTime" time NOT NULL,
        "Schedule_Tuesday_EndTime" time NOT NULL,
        "Schedule_Tuesday_IsOperating" bit NOT NULL,
        "Schedule_Wednesday_StartTime" time NOT NULL,
        "Schedule_Wednesday_EndTime" time NOT NULL,
        "Schedule_Wednesday_IsOperating" bit NOT NULL,
        "Schedule_Thursday_StartTime" time NOT NULL,
        "Schedule_Thursday_EndTime" time NOT NULL,
        "Schedule_Thursday_IsOperating" bit NOT NULL,
        "Schedule_Friday_StartTime" time NOT NULL,
        "Schedule_Friday_EndTime" time NOT NULL,
        "Schedule_Friday_IsOperating" bit NOT NULL,
        "Schedule_Saturday_StartTime" time NOT NULL,
        "Schedule_Saturday_EndTime" time NOT NULL,
        "Schedule_Saturday_IsOperating" bit NOT NULL,
        "Schedule_Sunday_StartTime" time NOT NULL,
        "Schedule_Sunday_EndTime" time NOT NULL,
        "Schedule_Sunday_IsOperating" bit NOT NULL,
        "TimeFrameMinutes" int NOT NULL,
        "SlotsPerFrame" int NOT NULL,
        "DeviceId" nvarchar(100) NOT NULL,
        "LastSyncAt" datetime2,
        "Status" int NOT NULL,
        "IsOnline" bit NOT NULL,
        "LastSeenAt" datetime2,
        "ConnectedDeviceId" nvarchar(max),
        "ApiKeyHash" nvarchar(max),
        "MaxViewers" int NOT NULL,
        "DefaultVideoUrl" nvarchar(max),
        "HasCustomDefaultVideo" bit NOT NULL,
        "DefaultVideoUploadedAt" datetime2,
        "DefaultVideoSizeBytes" bigint,
        "PricePerSlot" decimal(18,2) NOT NULL,
        "Currency" nvarchar(max) NOT NULL,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Screens" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Screens_Users_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Creatives" (
        "Id" uniqueidentifier NOT NULL,
        "CampaignId" uniqueidentifier NOT NULL,
        "Name" nvarchar(200) NOT NULL,
        "FileUrl" nvarchar(max) NOT NULL,
        "FileName" nvarchar(255) NOT NULL,
        "MimeType" nvarchar(max) NOT NULL,
        "FileSize" bigint NOT NULL,
        "FileHash" nvarchar(max) NOT NULL,
        "Width" int NOT NULL,
        "Height" int NOT NULL,
        "Duration" int NOT NULL,
        "ThumbnailUrl" nvarchar(max),
        "IsLocked" bit NOT NULL,
        "LockedReason" nvarchar(max),
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Creatives" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Creatives_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Memberships" (
        "Id" uniqueidentifier NOT NULL,
        "UserId" uniqueidentifier NOT NULL,
        "OrganizationId" uniqueidentifier NOT NULL,
        "Role" nvarchar(max) NOT NULL,
        "JoinedAt" datetime2 NOT NULL,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Memberships" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Memberships_Organizations_OrganizationId" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_Memberships_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "SlotAvailabilities" (
        "Id" uniqueidentifier NOT NULL,
        "ScreenId" uniqueidentifier NOT NULL,
        "Date" datetime2 NOT NULL,
        "TotalSlots" int NOT NULL,
        "BookedSlots" int NOT NULL,
        "SlotBookings" nvarchar(max) NOT NULL,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_SlotAvailabilities" PRIMARY KEY ("Id"),
        CONSTRAINT "CK_SlotAvailability_BookedSlotsNonNegative" CHECK ([BookedSlots] >= 0),
        CONSTRAINT "CK_SlotAvailability_BookedSlotsNotExceedTotal" CHECK ([BookedSlots] <= [TotalSlots]),
        CONSTRAINT "FK_SlotAvailabilities_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Bookings" (
        "Id" uniqueidentifier NOT NULL,
        "ScreenId" uniqueidentifier NOT NULL,
        "CampaignId" uniqueidentifier NOT NULL,
        "CreativeId" uniqueidentifier NOT NULL,
        "StartDate" datetime2 NOT NULL,
        "EndDate" datetime2 NOT NULL,
        "SlotNumbers" nvarchar(max) NOT NULL,
        "DailySlotAssignmentsJson" nvarchar(max),
        "Status" int NOT NULL,
        "RejectionReason" nvarchar(max),
        "ApprovedBy" uniqueidentifier,
        "ApprovedAt" datetime2,
        "ExpectedImpressions" int NOT NULL,
        "DeliveredImpressions" int NOT NULL,
        "TotalPrice" decimal(18,2) NOT NULL,
        "Currency" nvarchar(max) NOT NULL,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Bookings" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Bookings_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Bookings_Creatives_CreativeId" FOREIGN KEY ("CreativeId") REFERENCES "Creatives" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Bookings_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE TABLE "Impressions" (
        "Id" uniqueidentifier NOT NULL,
        "BookingId" uniqueidentifier NOT NULL,
        "CampaignId" uniqueidentifier NOT NULL,
        "ScreenId" uniqueidentifier NOT NULL,
        "CreativeId" uniqueidentifier NOT NULL,
        "PlayedAt" datetime2 NOT NULL,
        "SessionDate" datetime2 NOT NULL,
        "DeviceId" nvarchar(max) NOT NULL,
        "SlotPosition" int,
        "IsVerified" bit NOT NULL,
        "CreatedAt" datetime2 NOT NULL,
        "UpdatedAt" datetime2,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_Impressions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Impressions_Bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES "Bookings" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_Impressions_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Impressions_Creatives_CreativeId" FOREIGN KEY ("CreativeId") REFERENCES "Creatives" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Impressions_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Bookings_CampaignId" ON "Bookings" ("CampaignId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Bookings_CreativeId" ON "Bookings" ("CreativeId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Bookings_ScreenId" ON "Bookings" ("ScreenId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Campaigns_AdvertiserId" ON "Campaigns" ("AdvertiserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Creatives_CampaignId" ON "Creatives" ("CampaignId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Impressions_Booking_SessionDate" ON "Impressions" ("BookingId", "SessionDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Impressions_Campaign_PlayedAt" ON "Impressions" ("CampaignId", "PlayedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Impressions_CreativeId" ON "Impressions" ("CreativeId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Impressions_Screen_PlayedAt" ON "Impressions" ("ScreenId", "PlayedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Memberships_OrganizationId" ON "Memberships" ("OrganizationId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_Memberships_UserId_OrganizationId" ON "Memberships" ("UserId", "OrganizationId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Organizations_OwnerId" ON "Organizations" ("OwnerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_RefreshTokens_Token" ON "RefreshTokens" ("Token");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_RefreshTokens_UserId" ON "RefreshTokens" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Screens_DeviceId" ON "Screens" ("DeviceId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE INDEX "IX_Screens_OwnerId" ON "Screens" ("OwnerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_SlotAvailabilities_ScreenId_Date" ON "SlotAvailabilities" ("ScreenId", "Date");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064731_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20251230064731_InitialCreate', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064811_SeedTestUsers') THEN

                    -- Admin user
                    IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'admin@ccms.com')
                    BEGIN
                        INSERT INTO Users (Id, Email, FirstName, LastName, PasswordHash, Role, IsEmailVerified, CreatedAt, IsDeleted)
                        VALUES (
                            '11111111-1111-1111-1111-111111111111',
                            'admin@ccms.com',
                            'Admin',
                            'User',
                            '$2a$11$K7tPD1TzRX5RfZvKqG5z0uIf9j6Y8V7qJ5XKz3U1L9M2N4O6P8Q0R',
                            0,
                            1,
                            GETUTCDATE(),
                            0
                        )
                    END

                    -- Screen Owner user
                    IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'owner@ccms.com')
                    BEGIN
                        INSERT INTO Users (Id, Email, FirstName, LastName, PasswordHash, Role, IsEmailVerified, CreatedAt, IsDeleted)
                        VALUES (
                            '22222222-2222-2222-2222-222222222222',
                            'owner@ccms.com',
                            'Screen',
                            'Owner',
                            '$2a$11$K7tPD1TzRX5RfZvKqG5z0uIf9j6Y8V7qJ5XKz3U1L9M2N4O6P8Q0R',
                            1,
                            1,
                            GETUTCDATE(),
                            0
                        )
                    END

                    -- Advertiser user
                    IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'advertiser@ccms.com')
                    BEGIN
                        INSERT INTO Users (Id, Email, FirstName, LastName, PasswordHash, Role, IsEmailVerified, CreatedAt, IsDeleted)
                        VALUES (
                            '33333333-3333-3333-3333-333333333333',
                            'advertiser@ccms.com',
                            'Advertiser',
                            'User',
                            '$2a$11$K7tPD1TzRX5RfZvKqG5z0uIf9j6Y8V7qJ5XKz3U1L9M2N4O6P8Q0R',
                            2,
                            1,
                            GETUTCDATE(),
                            0
                        )
                    END
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20251230064811_SeedTestUsers') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20251230064811_SeedTestUsers', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260107114303_AddOwnerContentSupport') THEN
    ALTER TABLE "Impressions" ADD "OwnerContentId" uniqueidentifier;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260107114303_AddOwnerContentSupport') THEN
    CREATE TABLE "OwnerContents" (
        "Id" uniqueidentifier NOT NULL,
        "ScreenId" uniqueidentifier NOT NULL,
        "SlotNumber" int NOT NULL,
        "Name" nvarchar(200) NOT NULL,
        "FileUrl" nvarchar(max) NOT NULL,
        "FileHash" nvarchar(max) NOT NULL,
        "MimeType" nvarchar(max) NOT NULL,
        "Duration" int NOT NULL,
        "PricePerPlay" decimal(10,2) NOT NULL,
        "IsActive" bit NOT NULL,
        "UpdatedAt" datetime2,
        "CreatedAt" datetime2 NOT NULL,
        "IsDeleted" bit NOT NULL,
        CONSTRAINT "PK_OwnerContents" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_OwnerContents_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260107114303_AddOwnerContentSupport') THEN
    CREATE INDEX "IX_Impressions_OwnerContentId" ON "Impressions" ("OwnerContentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260107114303_AddOwnerContentSupport') THEN
    CREATE UNIQUE INDEX "IX_OwnerContents_ScreenId_SlotNumber" ON "OwnerContents" ("ScreenId", "SlotNumber");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260107114303_AddOwnerContentSupport') THEN
    ALTER TABLE "Impressions" ADD CONSTRAINT "FK_Impressions_OwnerContents_OwnerContentId" FOREIGN KEY ("OwnerContentId") REFERENCES "OwnerContents" ("Id") ON DELETE SET NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260107114303_AddOwnerContentSupport') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260107114303_AddOwnerContentSupport', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108070720_FilterUniqueIndexForOwnerContent') THEN
    DROP INDEX "IX_OwnerContents_ScreenId_SlotNumber";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108070720_FilterUniqueIndexForOwnerContent') THEN
    CREATE UNIQUE INDEX "IX_OwnerContents_ScreenId_SlotNumber" ON "OwnerContents" ("ScreenId", "SlotNumber") WHERE [IsDeleted] = 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108070720_FilterUniqueIndexForOwnerContent') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260108070720_FilterUniqueIndexForOwnerContent', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108114610_MakeImpressionFKsNullable') THEN
    ALTER TABLE "Impressions" ALTER COLUMN "CreativeId" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108114610_MakeImpressionFKsNullable') THEN
    ALTER TABLE "Impressions" ALTER COLUMN "CampaignId" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108114610_MakeImpressionFKsNullable') THEN
    ALTER TABLE "Impressions" ALTER COLUMN "BookingId" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108114610_MakeImpressionFKsNullable') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260108114610_MakeImpressionFKsNullable', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108190139_AddCurrencyToOwnerContent') THEN
    ALTER TABLE "OwnerContents" ADD "Currency" nvarchar(max) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260108190139_AddCurrencyToOwnerContent') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260108190139_AddCurrencyToOwnerContent', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260109055502_AddTimezoneToScreen') THEN
    ALTER TABLE "Screens" ADD "Timezone" nvarchar(max) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260109055502_AddTimezoneToScreen') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260109055502_AddTimezoneToScreen', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260109141112_SystemImprovements') THEN
    ALTER TABLE "Screens" ALTER COLUMN "PhysicalWidth" TYPE decimal(8,2);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260109141112_SystemImprovements') THEN
    ALTER TABLE "Screens" ALTER COLUMN "PhysicalHeight" TYPE decimal(8,2);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260109141112_SystemImprovements') THEN
    ALTER TABLE "Screens" ALTER COLUMN "Longitude" TYPE decimal(9,6);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260109141112_SystemImprovements') THEN
    ALTER TABLE "Screens" ALTER COLUMN "Latitude" TYPE decimal(9,6);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260109141112_SystemImprovements') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260109141112_SystemImprovements', '8.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Users" (
        "Id" uuid NOT NULL,
        "Email" character varying(255) NOT NULL,
        "PasswordHash" text NOT NULL,
        "FirstName" character varying(100) NOT NULL,
        "LastName" character varying(100) NOT NULL,
        "PhoneNumber" text,
        "Role" integer NOT NULL,
        "ProfileImageUrl" text,
        "IsEmailVerified" boolean NOT NULL,
        "IsPhoneVerified" boolean NOT NULL,
        "LastLoginAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Campaigns" (
        "Id" uuid NOT NULL,
        "AdvertiserId" uuid NOT NULL,
        "Name" character varying(200) NOT NULL,
        "Description" text,
        "StartDate" timestamp with time zone NOT NULL,
        "EndDate" timestamp with time zone,
        "Budget" numeric(18,2) NOT NULL,
        "Currency" text NOT NULL,
        "Status" integer NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Campaigns" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Campaigns_Users_AdvertiserId" FOREIGN KEY ("AdvertiserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "EmailVerificationTokens" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "Token" character varying(100) NOT NULL,
        "ExpiresAt" timestamp with time zone NOT NULL,
        "IsUsed" boolean NOT NULL,
        "UsedAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_EmailVerificationTokens" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_EmailVerificationTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Organizations" (
        "Id" uuid NOT NULL,
        "Name" character varying(200) NOT NULL,
        "Description" text NOT NULL,
        "LogoUrl" text,
        "OwnerId" uuid NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Organizations" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Organizations_Users_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "PasswordResetTokens" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "Token" character varying(100) NOT NULL,
        "ExpiresAt" timestamp with time zone NOT NULL,
        "IsUsed" boolean NOT NULL,
        "UsedAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_PasswordResetTokens" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_PasswordResetTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "PhoneVerificationOtps" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "PhoneNumber" character varying(15) NOT NULL,
        "OtpCode" character varying(6) NOT NULL,
        "ExpiresAt" timestamp with time zone NOT NULL,
        "IsUsed" boolean NOT NULL,
        "UsedAt" timestamp with time zone,
        "AttemptCount" integer NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_PhoneVerificationOtps" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_PhoneVerificationOtps_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "RefreshTokens" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "Token" text NOT NULL,
        "ExpiresAt" timestamp with time zone NOT NULL,
        "IsRevoked" boolean NOT NULL,
        "RevokedByIp" text,
        "RevokedAt" timestamp with time zone,
        "CreatedByIp" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_RefreshTokens" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_RefreshTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Screens" (
        "Id" uuid NOT NULL,
        "OwnerId" uuid NOT NULL,
        "Name" character varying(200) NOT NULL,
        "Description" text NOT NULL,
        "PhysicalWidth" numeric(8,2) NOT NULL,
        "PhysicalHeight" numeric(8,2) NOT NULL,
        "DimensionUnit" text NOT NULL,
        "ResolutionWidth" integer NOT NULL,
        "ResolutionHeight" integer NOT NULL,
        "Location_Street" character varying(200) NOT NULL,
        "Location_City" character varying(100) NOT NULL,
        "Location_State" character varying(100) NOT NULL,
        "Location_Country" character varying(100) NOT NULL,
        "Location_PostalCode" character varying(20) NOT NULL,
        "Latitude" numeric(9,6) NOT NULL,
        "Longitude" numeric(9,6) NOT NULL,
        "Timezone" text NOT NULL,
        "Schedule_Monday_StartTime" interval NOT NULL,
        "Schedule_Monday_EndTime" interval NOT NULL,
        "Schedule_Monday_IsOperating" boolean NOT NULL,
        "Schedule_Tuesday_StartTime" interval NOT NULL,
        "Schedule_Tuesday_EndTime" interval NOT NULL,
        "Schedule_Tuesday_IsOperating" boolean NOT NULL,
        "Schedule_Wednesday_StartTime" interval NOT NULL,
        "Schedule_Wednesday_EndTime" interval NOT NULL,
        "Schedule_Wednesday_IsOperating" boolean NOT NULL,
        "Schedule_Thursday_StartTime" interval NOT NULL,
        "Schedule_Thursday_EndTime" interval NOT NULL,
        "Schedule_Thursday_IsOperating" boolean NOT NULL,
        "Schedule_Friday_StartTime" interval NOT NULL,
        "Schedule_Friday_EndTime" interval NOT NULL,
        "Schedule_Friday_IsOperating" boolean NOT NULL,
        "Schedule_Saturday_StartTime" interval NOT NULL,
        "Schedule_Saturday_EndTime" interval NOT NULL,
        "Schedule_Saturday_IsOperating" boolean NOT NULL,
        "Schedule_Sunday_StartTime" interval NOT NULL,
        "Schedule_Sunday_EndTime" interval NOT NULL,
        "Schedule_Sunday_IsOperating" boolean NOT NULL,
        "TimeFrameMinutes" integer NOT NULL,
        "SlotsPerFrame" integer NOT NULL,
        "DeviceId" character varying(100) NOT NULL,
        "LastSyncAt" timestamp with time zone,
        "Status" integer NOT NULL,
        "IsOnline" boolean NOT NULL,
        "LastSeenAt" timestamp with time zone,
        "ConnectedDeviceId" text,
        "ApiKeyHash" text,
        "MaxViewers" integer NOT NULL,
        "DefaultVideoUrl" text,
        "HasCustomDefaultVideo" boolean NOT NULL,
        "DefaultVideoUploadedAt" timestamp with time zone,
        "DefaultVideoSizeBytes" bigint,
        "PricePerSlot" numeric(18,2) NOT NULL,
        "Currency" text NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Screens" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Screens_Users_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Creatives" (
        "Id" uuid NOT NULL,
        "CampaignId" uuid NOT NULL,
        "Name" character varying(200) NOT NULL,
        "FileUrl" text NOT NULL,
        "FileName" character varying(255) NOT NULL,
        "MimeType" text NOT NULL,
        "FileSize" bigint NOT NULL,
        "FileHash" text NOT NULL,
        "Width" integer NOT NULL,
        "Height" integer NOT NULL,
        "Duration" integer NOT NULL,
        "ThumbnailUrl" text,
        "IsLocked" boolean NOT NULL,
        "LockedReason" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Creatives" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Creatives_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Memberships" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "OrganizationId" uuid NOT NULL,
        "Role" text NOT NULL,
        "JoinedAt" timestamp with time zone NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Memberships" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Memberships_Organizations_OrganizationId" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_Memberships_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "OwnerContents" (
        "Id" uuid NOT NULL,
        "ScreenId" uuid NOT NULL,
        "SlotNumber" integer NOT NULL,
        "Name" character varying(200) NOT NULL,
        "FileUrl" text NOT NULL,
        "FileHash" text NOT NULL,
        "MimeType" text NOT NULL,
        "Duration" integer NOT NULL,
        "PricePerPlay" numeric(10,2) NOT NULL,
        "Currency" text NOT NULL,
        "IsActive" boolean NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_OwnerContents" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_OwnerContents_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "SlotAvailabilities" (
        "Id" uuid NOT NULL,
        "ScreenId" uuid NOT NULL,
        "Date" timestamp with time zone NOT NULL,
        "TotalSlots" integer NOT NULL,
        "BookedSlots" integer NOT NULL,
        "SlotBookings" text NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_SlotAvailabilities" PRIMARY KEY ("Id"),
        CONSTRAINT "CK_SlotAvailability_BookedSlotsNonNegative" CHECK ("BookedSlots" >= 0),
        CONSTRAINT "CK_SlotAvailability_BookedSlotsNotExceedTotal" CHECK ("BookedSlots" <= "TotalSlots"),
        CONSTRAINT "FK_SlotAvailabilities_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Bookings" (
        "Id" uuid NOT NULL,
        "ScreenId" uuid NOT NULL,
        "CampaignId" uuid NOT NULL,
        "CreativeId" uuid NOT NULL,
        "StartDate" timestamp with time zone NOT NULL,
        "EndDate" timestamp with time zone NOT NULL,
        "SlotNumbers" text NOT NULL,
        "DailySlotAssignmentsJson" text,
        "Status" integer NOT NULL,
        "RejectionReason" text,
        "ApprovedBy" uuid,
        "ApprovedAt" timestamp with time zone,
        "ExpectedImpressions" integer NOT NULL,
        "DeliveredImpressions" integer NOT NULL,
        "TotalPrice" numeric(18,2) NOT NULL,
        "Currency" text NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Bookings" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Bookings_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Bookings_Creatives_CreativeId" FOREIGN KEY ("CreativeId") REFERENCES "Creatives" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Bookings_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE TABLE "Impressions" (
        "Id" uuid NOT NULL,
        "BookingId" uuid,
        "CampaignId" uuid,
        "ScreenId" uuid NOT NULL,
        "CreativeId" uuid,
        "OwnerContentId" uuid,
        "PlayedAt" timestamp with time zone NOT NULL,
        "SessionDate" timestamp with time zone NOT NULL,
        "DeviceId" text NOT NULL,
        "SlotPosition" integer,
        "IsVerified" boolean NOT NULL,
        "ImpressionId" text,
        "ClientTimestamp" timestamp with time zone,
        "VerificationHash" text,
        "PlayerVersion" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_Impressions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Impressions_Bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES "Bookings" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_Impressions_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Impressions_Creatives_CreativeId" FOREIGN KEY ("CreativeId") REFERENCES "Creatives" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_Impressions_OwnerContents_OwnerContentId" FOREIGN KEY ("OwnerContentId") REFERENCES "OwnerContents" ("Id") ON DELETE SET NULL,
        CONSTRAINT "FK_Impressions_Screens_ScreenId" FOREIGN KEY ("ScreenId") REFERENCES "Screens" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Bookings_CampaignId" ON "Bookings" ("CampaignId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Bookings_CreativeId" ON "Bookings" ("CreativeId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Bookings_ScreenId" ON "Bookings" ("ScreenId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Campaigns_AdvertiserId" ON "Campaigns" ("AdvertiserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Creatives_CampaignId" ON "Creatives" ("CampaignId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE UNIQUE INDEX "IX_EmailVerificationTokens_Token" ON "EmailVerificationTokens" ("Token");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_EmailVerificationTokens_UserId" ON "EmailVerificationTokens" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Impressions_Booking_SessionDate" ON "Impressions" ("BookingId", "SessionDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Impressions_Campaign_PlayedAt" ON "Impressions" ("CampaignId", "PlayedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Impressions_CreativeId" ON "Impressions" ("CreativeId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Impressions_OwnerContentId" ON "Impressions" ("OwnerContentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Impressions_Screen_PlayedAt" ON "Impressions" ("ScreenId", "PlayedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Memberships_OrganizationId" ON "Memberships" ("OrganizationId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE UNIQUE INDEX "IX_Memberships_UserId_OrganizationId" ON "Memberships" ("UserId", "OrganizationId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Organizations_OwnerId" ON "Organizations" ("OwnerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE UNIQUE INDEX "IX_OwnerContents_ScreenId_SlotNumber" ON "OwnerContents" ("ScreenId", "SlotNumber") WHERE "IsDeleted" = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE UNIQUE INDEX "IX_PasswordResetTokens_Token" ON "PasswordResetTokens" ("Token");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_PasswordResetTokens_UserId" ON "PasswordResetTokens" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_PhoneVerificationOtps_PhoneNumber_CreatedAt" ON "PhoneVerificationOtps" ("PhoneNumber", "CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_PhoneVerificationOtps_UserId" ON "PhoneVerificationOtps" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE UNIQUE INDEX "IX_RefreshTokens_Token" ON "RefreshTokens" ("Token");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_RefreshTokens_UserId" ON "RefreshTokens" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Screens_DeviceId" ON "Screens" ("DeviceId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE INDEX "IX_Screens_OwnerId" ON "Screens" ("OwnerId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE UNIQUE INDEX "IX_SlotAvailabilities_ScreenId_Date" ON "SlotAvailabilities" ("ScreenId", "Date");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260110125221_InitialPostgres') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260110125221_InitialPostgres', '8.0.0');
    END IF;
END $EF$;
COMMIT;

