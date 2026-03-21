using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Features.Bookings.Commands;
using CCMS.Application.Features.Bookings.Queries;
using CCMS.Application.Features.Screens.Queries;
using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Shared.DTOs.Bookings;
using System.Security.Claims;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly BookingCalculationService _calculationService;
    private readonly IInvoiceService _invoiceService;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly ILogger<BookingsController> _logger;

    public BookingsController(
        IMediator mediator, 
        BookingCalculationService calculationService, 
        IInvoiceService invoiceService,
        IRepository<User> userRepository,
        IRepository<Screen> screenRepository,
        ILogger<BookingsController> logger)
    {
        _mediator = mediator;
        _calculationService = calculationService;
        _invoiceService = invoiceService;
        _userRepository = userRepository;
        _screenRepository = screenRepository;
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

    /// <summary>
    /// Gets a paginated list of bookings with optional filtering and sorting.
    /// </summary>
    /// <param name="screenId">Optional filter by screen ID.</param>
    /// <param name="campaignId">Optional filter by campaign ID.</param>
    /// <param name="status">Optional filter by booking status.</param>
    /// <param name="search">Optional search term for campaign or screen name.</param>
    /// <param name="page">Page number (1-based). Defaults to 1.</param>
    /// <param name="pageSize">Number of items per page. Defaults to 10.</param>
    /// <param name="sortBy">Sort field (CreatedAt, StartDate, EndDate, Status). Defaults to CreatedAt.</param>
    /// <param name="sortDirection">Sort direction (asc or desc). Defaults to desc.</param>
    [HttpGet("paged")]
    public async Task<IActionResult> GetBookingsPaged(
        [FromQuery] Guid? screenId = null,
        [FromQuery] Guid? campaignId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string sortBy = "CreatedAt",
        [FromQuery] string sortDirection = "desc")
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);
            var isScreenOwner = User.IsInRole("ScreenOwner");
            var isAdvertiser = User.IsInRole("Advertiser");

            var query = new GetBookingsPagedQuery
            {
                PageNumber = page,
                PageSize = pageSize,
                Status = status,
                SearchTerm = search,
                SortBy = sortBy,
                SortDirection = sortDirection,
                ScreenId = screenId,
                CampaignId = campaignId
            };

            if (isScreenOwner)
            {
                query.ScreenOwnerId = userGuid;
            }
            else if (isAdvertiser)
            {
                query.UserId = userGuid;
            }

            var result = await _mediator.Send(query);
            return Ok(CCMS.Shared.Common.ApiResponse<CCMS.Shared.Common.PagedResult<BookingDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<CCMS.Shared.Common.PagedResult<BookingDto>>.ErrorResponse(ex.Message));
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBookingById(Guid id)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);
            var isScreenOwner = User.IsInRole("ScreenOwner");
            var isAdvertiser = User.IsInRole("Advertiser");
            var isAdmin = User.IsInRole("Admin");

            var query = new GetBookingsQuery { BookingId = id };
            var result = await _mediator.Send(query);
            var booking = result.FirstOrDefault();
            
            if (booking == null)
                return NotFound(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse("Booking not found"));
            
            // Authorization check - verify user has access to this booking
            bool hasAccess = isAdmin;
            
            // Advertiser can view their own bookings
            if (isAdvertiser && booking.AdvertiserId == userGuid)
                hasAccess = true;
            
            // Screen owner can view bookings for their screens
            if (isScreenOwner)
            {
                var screenQuery = new GetScreensQuery { OwnerId = userGuid };
                var ownedScreens = await _mediator.Send(screenQuery);
                if (ownedScreens.Any(s => s.Id == booking.ScreenId))
                    hasAccess = true;
            }
            
            if (!hasAccess)
                return StatusCode(403, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse("You don't have permission to view this booking"));
            
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
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);
            var isAdmin = User.IsInRole("Admin");
            
            // Get booking to verify ownership
            var bookingQuery = new GetBookingsQuery { BookingId = id };
            var bookings = await _mediator.Send(bookingQuery);
            var booking = bookings.FirstOrDefault();
            
            if (booking == null)
                return NotFound(new { message = "Booking not found" });
            
            // Verify user owns the screen (unless admin)
            if (!isAdmin)
            {
                var screenQuery = new GetScreensQuery { OwnerId = userGuid };
                var ownedScreens = await _mediator.Send(screenQuery);
                
                if (!ownedScreens.Any(s => s.Id == booking.ScreenId))
                    return StatusCode(403, new { message = "You can only approve bookings for screens you own" });
            }
            
            // Date guard: reject approval if booking end date has already passed
            if (DateOnly.TryParse(booking.EndDate, out var endDate) && 
                DateOnly.FromDateTime(DateTime.Today) > endDate)
            {
                return BadRequest(new { message = "Cannot approve a booking whose period has already ended" });
            }

            var command = new ApproveBookingCommand(id, userGuid);
            var result = await _mediator.Send(command);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving booking {BookingId}", id);
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectBooking(Guid id, [FromBody] RejectBookingRequest request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);
            var isAdmin = User.IsInRole("Admin");
            
            // Get booking to verify ownership
            var bookingQuery = new GetBookingsQuery { BookingId = id };
            var bookings = await _mediator.Send(bookingQuery);
            var booking = bookings.FirstOrDefault();
            
            if (booking == null)
                return NotFound(new { message = "Booking not found" });
            
            // Verify user owns the screen (unless admin)
            if (!isAdmin)
            {
                var screenQuery = new GetScreensQuery { OwnerId = userGuid };
                var ownedScreens = await _mediator.Send(screenQuery);
                
                if (!ownedScreens.Any(s => s.Id == booking.ScreenId))
                    return StatusCode(403, new { message = "You can only reject bookings for screens you own" });
            }
            
            var command = new RejectBookingCommand(id, userGuid, request.Reason);
            var result = await _mediator.Send(command);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting booking {BookingId}", id);
            return StatusCode(500, new { message = ex.Message });
        }
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

    /// <summary>
    /// Downloads a PDF invoice for an approved booking.
    /// </summary>
    /// <param name="id">The booking ID.</param>
    /// <returns>PDF file stream.</returns>
    [HttpGet("{id}/invoice")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DownloadInvoice(Guid id)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);
            var isAdmin = User.IsInRole("Admin");

            // Get the booking using existing query pattern
            var query = new GetBookingsQuery { BookingId = id };
            var result = await _mediator.Send(query);
            var booking = result.FirstOrDefault();

            if (booking == null)
                return NotFound(new { message = "Booking not found" });

            // Authorization: Only the advertiser, screen owner, or admin can download the invoice
            if (!isAdmin)
            {
                var isAdvertiser = booking.AdvertiserId == userGuid;
                
                // Check if user is screen owner
                var screen = await _screenRepository.GetByIdAsync(booking.ScreenId);
                var isScreenOwner = screen?.OwnerId == userGuid;

                if (!isAdvertiser && !isScreenOwner)
                    return StatusCode(403, new { message = "You don't have permission to download this invoice" });
            }

            // Only approved bookings can have invoices
            if (!booking.Status.Equals("Approved", StringComparison.OrdinalIgnoreCase) &&
                !booking.Status.Equals("Completed", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Invoices are only available for approved or completed bookings" });
            }

            // Get advertiser details
            var advertiser = booking.AdvertiserId.HasValue
                ? await _userRepository.GetByIdAsync(booking.AdvertiserId.Value)
                : null;
            var advertiserName = advertiser != null
                ? $"{advertiser.FirstName} {advertiser.LastName}".Trim()
                : "Advertiser";
            var advertiserEmail = advertiser?.Email ?? "N/A";

            // Get screen owner details
            var screenForOwner = await _screenRepository.GetByIdAsync(booking.ScreenId);
            var screenOwner = screenForOwner != null 
                ? await _userRepository.GetByIdAsync(screenForOwner.OwnerId)
                : null;
            var screenOwnerName = screenOwner != null
                ? $"{screenOwner.FirstName} {screenOwner.LastName}".Trim()
                : "Screen Owner";

            // Generate the PDF invoice
            var pdfBytes = await _invoiceService.GenerateBookingInvoiceAsync(
                booking,
                advertiserName,
                advertiserEmail,
                screenOwnerName);

            var invoiceNumber = _invoiceService.GenerateInvoiceNumber(booking.Id, booking.CreatedAt);
            var fileName = $"{invoiceNumber}.pdf";

            _logger.LogInformation("Invoice {InvoiceNumber} downloaded by user {UserId}", invoiceNumber, userId);

            return File(pdfBytes, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating invoice for booking {BookingId}", id);
            return StatusCode(500, new { message = "Failed to generate invoice" });
        }
    }

    [HttpPut("{id}/update-dates")]
    public async Task<IActionResult> UpdateBookingDates(Guid id, [FromBody] UpdateBookingDatesRequest request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);

            var command = new UpdateBookingDatesCommand
            {
                BookingId = id,
                UserId = userGuid,
                Request = request
            };
            var result = await _mediator.Send(command);
            return Ok(CCMS.Shared.Common.ApiResponse<BookingDto>.SuccessResponse(result, "Booking dates updated and re-submitted for approval"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating booking dates {BookingId}", id);
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse("Failed to update booking dates"));
        }
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> CancelBooking(Guid id, [FromBody] CancelBookingRequest? request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);

            var command = new CancelBookingCommand(id, userGuid, request?.Reason);
            var result = await _mediator.Send(command);
            return Ok(CCMS.Shared.Common.ApiResponse<BookingDto>.SuccessResponse(result, "Booking cancelled successfully"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling booking {BookingId}", id);
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse("Failed to cancel booking"));
        }
    }

    [HttpPost("self-reserve")]
    [Authorize(Roles = "ScreenOwner")]
    public async Task<IActionResult> SelfReserveSlot([FromBody] SelfReserveSlotRequest request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var command = new SelfReserveSlotCommand { UserId = Guid.Parse(userId), Request = request };
            var result = await _mediator.Send(command);
            return Ok(CCMS.Shared.Common.ApiResponse<BookingDto>.SuccessResponse(result, "Slot self-reserved successfully"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error self-reserving slot");
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<BookingDto>.ErrorResponse("Failed to self-reserve slot"));
        }
    }

    [HttpGet("self-reserved")]
    [Authorize(Roles = "ScreenOwner")]
    public async Task<IActionResult> GetSelfReservedBookings([FromQuery] Guid? screenId = null)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var userGuid = Guid.Parse(userId);

            var query = new GetBookingsQuery
            {
                ScreenOwnerId = userGuid,
                ScreenId = screenId ?? Guid.Empty
            };

            var result = await _mediator.Send(query);
            var selfReserved = result.Where(b => b.Source == BookingSource.SelfReserved.ToString()).ToList();
            return Ok(CCMS.Shared.Common.ApiResponse<List<BookingDto>>.SuccessResponse(selfReserved));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching self-reserved bookings");
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<List<BookingDto>>.ErrorResponse("Failed to fetch self-reserved bookings"));
        }
    }
}
