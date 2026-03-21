using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using System.Security.Claims;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
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
}
