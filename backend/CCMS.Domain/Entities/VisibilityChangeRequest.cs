using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class VisibilityChangeRequest : BaseEntity
{
    public Guid UserId { get; set; }
    public ScreenVisibility RequestedVisibility { get; set; }
    public VisibilityRequestStatus Status { get; set; } = VisibilityRequestStatus.Pending;
    public string? RequestMessage { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    // Admin review fields
    public Guid? AdminReviewedByUserId { get; set; }
    public DateTime? AdminReviewedAt { get; set; }
    public string? RejectionReason { get; set; }

    // Navigation properties
    public virtual User User { get; set; } = null!;
    public virtual User? AdminReviewedByUser { get; set; }
}
