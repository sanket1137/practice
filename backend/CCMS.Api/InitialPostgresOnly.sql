START TRANSACTION;

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

CREATE INDEX "IX_Bookings_CampaignId" ON "Bookings" ("CampaignId");

CREATE INDEX "IX_Bookings_CreativeId" ON "Bookings" ("CreativeId");

CREATE INDEX "IX_Bookings_ScreenId" ON "Bookings" ("ScreenId");

CREATE INDEX "IX_Campaigns_AdvertiserId" ON "Campaigns" ("AdvertiserId");

CREATE INDEX "IX_Creatives_CampaignId" ON "Creatives" ("CampaignId");

CREATE UNIQUE INDEX "IX_EmailVerificationTokens_Token" ON "EmailVerificationTokens" ("Token");

CREATE INDEX "IX_EmailVerificationTokens_UserId" ON "EmailVerificationTokens" ("UserId");

CREATE INDEX "IX_Impressions_Booking_SessionDate" ON "Impressions" ("BookingId", "SessionDate");

CREATE INDEX "IX_Impressions_Campaign_PlayedAt" ON "Impressions" ("CampaignId", "PlayedAt");

CREATE INDEX "IX_Impressions_CreativeId" ON "Impressions" ("CreativeId");

CREATE INDEX "IX_Impressions_OwnerContentId" ON "Impressions" ("OwnerContentId");

CREATE INDEX "IX_Impressions_Screen_PlayedAt" ON "Impressions" ("ScreenId", "PlayedAt");

CREATE INDEX "IX_Memberships_OrganizationId" ON "Memberships" ("OrganizationId");

CREATE UNIQUE INDEX "IX_Memberships_UserId_OrganizationId" ON "Memberships" ("UserId", "OrganizationId");

CREATE INDEX "IX_Organizations_OwnerId" ON "Organizations" ("OwnerId");

CREATE UNIQUE INDEX "IX_OwnerContents_ScreenId_SlotNumber" ON "OwnerContents" ("ScreenId", "SlotNumber") WHERE "IsDeleted" = false;

CREATE UNIQUE INDEX "IX_PasswordResetTokens_Token" ON "PasswordResetTokens" ("Token");

CREATE INDEX "IX_PasswordResetTokens_UserId" ON "PasswordResetTokens" ("UserId");

CREATE INDEX "IX_PhoneVerificationOtps_PhoneNumber_CreatedAt" ON "PhoneVerificationOtps" ("PhoneNumber", "CreatedAt");

CREATE INDEX "IX_PhoneVerificationOtps_UserId" ON "PhoneVerificationOtps" ("UserId");

CREATE UNIQUE INDEX "IX_RefreshTokens_Token" ON "RefreshTokens" ("Token");

CREATE INDEX "IX_RefreshTokens_UserId" ON "RefreshTokens" ("UserId");

CREATE INDEX "IX_Screens_DeviceId" ON "Screens" ("DeviceId");

CREATE INDEX "IX_Screens_OwnerId" ON "Screens" ("OwnerId");

CREATE UNIQUE INDEX "IX_SlotAvailabilities_ScreenId_Date" ON "SlotAvailabilities" ("ScreenId", "Date");

CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260110125221_InitialPostgres', '8.0.0');

COMMIT;

