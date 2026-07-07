using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class NotificationPreference : BaseEntity
{
    public Guid UserId { get; set; }
    public NotificationType NotificationType { get; set; }
    public bool InAppEnabled { get; set; } = true;
    public bool EmailEnabled { get; set; } = false;
    public virtual User User { get; set; } = null!;
}