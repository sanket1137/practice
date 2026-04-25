using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

/// <summary>
/// Audit row for every remote command issued from dashboard to a player.
/// Also acts as the delivery state machine: Pending → Sent → Acked / Failed / Expired.
/// </summary>
public class RemoteCommand : BaseEntity
{
    public Guid ScreenId { get; set; }
    public Guid IssuedByUserId { get; set; }

    public RemoteCommandType CommandType { get; set; }

    /// <summary>JSON-serialized payload (volume level, announcement text, etc.).</summary>
    public string? PayloadJson { get; set; }

    public RemoteCommandStatus Status { get; set; } = RemoteCommandStatus.Pending;

    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DispatchedAt { get; set; }
    public DateTime? AckedAt { get; set; }

    public string? ErrorMessage { get; set; }

    // Navigation
    public virtual Screen Screen { get; set; } = null!;
    public virtual User IssuedByUser { get; set; } = null!;
}
