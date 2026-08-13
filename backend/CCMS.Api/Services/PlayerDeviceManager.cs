using System.Security.Cryptography;
using System.Text;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Services;

/// <summary>
/// Manages device binding for player authentication.
/// Each player is bound to a specific device fingerprint.
/// Supports manual override by screen owners for device replacement.
/// 
/// Override requests are persisted to the DeviceOverrideHistories table
/// so they survive backend restarts (no in-memory state).
/// </summary>
public class PlayerDeviceManager
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PlayerDeviceManager> _logger;
    
    // TTL for pending override requests
    private const int OVERRIDE_REQUEST_TTL_MINUTES = 30;

    public PlayerDeviceManager(
        ApplicationDbContext context,
        ILogger<PlayerDeviceManager> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Validate device fingerprint for a player
    /// </summary>
    public async Task<DeviceValidationResult> ValidateDeviceFingerprintAsync(
        Guid screenId,
        string deviceFingerprint)
    {
        var screen = await _context.Screens.FindAsync(screenId);
        if (screen == null)
        {
            return new DeviceValidationResult
            {
                IsValid = false,
                Reason = "Screen not found"
            };
        }

        // Hash the fingerprint for comparison
        var fingerprintHash = HashFingerprint(deviceFingerprint);

        // If no device is bound yet, this is first registration
        if (string.IsNullOrEmpty(screen.DeviceFingerprintHash))
        {
            _logger.LogInformation(
                "First device registration for screen {ScreenId}. Binding device fingerprint.",
                screenId);

            screen.DeviceFingerprintHash = fingerprintHash;
            screen.DeviceBoundAt = DateTime.UtcNow;
            screen.LastDeviceVerification = DateTime.UtcNow;

            // Record first binding in audit trail
            _context.DeviceOverrideHistories.Add(new DeviceOverrideHistory
            {
                ScreenId = screenId,
                Action = "First_Binding",
                Reason = "Initial device registration",
                NewFingerprintHash = fingerprintHash,
                RequestedByUserId = screen.OwnerId,
                IsPending = false
            });

            await _context.SaveChangesAsync();

            return new DeviceValidationResult
            {
                IsValid = true,
                IsNewBinding = true,
                Reason = "Device bound successfully"
            };
        }

        // Check if fingerprint matches
        if (screen.DeviceFingerprintHash == fingerprintHash)
        {
            screen.LastDeviceVerification = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new DeviceValidationResult
            {
                IsValid = true,
                Reason = "Device verified"
            };
        }

        // Fingerprint doesn't match - check for pending override in DB
        var pendingOverride = await _context.DeviceOverrideHistories
            .Where(h => h.ScreenId == screenId
                     && h.IsPending
                     && h.Action == "Override_Requested"
                     && h.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(h => h.CreatedAt)
            .FirstOrDefaultAsync();

        if (pendingOverride != null)
        {
            // Apply the override - bind to the new device
            var oldHash = screen.DeviceFingerprintHash;
            screen.PreviousDeviceFingerprintHash = oldHash;
            screen.DeviceFingerprintHash = fingerprintHash;
            screen.DeviceBoundAt = DateTime.UtcNow;
            screen.LastDeviceVerification = DateTime.UtcNow;
            screen.DeviceOverrideReason = pendingOverride.Reason;
            screen.DeviceOverrideAt = DateTime.UtcNow;
            screen.DeviceOverrideByUserId = pendingOverride.RequestedByUserId;

            // Device changed — require re-verification
            if (screen.VerificationStatus == ScreenVerificationStatus.Verified)
            {
                screen.VerificationStatus = ScreenVerificationStatus.ReVerificationRequired;
                _logger.LogWarning(
                    "Screen {ScreenId} set to ReVerificationRequired due to device override",
                    screenId);
            }
            
            // Mark the override request as consumed
            pendingOverride.IsPending = false;
            pendingOverride.NewFingerprintHash = fingerprintHash;
            pendingOverride.UpdatedAt = DateTime.UtcNow;

            // Record the applied override in audit trail
            _context.DeviceOverrideHistories.Add(new DeviceOverrideHistory
            {
                ScreenId = screenId,
                Action = "Override_Applied",
                Reason = pendingOverride.Reason,
                OldFingerprintHash = oldHash,
                NewFingerprintHash = fingerprintHash,
                RequestedByUserId = pendingOverride.RequestedByUserId,
                IsPending = false
            });

            await _context.SaveChangesAsync();

            _logger.LogWarning(
                "Device override applied for screen {ScreenId} by user {UserId}. Reason: {Reason}",
                screenId, pendingOverride.RequestedByUserId, pendingOverride.Reason);

            return new DeviceValidationResult
            {
                IsValid = true,
                IsOverride = true,
                Reason = "Device override applied"
            };
        }

        // Device mismatch - potential security issue
        _logger.LogWarning(
            "Device fingerprint mismatch for screen {ScreenId}. " +
            "Expected hash: {Expected}, Got hash: {Actual}",
            screenId, 
            screen.DeviceFingerprintHash[..8] + "...", 
            fingerprintHash[..8] + "...");

        return new DeviceValidationResult
        {
            IsValid = false,
            IsMismatch = true,
            Reason = "Device fingerprint does not match registered device. Contact screen owner for device override."
        };
    }

    /// <summary>
    /// Request a device override (called by screen owner).
    /// Creates a DB-persisted override window so it survives restarts.
    /// </summary>
    public async Task<DeviceOverrideResult> RequestDeviceOverrideAsync(
        Guid screenId,
        Guid requestedByUserId,
        string reason)
    {
        // Verify the user is the screen owner
        var screen = await _context.Screens.FindAsync(screenId);
        if (screen == null)
        {
            return new DeviceOverrideResult
            {
                Success = false,
                Reason = "Screen not found"
            };
        }

        if (screen.OwnerId != requestedByUserId)
        {
            // Check if user is admin
            var user = await _context.Users.FindAsync(requestedByUserId);
            if (user == null || user.Role != CCMS.Domain.Enums.UserRole.Admin)
            {
                _logger.LogWarning(
                    "Unauthorized device override attempt for screen {ScreenId} by user {UserId}",
                    screenId, requestedByUserId);

                return new DeviceOverrideResult
                {
                    Success = false,
                    Reason = "Only the screen owner or admin can request device override"
                };
            }
        }

        // Expire any existing pending overrides for this screen
        var existingPending = await _context.DeviceOverrideHistories
            .Where(h => h.ScreenId == screenId && h.IsPending)
            .ToListAsync();

        foreach (var pending in existingPending)
        {
            pending.IsPending = false;
            pending.UpdatedAt = DateTime.UtcNow;
        }

        var expiresAt = DateTime.UtcNow.AddMinutes(OVERRIDE_REQUEST_TTL_MINUTES);

        // Create new override request in DB
        _context.DeviceOverrideHistories.Add(new DeviceOverrideHistory
        {
            ScreenId = screenId,
            Action = "Override_Requested",
            Reason = reason,
            OldFingerprintHash = screen.DeviceFingerprintHash,
            RequestedByUserId = requestedByUserId,
            ExpiresAt = expiresAt,
            IsPending = true
        });

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Device override requested for screen {ScreenId} by user {UserId}. Valid until {ExpiresAt}",
            screenId, requestedByUserId, expiresAt);

        return new DeviceOverrideResult
        {
            Success = true,
            Reason = $"Device override approved. New device can connect within {OVERRIDE_REQUEST_TTL_MINUTES} minutes.",
            ExpiresAt = expiresAt
        };
    }

    /// <summary>
    /// Clear device binding (for complete reset by admin)
    /// </summary>
    public async Task<bool> ClearDeviceBindingAsync(Guid screenId, Guid requestedByUserId)
    {
        var screen = await _context.Screens.FindAsync(screenId);
        if (screen == null) return false;

        // Only admin can clear binding completely
        var user = await _context.Users.FindAsync(requestedByUserId);
        if (user == null || user.Role != CCMS.Domain.Enums.UserRole.Admin)
        {
            _logger.LogWarning(
                "Unauthorized device binding clear attempt for screen {ScreenId} by user {UserId}",
                screenId, requestedByUserId);
            return false;
        }

        var oldHash = screen.DeviceFingerprintHash;
        screen.DeviceFingerprintHash = null;
        screen.PreviousDeviceFingerprintHash = oldHash;
        screen.DeviceBoundAt = null;
        screen.DeviceOverrideReason = "Binding cleared by admin";
        screen.DeviceOverrideAt = DateTime.UtcNow;
        screen.DeviceOverrideByUserId = requestedByUserId;

        // Expire any pending overrides
        var pendingOverrides = await _context.DeviceOverrideHistories
            .Where(h => h.ScreenId == screenId && h.IsPending)
            .ToListAsync();

        foreach (var pending in pendingOverrides)
        {
            pending.IsPending = false;
            pending.UpdatedAt = DateTime.UtcNow;
        }

        // Record clear in audit trail
        _context.DeviceOverrideHistories.Add(new DeviceOverrideHistory
        {
            ScreenId = screenId,
            Action = "Binding_Cleared",
            Reason = "Binding cleared by admin",
            OldFingerprintHash = oldHash,
            RequestedByUserId = requestedByUserId,
            IsPending = false
        });

        await _context.SaveChangesAsync();

        _logger.LogWarning(
            "Device binding cleared for screen {ScreenId} by admin {UserId}",
            screenId, requestedByUserId);

        return true;
    }

    /// <summary>
    /// Get device binding status for a screen
    /// </summary>
    public async Task<DeviceBindingStatus?> GetDeviceBindingStatusAsync(Guid screenId)
    {
        var screen = await _context.Screens.FindAsync(screenId);
        if (screen == null) return null;

        // Check DB for pending override instead of in-memory dictionary
        var pendingOverride = await _context.DeviceOverrideHistories
            .AsNoTracking()
            .Where(h => h.ScreenId == screenId
                     && h.IsPending
                     && h.Action == "Override_Requested"
                     && h.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(h => h.CreatedAt)
            .FirstOrDefaultAsync();

        return new DeviceBindingStatus
        {
            ScreenId = screenId,
            IsBound = !string.IsNullOrEmpty(screen.DeviceFingerprintHash),
            BoundAt = screen.DeviceBoundAt,
            LastVerification = screen.LastDeviceVerification,
            HasPendingOverride = pendingOverride != null,
            PendingOverrideExpiresAt = pendingOverride?.ExpiresAt
        };
    }

    /// <summary>
    /// Generate a device fingerprint hash (to match server-side)
    /// Called by player during handshake
    /// </summary>
    public static string GenerateFingerprint(
        string cpuSerial,
        string diskSerial,
        string macAddress,
        string hostname)
    {
        var rawFingerprint = $"{cpuSerial}|{diskSerial}|{macAddress}|{hostname}".ToUpperInvariant();
        return HashFingerprint(rawFingerprint);
    }

    private static string HashFingerprint(string fingerprint)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(fingerprint));
        return Convert.ToBase64String(bytes);
    }
}

#region DTOs

public class DeviceValidationResult
{
    public bool IsValid { get; set; }
    public bool IsNewBinding { get; set; }
    public bool IsOverride { get; set; }
    public bool IsMismatch { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class DeviceOverrideResult
{
    public bool Success { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime? ExpiresAt { get; set; }
}

public class DeviceBindingStatus
{
    public Guid ScreenId { get; set; }
    public bool IsBound { get; set; }
    public DateTime? BoundAt { get; set; }
    public DateTime? LastVerification { get; set; }
    public bool HasPendingOverride { get; set; }
    public DateTime? PendingOverrideExpiresAt { get; set; }
}

#endregion
