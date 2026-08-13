-- Test Screen Setup SQL Script
-- Run this in your SQL Server Management Studio or database tool

-- Step 1: Get the ScreenOwner user ID
DECLARE @UserId UNIQUEIDENTIFIER;
SELECT TOP 1 @UserId = Id FROM Users WHERE Email = 'sanketdhole109@gmail.com';

-- If user doesn't exist, create one
IF @UserId IS NULL
BEGIN
    SET @UserId = NEWID();
    INSERT INTO Users (Id, Email, PasswordHash, FirstName, LastName, Role, IsActive, IsDeleted, CreatedAt, UpdatedAt)
    VALUES (
        @UserId,
        'sanketdhole109@gmail.com',
        '$2a$11$YourHashedPasswordHere', -- Replace with actual BCrypt hash
        'Sanket',
        'Dhole',
        'ScreenOwner',
        1,
        0,
        GETUTCDATE(),
        GETUTCDATE()
    );
    PRINT 'Created user: ' + CAST(@UserId AS VARCHAR(50));
END
ELSE
BEGIN
    PRINT 'Using existing user: ' + CAST(@UserId AS VARCHAR(50));
END

-- Step 2: Create Test Screen
DECLARE @ScreenId UNIQUEIDENTIFIER = NEWID();
DECLARE @DeviceId VARCHAR(100) = 'RPI-TEST-' + CAST(NEWID() AS VARCHAR(36));

INSERT INTO Screens (
    Id, Name, DeviceId, OwnerId,
    Location_Street, Location_City, Location_State, Location_Country, Location_PostalCode,
    Resolution, Orientation, ScreenType,
    Schedule_Monday_IsOpen, Schedule_Monday_OpenTime, Schedule_Monday_CloseTime,
    Schedule_Tuesday_IsOpen, Schedule_Tuesday_OpenTime, Schedule_Tuesday_CloseTime,
    Schedule_Wednesday_IsOpen, Schedule_Wednesday_OpenTime, Schedule_Wednesday_CloseTime,
    Schedule_Thursday_IsOpen, Schedule_Thursday_OpenTime, Schedule_Thursday_CloseTime,
    Schedule_Friday_IsOpen, Schedule_Friday_OpenTime, Schedule_Friday_CloseTime,
    Schedule_Saturday_IsOpen, Schedule_Saturday_OpenTime, Schedule_Saturday_CloseTime,
    Schedule_Sunday_IsOpen, Schedule_Sunday_OpenTime, Schedule_Sunday_CloseTime,
    SlotsPerFrame, TimeFrameMinutes, PricePerSlot,
    IsOnline, IsDeleted, CreatedAt, UpdatedAt
)
VALUES (
    @ScreenId,
    'Test Screen 24/7',
    @DeviceId,
    @UserId,
    'Test Street 123',
    'Test City',
    'Test State',
    'Test Country',
    '12345',
    '1920x1080',
    'Landscape',
    'Indoor',
    1, '00:00:00', '23:59:00',  -- Monday
    1, '00:00:00', '23:59:00',  -- Tuesday
    1, '00:00:00', '23:59:00',  -- Wednesday
    1, '00:00:00', '23:59:00',  -- Thursday
    1, '00:00:00', '23:59:00',  -- Friday
    1, '00:00:00', '23:59:00',  -- Saturday
    1, '00:00:00', '23:59:00',  -- Sunday
    6,                           -- SlotsPerFrame
    1,                           -- TimeFrameMinutes
    100.00,                      -- PricePerSlot
    0,                           -- IsOnline
    0,                           -- IsDeleted
    GETUTCDATE(),
    GETUTCDATE()
);

-- Step 3: Output Screen Details
SELECT 
    'Screen Created Successfully!' AS Message,
    @ScreenId AS ScreenId,
    @DeviceId AS DeviceId,
    'Test Screen 24/7' AS ScreenName,
    @UserId AS OwnerId;

-- Step 4: Show player configuration
PRINT '';
PRINT '=== PLAYER CONFIGURATION ===';
PRINT 'Update player/config.json with:';
PRINT '{';
PRINT '  "screen_id": "' + CAST(@ScreenId AS VARCHAR(50)) + '",';
PRINT '  "device_id": "' + @DeviceId + '",';
PRINT '  "api_key": "test-api-key-12345",';
PRINT '  "server_url": "http://localhost:5257",';
PRINT '  "sync_interval_minutes": 10';
PRINT '}';
