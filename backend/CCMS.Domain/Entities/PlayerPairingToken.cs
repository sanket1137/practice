namespace CCMS.Domain.Entities;

/// <summary>
/// A player-initiated pairing token. The player (ChromeOS / Android) requests
/// this on first launch, encodes it in a QR code, and polls for completion.
/// A dashboard user scans the QR, fills in the screen details, and claims it.
/// Valid for 30 minutes. Anonymous — no user session required on the player side.
/// </summary>
public class PlayerPairingToken : BaseEntity
{
    /// <summary>Unique 32-char URL-safe token the player puts in the QR.</summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>SHA-256 hash of the device fingerprint reported by the player.</summary>
    public string DeviceFingerprintHash { get; set; } = string.Empty;

    public string? DeviceModel { get; set; }
    public string? OsVersion { get; set; }
    public string? AppVersion { get; set; }

    public DateTime ExpiresAt { get; set; }

    // ── Set after dashboard user claims ──
    public DateTime? ClaimedAt { get; set; }
    public Guid? ClaimedByUserId { get; set; }

    /// <summary>Created once the claim is processed.</summary>
    public Guid? ScreenId { get; set; }

    /// <summary>Raw API key returned once to the player after claim.</summary>
    public string? ApiKey { get; set; }

    public virtual User? ClaimedByUser { get; set; }
    public virtual Screen? Screen { get; set; }
}
