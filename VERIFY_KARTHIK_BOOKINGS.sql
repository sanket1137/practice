-- =====================================================
-- VERIFY KARTHIK'S BOOKINGS
-- =====================================================

DECLARE @KarthikUserId UNIQUEIDENTIFIER = '8D99A0E6-2866-4406-9B40-8ED1611E6EF7';

PRINT '=== 1. Karthik User Details ===';
SELECT 
    Id,
    Email,
    FirstName + ' ' + LastName as FullName,
    Role,
    CASE Role
        WHEN 0 THEN 'Admin'
        WHEN 1 THEN 'ScreenOwner'
        WHEN 2 THEN 'Advertiser'
    END as RoleName
FROM Users
WHERE Id = @KarthikUserId;

PRINT '';
PRINT '=== 2. Screens Owned by Karthik ===';
SELECT 
    Id as ScreenId,
    Name as ScreenName,
    OwnerId,
    Status,
    PricePerSlot,
    Currency
FROM Screens
WHERE OwnerId = @KarthikUserId 
  AND IsDeleted = 0;

PRINT '';
PRINT '=== 3. Bookings for Karthik''s Screens (Expected Result) ===';
SELECT 
    b.Id as BookingId,
    s.Id as ScreenId,
    s.Name as ScreenName,
    s.OwnerId as ScreenOwnerId,
    c.Name as CampaignName,
    cr.Name as CreativeName,
    b.Status,
    b.StartDate,
    b.EndDate,
    b.TotalPrice,
    b.Currency,
    b.ExpectedImpressions,
    b.CreatedAt
FROM Bookings b
INNER JOIN Screens s ON b.ScreenId = s.Id
INNER JOIN Campaigns c ON b.CampaignId = c.Id
LEFT JOIN Creatives cr ON b.CreativeId = cr.Id
WHERE s.OwnerId = @KarthikUserId 
  AND b.IsDeleted = 0
  AND s.IsDeleted = 0
ORDER BY b.CreatedAt DESC;

PRINT '';
PRINT '=== 4. All Bookings in System ===';
SELECT 
    b.Id as BookingId,
    s.Name as ScreenName,
    s.OwnerId,
    (SELECT Email FROM Users WHERE Id = s.OwnerId) as OwnerEmail,
    c.Name as CampaignName,
    b.Status,
    b.TotalPrice,
    b.CreatedAt
FROM Bookings b
INNER JOIN Screens s ON b.ScreenId = s.Id
INNER JOIN Campaigns c ON b.CampaignId = c.Id
WHERE b.IsDeleted = 0
ORDER BY b.CreatedAt DESC;

-- =====================================================
-- EXPECTED RESULT
-- =====================================================
-- Karthik should see bookings where:
--   Booking.ScreenId IN (03E586DA-4039-46EB-A08F-5421BE85E0B8, D284C01D-DC89-4885-9FAD-0ABD4570A44B)
--
-- Based on your earlier data, there are 2 bookings for Screen 1
-- So Karthik should see 2 bookings!
-- =====================================================
