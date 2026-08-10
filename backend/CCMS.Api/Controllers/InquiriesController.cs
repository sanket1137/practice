using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Shared.Common;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[AllowAnonymous]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/inquiries")]
public class InquiriesController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<InquiriesController> _logger;

    public InquiriesController(
        INotificationService notificationService,
        ILogger<InquiriesController> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> SubmitInquiry([FromBody] SubmitInquiryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Phone) ||
            string.IsNullOrWhiteSpace(request.InquiryType))
        {
            return BadRequest(ApiResponse<object>.ErrorResponse("Name, Email, Phone and Inquiry Type are required."));
        }

        var title = $"New Lead: {request.InquiryType}";
        var message = $"Name: {request.Name}\nEmail: {request.Email}\nPhone: {request.Phone}\nMessage: {request.Message}";

        // Send notification to all administrators
        await _notificationService.CreateAdminNotificationsAsync(
            title,
            message,
            NotificationType.SystemAlert,
            "/notifications" // Action URL points to notifications panel
        );

        _logger.LogInformation("Guest lead inquiry submitted: {InquiryType} from {Name} ({Email})", 
            request.InquiryType, request.Name, request.Email);

        return Ok(ApiResponse<object>.SuccessResponse(new { success = true }));
    }
}

public class SubmitInquiryRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string InquiryType { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
