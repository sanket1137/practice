using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;

namespace CCMS.Api.Services;

/// <summary>
/// Handles QR challenge generation, scan validation, GPS distance checks,
/// and verification lifecycle management.
/// </summary>
public class ScreenVerificationService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ScreenVerificationService> _logger;

    private const int QR_CHALLENGE_TTL_MINUTES = 5;
    private const double MAX_GPS_DISTANCE_METERS = 500;

    public ScreenVerificationService(
        ApplicationDbContext context,
        ILogger<ScreenVerificationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Generate a new QR challenge code for a screen.
    /// Called by the player every 5 minutes.
    /// </summary>
    public async Task<(string Code, DateTime ExpiresAt)> GenerateQrChallengeAsync(Guid screenId)
    {
        var screen = await _context.Screens.FindAsync(screenId);
        if (screen == null)
            throw new InvalidOperationException($"Screen {screenId} not found");

        var code = Guid.NewGuid().ToString("N");
        var expiresAt = DateTime.UtcNow.AddMinutes(QR_CHALLENGE_TTL_MINUTES);

        screen.ActiveQrChallengeCode = code;
        screen.QrChallengeExpiresAt = expiresAt;
        screen.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogDebug("Generated QR challenge for screen {ScreenId}, expires {ExpiresAt}", screenId, expiresAt);
        return (code, expiresAt);
    }

    /// <summary>
    /// Validate a QR scan from the owner's phone.
    /// Checks: code match, not expired, GPS proximity, ownership.
    /// </summary>
    public async Task<(bool Success, string? Error, ScreenVerification? Verification)> ValidateScanAsync(
        Guid screenId, Guid userId, string challengeCode, decimal gpsLat, decimal gpsLng)
    {
        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId && !s.IsDeleted)
            .Select(s => new
            {
                s.Id, s.OwnerId, s.ActiveQrChallengeCode, s.QrChallengeExpiresAt,
                s.Latitude, s.Longitude, s.DeviceFingerprintHash, s.Name
            })
            .FirstOrDefaultAsync();

        if (screen == null)
            return (false, "Screen not found", null);

        if (screen.OwnerId != userId)
            return (false, "You are not the owner of this screen", null);

        if (string.IsNullOrEmpty(screen.ActiveQrChallengeCode))
            return (false, "No QR challenge is currently active. Ensure the player is running.", null);

        if (screen.ActiveQrChallengeCode != challengeCode)
            return (false, "Invalid QR code. Please scan the QR currently displayed on screen.", null);

        if (screen.QrChallengeExpiresAt.HasValue && DateTime.UtcNow > screen.QrChallengeExpiresAt.Value)
            return (false, "QR code has expired. A new QR will appear on screen shortly.", null);

        // Validate GPS proximity
        var distance = CalculateHaversineDistance(
            (double)screen.Latitude, (double)screen.Longitude,
            (double)gpsLat, (double)gpsLng);

        if (distance > MAX_GPS_DISTANCE_METERS)
            return (false, $"You must be within {MAX_GPS_DISTANCE_METERS}m of the screen. Current distance: {distance:F0}m", null);

        // Invalidate the QR code (single-use)
        var screenEntity = await _context.Screens.FindAsync(screenId);
        if (screenEntity == null)
            return (false, "Screen not found", null);

        screenEntity.ActiveQrChallengeCode = null;
        screenEntity.QrChallengeExpiresAt = null;

        // Create the verification record
        var verification = new ScreenVerification
        {
            ScreenId = screenId,
            RequestedByUserId = userId,
            QrChallengeCode = challengeCode,
            ScanGpsLatitude = gpsLat,
            ScanGpsLongitude = gpsLng,
            DeviceFingerprintHash = screen.DeviceFingerprintHash,
            Status = ScreenVerificationStatus.PendingReview
        };

        _context.ScreenVerifications.Add(verification);
        screenEntity.LastVerificationId = verification.Id;

        await _context.SaveChangesAsync();

        _logger.LogInformation("QR scan validated for screen {ScreenId} by user {UserId}, distance {Distance}m",
            screenId, userId, distance);

        return (true, null, verification);
    }

    /// <summary>
    /// Mark a screen verification as approved by admin.
    /// Sets screen VerificationStatus to Verified.
    /// </summary>
    public async Task<(bool Success, string? Error)> ApproveVerificationAsync(Guid verificationId, Guid adminUserId)
    {
        var verification = await _context.ScreenVerifications
            .Include(v => v.Screen)
            .FirstOrDefaultAsync(v => v.Id == verificationId);

        if (verification == null)
            return (false, "Verification not found");

        if (verification.Status != ScreenVerificationStatus.PendingReview)
            return (false, $"Verification is already {verification.Status}");

        verification.Status = ScreenVerificationStatus.Verified;
        verification.AdminReviewedByUserId = adminUserId;
        verification.AdminReviewedAt = DateTime.UtcNow;
        verification.UpdatedAt = DateTime.UtcNow;

        verification.Screen.VerificationStatus = ScreenVerificationStatus.Verified;
        verification.Screen.VerifiedAt = DateTime.UtcNow;
        verification.Screen.VerifiedByAdminUserId = adminUserId;
        verification.Screen.LastVerificationId = verificationId;
        verification.Screen.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Screen {ScreenId} verification {VerificationId} approved by admin {AdminId}",
            verification.ScreenId, verificationId, adminUserId);

        return (true, null);
    }

    /// <summary>
    /// Mark a screen verification as rejected by admin.
    /// Sets screen VerificationStatus to Rejected.
    /// </summary>
    public async Task<(bool Success, string? Error)> RejectVerificationAsync(
        Guid verificationId, Guid adminUserId, string reason)
    {
        var verification = await _context.ScreenVerifications
            .Include(v => v.Screen)
            .FirstOrDefaultAsync(v => v.Id == verificationId);

        if (verification == null)
            return (false, "Verification not found");

        if (verification.Status != ScreenVerificationStatus.PendingReview)
            return (false, $"Verification is already {verification.Status}");

        verification.Status = ScreenVerificationStatus.Rejected;
        verification.AdminReviewedByUserId = adminUserId;
        verification.AdminReviewedAt = DateTime.UtcNow;
        verification.RejectionReason = reason;
        verification.UpdatedAt = DateTime.UtcNow;

        verification.Screen.VerificationStatus = ScreenVerificationStatus.Rejected;
        verification.Screen.LastVerificationId = verificationId;
        verification.Screen.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Screen {ScreenId} verification {VerificationId} rejected by admin {AdminId}: {Reason}",
            verification.ScreenId, verificationId, adminUserId, reason);

        return (true, null);
    }

    /// <summary>
    /// Calculate distance between two GPS coordinates using the Haversine formula.
    /// Returns distance in meters.
    /// </summary>
    public static double CalculateHaversineDistance(
        double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000; // Earth's radius in meters

        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return R * c;
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180;
    }
}
