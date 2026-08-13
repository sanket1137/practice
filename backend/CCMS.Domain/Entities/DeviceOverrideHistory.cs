namespace CCMS.Domain.Entities;

/// <summary>
/// Persistent audit trail for device binding changes.
/// Records every override request, binding, unbinding, and clear operation.
/// Replaces the in-memory ConcurrentDictionary approach for pending overrides.
/// </summary>
public class DeviceOverrideHistory : BaseEntity
{
    /// <summary>
    /// The screen whose device binding was changed.
    /// </summary>
    public Guid ScreenId { get; set; }

    /// <summary>
    /// Type of action: "Override_Requested", "Override_Applied", "Binding_Cleared", "First_Binding", "Binding_Verified"
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable reason for the action.
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// The fingerprint hash before the change (null for first binding).
    /// </summary>
    public string? OldFingerprintHash { get; set; }

    /// <summary>
    /// The fingerprint hash after the change (null for clear operations).
    /// </summary>
    public string? NewFingerprintHash { get; set; }

    /// <summary>
    /// The user who requested or performed the action.
    /// </summary>
    public Guid RequestedByUserId { get; set; }

    /// <summary>
    /// For override requests: when the override window expires.
    /// Null for non-override actions.
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>
    /// Whether this override request is still pending (not yet consumed or expired).
    /// Used to query active override windows without in-memory state.
    /// </summary>
    public bool IsPending { get; set; }

    // Navigation
    public virtual Screen Screen { get; set; } = null!;
    public virtual User RequestedByUser { get; set; } = null!;
}
