namespace CCMS.Domain.Entities;

/// <summary>
/// Short-lived (10-minute) code a CMS owner generates in the dashboard.
/// The player on the physical device displays the same code; when the owner
/// types it into the dashboard, a new Screen row is provisioned for that
/// player device.
/// </summary>
public class PairingCode : BaseEntity
{
    /// <summary>6-character alphanumeric code (uppercase, no ambiguous chars).</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>The CmsOwner who requested the code.</summary>
    public Guid CreatedByUserId { get; set; }

    public DateTime ExpiresAt { get; set; }

    // Set when player successfully claims the code
    public DateTime? ClaimedAt { get; set; }
    public Guid? ScreenId { get; set; }

    /// <summary>Fingerprint reported by the claiming player (for audit).</summary>
    public string? PlayerFingerprint { get; set; }

    public virtual User CreatedByUser { get; set; } = null!;
    public virtual Screen? Screen { get; set; }
}
