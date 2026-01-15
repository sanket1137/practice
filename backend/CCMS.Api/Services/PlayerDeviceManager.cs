using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using CCMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Services;

/// <summary>
/// Manages device binding for player authentication.
/// Each player is bound to a specific device fingerprint.
/// Supports manual override by screen owners for device replacement.
/// </summary>
public class PlayerDeviceManager
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PlayerDeviceManager> _logger;
    
    // Cache of pending device override approvals (screenId -> override request)
    private static readonly ConcurrentDictionary<Guid, DeviceOverrideRequest> _pendingOverrides = new();
    
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

        // Fingerprint doesn't match - check for pending override
        if (_pendingOverrides.TryGetValue(screenId, out var overrideRequest))
        {
            // Check if override is still valid (allow any new device during override window)
            if (overrideRequest.ExpiresAt > DateTime.UtcNow)
            {
                // Apply the override - bind to the new device
                screen.PreviousDeviceFingerprintHash = screen.DeviceFingerprintHash;
                screen.DeviceFingerprintHash = fingerprintHash;
                screen.DeviceBoundAt = DateTime.UtcNow;
                screen.LastDeviceVerification = DateTime.UtcNow;
                screen.DeviceOverrideReason = overrideRequest.Reason;
                screen.DeviceOverrideAt = DateTime.UtcNow;
                screen.DeviceOverrideByUserId = overrideRequest.RequestedByUserId;
                
                await _context.SaveChangesAsync();
                _pendingOverrides.TryRemove(screenId, out _);

                _logger.LogWarning(
                    "Device override applied for screen {ScreenId} by user {UserId}. Reason: {Reason}",
                    screenId, overrideRequest.RequestedByUserId, overrideRequest.Reason);

                return new DeviceValidationResult
                {
                    IsValid = true,
                    IsOverride = true,
                    Reason = "Device override applied"
                };
            }
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
    /// Request a device override (called by screen owner)
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

        var overrideRequest = new DeviceOverrideRequest
        {
            ScreenId = screenId,
            RequestedByUserId = requestedByUserId,
            Reason = reason,
            OldFingerprintHash = screen.DeviceFingerprintHash,
            RequestedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(OVERRIDE_REQUEST_TTL_MINUTES)
        };

        _pendingOverrides[screenId] = overrideRequest;

        _logger.LogInformation(
            "Device override requested for screen {ScreenId} by user {UserId}. Valid until {ExpiresAt}",
            screenId, requestedByUserId, overrideRequest.ExpiresAt);

        return new DeviceOverrideResult
        {
            Success = true,
            Reason = $"Device override approved. New device can connect within {OVERRIDE_REQUEST_TTL_MINUTES} minutes.",
            ExpiresAt = overrideRequest.ExpiresAt
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

        await _context.SaveChangesAsync();
        _pendingOverrides.TryRemove(screenId, out _);

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

        var hasPendingOverride = _pendingOverrides.TryGetValue(screenId, out var pendingOverride)
            && pendingOverride.ExpiresAt > DateTime.UtcNow;

        return new DeviceBindingStatus
        {
            ScreenId = screenId,
            IsBound = !string.IsNullOrEmpty(screen.DeviceFingerprintHash),
            BoundAt = screen.DeviceBoundAt,
            LastVerification = screen.LastDeviceVerification,
            HasPendingOverride = hasPendingOverride,
            PendingOverrideExpiresAt = hasPendingOverride ? pendingOverride!.ExpiresAt : null
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

public class DeviceOverrideRequest
{
    public Guid ScreenId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? OldFingerprintHash { get; set; }
    public string? NewFingerprintHash { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
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
