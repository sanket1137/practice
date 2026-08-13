using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

/// <summary>
/// Tracks a screen verification attempt: QR scan + video submission + admin review.
/// Each row represents one verification cycle for a screen.
/// </summary>
public class ScreenVerification : BaseEntity
{
    public Guid ScreenId { get; set; }
    public Guid RequestedByUserId { get; set; }

    /// <summary>
    /// The QR challenge code that was displayed on screen at time of scan.
    /// </summary>
    public string QrChallengeCode { get; set; } = string.Empty;

    /// <summary>
    /// R2 storage URL for the 30-60s verification video.
    /// Path pattern: verification-videos/{screenId}/{verificationId}.mp4
    /// </summary>
    public string? VideoUrl { get; set; }

    /// <summary>
    /// SHA256 hash of the player device fingerprint at submission time.
    /// </summary>
    public string? DeviceFingerprintHash { get; set; }

    /// <summary>
    /// Player type: "RaspberryPi", "Android", "ChromeOS"
    /// </summary>
    public string? DeviceType { get; set; }

    /// <summary>
    /// GPS coordinates from the phone that scanned the QR code.
    /// Used to validate proximity to the screen's registered location.
    /// </summary>
    public decimal? ScanGpsLatitude { get; set; }
    public decimal? ScanGpsLongitude { get; set; }

    /// <summary>
    /// IP address of the player device at QR generation time.
    /// </summary>
    public string? PlayerIpAddress { get; set; }

    public ScreenVerificationStatus Status { get; set; } = ScreenVerificationStatus.PendingReview;

    // Admin review fields
    public Guid? AdminReviewedByUserId { get; set; }
    public DateTime? AdminReviewedAt { get; set; }
    public string? RejectionReason { get; set; }

    // Navigation properties
    public virtual Screen Screen { get; set; } = null!;
    public virtual User RequestedByUser { get; set; } = null!;
    public virtual User? AdminReviewedByUser { get; set; }
}
