using CCMS.Api.Hubs;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace CCMS.Api.Services;

public class NotificationService : INotificationService
{
    private readonly IRepository<Notification> _notificationRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly IHubContext<PlaybackHub> _playbackHub;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IRepository<Notification> notificationRepository,
        IRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        IHubContext<NotificationHub> hubContext,
        IHubContext<PlaybackHub> playbackHub,
        ILogger<NotificationService> logger)
    {
        _notificationRepository = notificationRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _hubContext = hubContext;
        _playbackHub = playbackHub;
        _logger = logger;
    }

    public async Task BroadcastCampaignEventAsync(Guid campaignId, string eventName, object payload)
    {
        try
        {
            await _playbackHub.Clients.Group($"campaign_{campaignId}").SendAsync(eventName, payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Campaign broadcast {Event} failed for {CampaignId}", eventName, campaignId);
        }
    }

    public async Task CreateNotificationAsync(
        Guid userId,
        string title,
        string message,
        NotificationType type,
        string? actionUrl = null,
        Guid? referenceId = null,
        string? referenceType = null)
    {
        var notification = new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            ActionUrl = actionUrl,
            ReferenceId = referenceId,
            ReferenceType = referenceType,
        };

        await _notificationRepository.AddAsync(notification);
        await _unitOfWork.SaveChangesAsync();

        // Push real-time via SignalR to the specific user
        var dto = MapToDto(notification);
        await _hubContext.Clients.User(userId.ToString())
            .SendAsync("NotificationReceived", dto);

        _logger.LogInformation("[Notification] Sent {Type} notification to user {UserId}: {Title}",
            type, userId.ToString()[..8], title);
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        // Counted in the database — this runs on every dashboard poll for
        // every user; materializing the whole Notifications table for it
        // scaled with total platform traffic, not with this user's data.
        return await _notificationRepository.CountAsync(n => n.UserId == userId && !n.IsRead);
    }

    public async Task<(List<NotificationDto> Items, int TotalCount)> GetNotificationsPagedAsync(
        Guid userId,
        int page = 1,
        int pageSize = 20)
    {
        // Filtered to this user in the database; ordering/paging the user's own
        // rows in memory is bounded and fine.
        var mine = await _notificationRepository.FindAsync(n => n.UserId == userId);
        var query = mine
            .OrderByDescending(n => n.CreatedAt);

        var totalCount = query.Count();

        var items = query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToDto)
            .ToList();

        return (items, totalCount);
    }

    public async Task MarkAsReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await _notificationRepository.GetByIdAsync(notificationId);
        if (notification == null || notification.UserId != userId)
            return;

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await _notificationRepository.UpdateAsync(notification);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task MarkAllAsReadAsync(Guid userId)
    {
        var unread = (await _notificationRepository.FindAsync(n => n.UserId == userId && !n.IsRead)).ToList();

        foreach (var notification in unread)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _notificationRepository.UpdateAsync(notification);
        }

        if (unread.Count > 0)
            await _unitOfWork.SaveChangesAsync();
    }

    private static NotificationDto MapToDto(Notification n) => new()
    {
        Id = n.Id,
        Title = n.Title,
        Message = n.Message,
        Type = n.Type.ToString(),
        IsRead = n.IsRead,
        ReadAt = n.ReadAt,
        ActionUrl = n.ActionUrl,
        ReferenceId = n.ReferenceId,
        ReferenceType = n.ReferenceType,
        CreatedAt = n.CreatedAt,
    };

    public async Task CreateAdminNotificationsAsync(
        string title,
        string message,
        NotificationType type,
        string? actionUrl = null,
        Guid? referenceId = null,
        string? referenceType = null)
    {
        var allUsers = await _userRepository.GetAllAsync();
        var admins = allUsers.Where(u => u.Role == UserRole.Admin && !u.IsDeleted).ToList();

        foreach (var admin in admins)
        {
            await CreateNotificationAsync(admin.Id, title, message, type, actionUrl, referenceId, referenceType);
        }

        _logger.LogInformation("[Notification] Sent {Type} admin notification to {Count} admins: {Title}",
            type, admins.Count, title);
    }
}
