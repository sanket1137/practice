using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using System.Security.Claims;
using Asp.Versioning;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly ApplicationDbContext _context;

    public NotificationsController(INotificationService notificationService, ApplicationDbContext context)
    {
        _notificationService = notificationService;
        _context = context;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Get paginated notifications for the current user
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetUserId();
        var (items, totalCount) = await _notificationService.GetNotificationsPagedAsync(userId, page, pageSize);
        return Ok(ApiResponse<object>.SuccessResponse(new { items, totalCount, page, pageSize }));
    }

    /// <summary>
    /// Get unread notification count for badge display
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(ApiResponse<int>.SuccessResponse(count));
    }

    /// <summary>
    /// Mark a single notification as read
    /// </summary>
    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = GetUserId();
        await _notificationService.MarkAsReadAsync(id, userId);
        return Ok(ApiResponse<string>.SuccessResponse("Notification marked as read"));
    }

    /// <summary>
    /// Mark all notifications as read
    /// </summary>
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetUserId();
        await _notificationService.MarkAllAsReadAsync(userId);
        return Ok(ApiResponse<string>.SuccessResponse("All notifications marked as read"));
    }

    /// <summary>
    /// Get notification preferences for the current user.
    /// Returns defaults (all InApp enabled) for types not yet customised.
    /// </summary>
    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
        var userId = GetUserId();
        var saved = await _context.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToListAsync();

        var all = Enum.GetValues<NotificationType>()
            .Select(type =>
            {
                var pref = saved.FirstOrDefault(p => p.NotificationType == type);
                return new
                {
                    notificationType = (int)type,
                    name = type.ToString(),
                    inAppEnabled = pref?.InAppEnabled ?? true,
                    emailEnabled = pref?.EmailEnabled ?? false,
                };
            })
            .ToList();

        return Ok(ApiResponse<object>.SuccessResponse(all));
    }

    /// <summary>
    /// Upsert notification preferences for the current user.
    /// </summary>
    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] List<NotificationPreferenceUpdateRequest> updates)
    {
        var userId = GetUserId();

        foreach (var update in updates)
        {
            var existing = await _context.NotificationPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId && p.NotificationType == update.NotificationType);

            if (existing == null)
            {
                _context.NotificationPreferences.Add(new NotificationPreference
                {
                    UserId = userId,
                    NotificationType = update.NotificationType,
                    InAppEnabled = update.InAppEnabled,
                    EmailEnabled = update.EmailEnabled,
                });
            }
            else
            {
                existing.InAppEnabled = update.InAppEnabled;
                existing.EmailEnabled = update.EmailEnabled;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<string>.SuccessResponse("Preferences updated"));
    }
}

public class NotificationPreferenceUpdateRequest
{
    public NotificationType NotificationType { get; set; }
    public bool InAppEnabled { get; set; }
    public bool EmailEnabled { get; set; }
}
