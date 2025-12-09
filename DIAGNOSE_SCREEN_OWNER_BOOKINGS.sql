-- =====================================================
-- DIAGNOSTIC QUERIES FOR SCREEN OWNER BOOKINGS
-- =====================================================

-- 1. Find the screen owner user
SELECT 
    Id as UserId,
    Email,
    FirstName,
    LastName,
    Role
FROM Users
WHERE Email LIKE '%vellore%' OR FirstName LIKE '%Karthik%' OR LastName LIKE '%Vellore%';

-- Note the UserId from above and use it in the queries below
-- Replace 'YOUR-USER-ID-HERE' with the actual UserId

DECLARE @ScreenOwnerId UNIQUEIDENTIFIER;

-- Set this to your Karthik Vellore user ID
-- Example: SET @ScreenOwnerId = '12345678-1234-1234-1234-123456789012';
SELECT @ScreenOwnerId = Id FROM Users WHERE Email LIKE '%vellore%' OR FirstName LIKE '%Karthik%';

PRINT '=== Screen Owner Details ===';
SELECT 
    Id,
    Email,
    FirstName + ' ' + LastName as FullName,
    Role
FROM Users
WHERE Id = @ScreenOwnerId;

PRINT '=== Screens Owned by This User ===';
SELECT 
    Id as ScreenId,
    Name as ScreenName,
    OwnerId,
    Status,
    IsOnline
FROM Screens
WHERE OwnerId = @ScreenOwnerId AND IsDeleted = 0;

PRINT '=== Bookings for This Owner''s Screens ===';
SELECT 
    b.Id as BookingId,
    s.Name as ScreenName,
    c.Name as CampaignName,
    cr.Name as CreativeName,
    b.Status,
    b.StartDate,
    b.EndDate,
    b.TotalPrice,
    b.CreatedAt
FROM Bookings b
INNER JOIN Screens s ON b.ScreenId = s.Id
INNER JOIN Campaigns c ON b.CampaignId = c.Id
LEFT JOIN Creatives cr ON b.CreativeId = cr.Id
WHERE s.OwnerId = @ScreenOwnerId 
  AND b.IsDeleted = 0
  AND s.IsDeleted = 0;

PRINT '=== All Screens in Database ===';
SELECT 
    Id as ScreenId,
    Name as ScreenName,
    OwnerId,
    (SELECT Email FROM Users WHERE Id = Screens.OwnerId) as OwnerEmail,
    Status
FROM Screens
WHERE IsDeleted = 0;

PRINT '=== All Bookings in Database ===';
SELECT 
    b.Id as BookingId,
    s.Name as ScreenName,
    s.OwnerId as ScreenOwnerId,
    (SELECT Email FROM Users WHERE Id = s.OwnerId) as OwnerEmail,
    c.Name as CampaignName,
    b.Status,
    b.CreatedAt
FROM Bookings b
INNER JOIN Screens s ON b.ScreenId = s.Id
INNER JOIN Campaigns c ON b.CampaignId = c.Id
WHERE b.IsDeleted = 0
ORDER BY b.CreatedAt DESC;

-- =====================================================
-- ANALYSIS
-- =====================================================
-- If "Screens Owned by This User" returns 0 rows:
--    → The user has no screens
--    → Therefore, no bookings can exist for their screens
--    → SOLUTION: Create screens for this user
--
-- If screens exist but "Bookings for This Owner's Screens" returns 0 rows:
--    → The screens have no bookings created yet
--    → SOLUTION: Create bookings for these screens
--
-- Check "All Bookings in Database" to see which owners have bookings
-- =====================================================
