using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Features.Bookings.Commands;
using CCMS.Application.Features.Bookings.Queries;
using CCMS.Application.Services;
using CCMS.Shared.DTOs.Bookings;
using System.Security.Claims;

namespace CCMS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly BookingCalculationService _calculationService;
    private readonly ILogger<BookingsController> _logger;

    public BookingsController(IMediator mediator, BookingCalculationService calculationService, ILogger<BookingsController> logger)
    {
        _mediator = mediator;
        _calculationService = calculationService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetBookings([FromQuery] Guid? screenId = null)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);
            var isScreenOwner = User.IsInRole("ScreenOwner");
            var isAdvertiser = User.IsInRole("Advertiser");

            var query = new GetBookingsQuery();

            // Screen owners see bookings for their screens
            if (isScreenOwner)
            {
                query.ScreenOwnerId = userGuid;
            }
            // Advertisers see bookings for their campaigns
            else if (isAdvertiser)
            {
                query.UserId = userGuid;
            }
            // Admins see all bookings (no filter)

            // Apply screen filter if specified (for screen details page)
            if (screenId.HasValue)
            {
                query.ScreenId = screenId.Value;
            }

            var result = await _mediator.Send(query);
            return Ok(CCMS.Shared.Common.ApiResponse<IEnumerable<BookingDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<IEnumerable<BookingDto>>.ErrorResponse(ex.Message));
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBookingById(Guid id)
    {
        try
        {
            var query = new GetBookingsQuery { BookingId = id };
            var result = await _mediator.Send(query);
            var booking = result.FirstOrDefault();
            
            if (booking == null)
                return NotFound(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse("Booking not found"));
            
            return Ok(CCMS.Shared.Common.ApiResponse<BookingDto>.SuccessResponse(booking));
        }
        catch (Exception ex)
        {
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        try
        {
            // DIAGNOSTIC: Log incoming request to verify ScreenId
            Console.WriteLine($"[DIAGNOSTIC CREATE] ScreenId: {request.ScreenId.ToString().Substring(0, 8)}, " +
                            $"CampaignId: {request.CampaignId.ToString().Substring(0, 8)}, " +
                            $"StartDate: {request.StartDate:yyyy-MM-dd}");

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var command = new CreateBookingCommand
            {
                UserId = Guid.Parse(userId),
                Request = request
            };

            var result = await _mediator.Send(command);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating booking");
            return StatusCode(500, new { message = $"Error creating booking: {ex.Message}", innerException = ex.InnerException?.Message });
        }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveBooking(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var command = new ApproveBookingCommand(id, Guid.Parse(userId));
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectBooking(Guid id, [FromBody] RejectBookingRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var command = new RejectBookingCommand(id, Guid.Parse(userId), request.Reason);
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpGet("availability-check")]
    public async Task<IActionResult> CheckBookingAvailability(
        [FromQuery] Guid screenId,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate,
        [FromQuery] int slotNumber,
        CancellationToken cancellationToken)
    {
        try
        {
            var breakdown = await _calculationService.GetDateBreakdown(
                screenId,
                slotNumber,
                startDate,
                endDate,
                cancellationToken);

            return Ok(CCMS.Shared.Common.ApiResponse<BookingDateBreakdown>.SuccessResponse(breakdown));
        }
        catch (Exception ex)
        {
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<BookingDateBreakdown>.ErrorResponse(ex.Message));
        }
    }
}
