using CCMS.Application.Interfaces;
using CCMS.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Services;

/// <summary>
/// No-op INotificationService for hosts that have no SignalR/notification
/// infrastructure (the CCMS.Functions serverless jobs). Domain services like
/// BookingStatusUpdateService can depend on notifications unconditionally;
/// in the API host they reach users, here they become log lines. Read paths
/// return empty results rather than throwing so shared code stays branch-free.
/// </summary>
public class NullNotificationService : INotificationService
{
    private readonly ILogger<NullNotificationService> _logger;

    public NullNotificationService(ILogger<NullNotificationService> logger)
    {
        _logger = logger;
    }

    public Task CreateNotificationAsync(
        Guid userId, string title, string message, NotificationType type,
        string? actionUrl = null, Guid? referenceId = null, string? referenceType = null)
    {
        _logger.LogInformation("[Notification suppressed in this host] {Type} to {UserId}: {Title}",
            type, userId, title);
        return Task.CompletedTask;
    }

    public Task CreateAdminNotificationsAsync(
        string title, string message, NotificationType type,
        string? actionUrl = null, Guid? referenceId = null, string? referenceType = null)
    {
        _logger.LogInformation("[Admin notification suppressed in this host] {Type}: {Title}", type, title);
        return Task.CompletedTask;
    }

    public Task BroadcastCampaignEventAsync(Guid campaignId, string eventName, object payload)
    {
        _logger.LogDebug("[Campaign broadcast suppressed in this host] {Event} for {CampaignId}", eventName, campaignId);
        return Task.CompletedTask;
    }

    public Task<int> GetUnreadCountAsync(Guid userId) => Task.FromResult(0);

    public Task<(List<NotificationDto> Items, int TotalCount)> GetNotificationsPagedAsync(
        Guid userId, int page = 1, int pageSize = 20)
        => Task.FromResult((new List<NotificationDto>(), 0));

    public Task MarkAsReadAsync(Guid notificationId, Guid userId) => Task.CompletedTask;

    public Task MarkAllAsReadAsync(Guid userId) => Task.CompletedTask;
}
