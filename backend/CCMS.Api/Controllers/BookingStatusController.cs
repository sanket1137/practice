using CCMS.Application.Services;
using CCMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CCMS.Api.Controllers;

[Authorize(Roles = "Admin,ScreenOwner")]
[ApiController]
[Route("api/[controller]")]
public class BookingStatusController : ControllerBase
{
    private readonly BookingStatusUpdateService _bookingStatusService;
    private readonly ILogger<BookingStatusController> _logger;

    public BookingStatusController(
        BookingStatusUpdateService bookingStatusService,
        ILogger<BookingStatusController> logger)
    {
        _bookingStatusService = bookingStatusService;
        _logger = logger;
    }

    /// <summary>
    /// Manually trigger booking status updates (Admin/ScreenOwner only)
    /// </summary>
    [HttpPost("update-all")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateAllBookingStatuses()
    {
        try
        {
            _logger.LogInformation("Manual booking status update triggered by user {UserId}", User.Identity?.Name);
            var updatedCount = await _bookingStatusService.UpdateBookingStatusesAsync();
            
            return Ok(ApiResponse<object>.SuccessResponse(
                new { UpdatedCount = updatedCount, Timestamp = DateTime.Now },
                $"Successfully updated {updatedCount} booking(s)"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during manual booking status update");
            return StatusCode(500, ApiResponse<object>.ErrorResponse($"Error: {ex.Message}"));
        }
    }
}
