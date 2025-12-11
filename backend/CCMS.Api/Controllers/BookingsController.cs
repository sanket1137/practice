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

    public BookingsController(IMediator mediator, BookingCalculationService calculationService)
    {
        _mediator = mediator;
        _calculationService = calculationService;
    }

    [HttpGet]
    public async Task<IActionResult> GetBookings()
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

            var result = await _mediator.Send(query);
            return Ok(CCMS.Shared.Common.ApiResponse<IEnumerable<BookingDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<IEnumerable<BookingDto>>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
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
