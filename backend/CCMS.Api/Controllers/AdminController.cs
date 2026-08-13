using CCMS.Application.Services;
using CCMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class AdminController : ControllerBase
{
    private readonly BookingStatusUpdateService _bookingStatusService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        BookingStatusUpdateService bookingStatusService,
        ILogger<AdminController> logger)
    {
        _bookingStatusService = bookingStatusService;
        _logger = logger;
    }

    // POST /api/admin/update-booking-statuses
    [HttpPost("update-booking-statuses")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateBookingStatuses()
    {
        try
        {
            _logger.LogInformation("Manual booking status update triggered");
            var updatedCount = await _bookingStatusService.UpdateBookingStatusesAsync();
            
            return Ok(ApiResponse<object>.SuccessResponse(
                new { UpdatedCount = updatedCount },
                $"Successfully updated {updatedCount} booking(s)"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during manual booking status update");
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to update booking statuses."));
        }
    }
}
