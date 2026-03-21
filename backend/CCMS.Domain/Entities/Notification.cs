using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    /// <summary>
    /// Frontend route to navigate to when notification is clicked (e.g., "/bookings/abc123")
    /// </summary>
    public string? ActionUrl { get; set; }

    /// <summary>
    /// ID of the related entity (booking, payment, payout, etc.)
    /// </summary>
    public Guid? ReferenceId { get; set; }

    /// <summary>
    /// Type of the related entity (e.g., "Booking", "Payment", "Payout")
    /// </summary>
    public string? ReferenceType { get; set; }

    // Navigation
    public virtual User User { get; set; } = null!;
}
