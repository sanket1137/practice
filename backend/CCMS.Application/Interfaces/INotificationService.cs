using CCMS.Domain.Enums;

namespace CCMS.Application.Interfaces;

public interface INotificationService
{
    Task CreateNotificationAsync(
        Guid userId,
        string title,
        string message,
        NotificationType type,
        string? actionUrl = null,
        Guid? referenceId = null,
        string? referenceType = null);

    Task<int> GetUnreadCountAsync(Guid userId);

    Task<(List<NotificationDto> Items, int TotalCount)> GetNotificationsPagedAsync(
        Guid userId,
        int page = 1,
        int pageSize = 20);

    Task MarkAsReadAsync(Guid notificationId, Guid userId);

    Task MarkAllAsReadAsync(Guid userId);

    Task CreateAdminNotificationsAsync(
        string title,
        string message,
        NotificationType type,
        string? actionUrl = null,
        Guid? referenceId = null,
        string? referenceType = null);

    /// <summary>
    /// Push a realtime event to everyone watching a campaign (the SignalR
    /// campaign_{id} group) — e.g. CampaignStatusChanged. No-op in hosts
    /// without a hub (Functions).
    /// </summary>
    Task BroadcastCampaignEventAsync(Guid campaignId, string eventName, object payload);
}

public class NotificationDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public string? ActionUrl { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }
    public DateTime CreatedAt { get; set; }
}
