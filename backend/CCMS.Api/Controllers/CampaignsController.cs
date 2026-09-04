using System.Security.Claims;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Features.Campaigns.Commands;
using CCMS.Application.Features.Campaigns.Queries;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Campaigns;
using CCMS.Shared.DTOs.Bookings;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class CampaignsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly CCMS.Infrastructure.Data.ApplicationDbContext _context;
    private readonly ILogger<CampaignsController> _logger;

    public CampaignsController(
        IMediator mediator,
        CCMS.Infrastructure.Data.ApplicationDbContext context,
        ILogger<CampaignsController> logger)
    {
        _mediator = mediator;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// The Command Center feed: everything the campaign monitor renders in one
    /// call — derived status + sub-state, delivery vs target, per-day pacing,
    /// and per-screen rows scoped to THIS campaign's plays (never the screen's
    /// global numbers). Advertiser-owned or admin.
    /// </summary>
    [HttpGet("{id}/monitor")]
    public async Task<ActionResult<ApiResponse<object>>> GetMonitor(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");

            var campaign = await _context.Campaigns
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
            if (campaign == null)
                return NotFound(ApiResponse<object>.ErrorResponse("Campaign not found"));
            if (!isAdmin && campaign.AdvertiserId != userId)
                return Forbid();

            var bookings = await _context.Bookings
                .Where(b => b.CampaignId == id && !b.IsDeleted)
                .Include(b => b.Screen)
                .AsNoTracking()
                .ToListAsync();

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var todayUtc = DateTime.UtcNow.Date;

            // Window + expectations
            var start = bookings.Count > 0 ? bookings.Min(b => b.StartDate) : today;
            var end = bookings.Count > 0 ? bookings.Max(b => b.EndDate) : today;
            var expectedTotal = bookings.Sum(b => b.ExpectedImpressions);
            var spend = bookings
                .Where(b => b.Status != Domain.Enums.BookingStatus.Cancelled
                         && b.Status != Domain.Enums.BookingStatus.Rejected)
                .Sum(b => b.TotalPrice);

            // Delivered — per booking and per day, campaign-scoped
            var impressions = await _context.Impressions
                .Where(i => i.CampaignId == id)
                .Select(i => new { i.BookingId, i.ScreenId, i.PlayedAt })
                .ToListAsync();

            var deliveredTotal = impressions.Count;
            var deliveredToday = impressions.Count(i => i.PlayedAt >= todayUtc);
            var deliveryPct = expectedTotal > 0
                ? Math.Round(Math.Min(100m, deliveredTotal * 100m / expectedTotal), 1) : 0m;

            // Pacing: cumulative delivered per day vs a straight-line target
            var totalDays = Math.Max(1, end.DayNumber - start.DayNumber + 1);
            var elapsedDays = Math.Clamp(today.DayNumber - start.DayNumber + 1, 0, totalDays);
            var byDay = impressions
                .GroupBy(i => DateOnly.FromDateTime(i.PlayedAt))
                .ToDictionary(g => g.Key, g => g.Count());
            var pacing = new List<object>();
            var cumulative = 0;
            for (var d = start; d <= end && d <= today; d = d.AddDays(1))
            {
                cumulative += byDay.GetValueOrDefault(d);
                var dayIndex = d.DayNumber - start.DayNumber + 1;
                pacing.Add(new
                {
                    date = d.ToString("yyyy-MM-dd"),
                    delivered = byDay.GetValueOrDefault(d),
                    deliveredCum = cumulative,
                    targetCum = (int)Math.Round((decimal)expectedTotal * dayIndex / totalDays),
                });
            }

            // Per-screen rows — this campaign's plays only
            var playsByBooking = impressions.Where(i => i.BookingId.HasValue)
                .GroupBy(i => i.BookingId!.Value)
                .ToDictionary(g => g.Key, g => new
                {
                    total = g.Count(),
                    todayCount = g.Count(i => i.PlayedAt >= todayUtc),
                    last = g.Max(i => i.PlayedAt),
                });
            var screens = bookings.Select(b =>
            {
                playsByBooking.TryGetValue(b.Id, out var p);
                return new
                {
                    bookingId = b.Id,
                    bookingStatus = b.Status.ToString(),
                    screenId = b.ScreenId,
                    screenName = b.Screen?.Name ?? "Screen",
                    city = b.Screen?.Location?.City,
                    isOnline = b.Screen?.IsOnline ?? false,
                    startDate = b.StartDate.ToString("yyyy-MM-dd"),
                    endDate = b.EndDate.ToString("yyyy-MM-dd"),
                    expected = b.ExpectedImpressions,
                    plays = p?.total ?? 0,
                    playsToday = p?.todayCount ?? 0,
                    deliveryPct = b.ExpectedImpressions > 0
                        ? Math.Round(Math.Min(100m, (p?.total ?? 0) * 100m / b.ExpectedImpressions), 1) : 0m,
                    lastPlayAt = p?.last,
                };
            }).ToList();

            // Sub-state mirrors the sweep's derivation
            string subState =
                bookings.Any(b => b.Status == Domain.Enums.BookingStatus.Active) ? "live"
                : bookings.Any(b => b.Status == Domain.Enums.BookingStatus.Approved) ? "scheduled"
                : bookings.Any(b => b.Status == Domain.Enums.BookingStatus.Pending) ? "awaiting-approval"
                : bookings.Any(b => b.Status == Domain.Enums.BookingStatus.Completed) ? "completed"
                : bookings.Count == 0 ? "draft" : "cancelled";

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                campaignId = campaign.Id,
                name = campaign.Name,
                status = campaign.Status.ToString(),
                subState,
                currency = bookings.FirstOrDefault()?.Currency ?? "INR",
                startDate = start.ToString("yyyy-MM-dd"),
                endDate = end.ToString("yyyy-MM-dd"),
                totalDays,
                elapsedDays,
                spend,
                expectedTotal,
                deliveredTotal,
                deliveredToday,
                deliveryPct,
                cpm = deliveredTotal > 0 ? Math.Round(spend * 1000m / deliveredTotal, 0) : (decimal?)null,
                pacing,
                screens,
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error building campaign monitor for {CampaignId}", id);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to load campaign monitor."));
        }
    }

    // GET /api/campaigns
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<CampaignDto>>>> GetAll()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var query = new GetCampaignsQuery { UserId = User.IsInRole("Admin") ? Guid.Empty : userId };
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<IEnumerable<CampaignDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving campaigns");
            return StatusCode(500,
                ApiResponse<IEnumerable<CampaignDto>>.ErrorResponse("Failed to retrieve campaigns."));
        }
    }

    /// <summary>
    /// Gets a paginated list of campaigns with optional filtering and sorting.
    /// </summary>
    /// <param name="search">Optional search term for campaign name.</param>
    /// <param name="status">Optional filter by campaign status (Draft, Active, Paused, Completed).</param>
    /// <param name="page">Page number (1-based). Defaults to 1.</param>
    /// <param name="pageSize">Number of items per page. Defaults to 10.</param>
    /// <param name="sortBy">Sort field (Name, CreatedAt, StartDate, EndDate). Defaults to CreatedAt.</param>
    /// <param name="sortDirection">Sort direction (asc or desc). Defaults to desc.</param>
    [HttpGet("paged")]
    public async Task<ActionResult<ApiResponse<PagedResult<CampaignDto>>>> GetPaged(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string sortBy = "CreatedAt",
        [FromQuery] string sortDirection = "desc")
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var query = new GetCampaignsPagedQuery
            {
                UserId = User.IsInRole("Admin") ? Guid.Empty : userId,
                PageNumber = page,
                PageSize = pageSize,
                SearchTerm = search,
                Status = status,
                SortBy = sortBy,
                SortDirection = sortDirection
            };
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<PagedResult<CampaignDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving paged campaigns");
            return StatusCode(500,
                ApiResponse<PagedResult<CampaignDto>>.ErrorResponse("Failed to retrieve campaigns."));
        }
    }

    // POST /api/campaigns
    [HttpPost]
    [Authorize(Roles = "Advertiser,ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<CampaignDto>>> Create([FromBody] CreateCampaignRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new CreateCampaignCommand { UserId = userId, Request = request };
            var result = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetById), new { id = result.Id },
                ApiResponse<CampaignDto>.SuccessResponse(result, "Campaign created successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating campaign");
            return StatusCode(500,
                ApiResponse<CampaignDto>.ErrorResponse("Failed to create campaign."));
        }
    }

    // GET /api/campaigns/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CampaignDto>>> GetById(Guid id)
    {
        try
        {
            var query = new GetCampaignByIdQuery { CampaignId = id };
            var result = await _mediator.Send(query);
            
            if (result == null)
                return NotFound(ApiResponse<CampaignDto>.ErrorResponse("Campaign not found"));
            
            return Ok(ApiResponse<CampaignDto>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving campaign {CampaignId}", id);
            return StatusCode(500,
                ApiResponse<CampaignDto>.ErrorResponse("Failed to retrieve campaign."));
        }
    }

    // PUT /api/campaigns/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Advertiser,ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<CampaignDto>>> Update(Guid id, [FromBody] UpdateCampaignRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");
            var command = new UpdateCampaignCommand 
            { 
                CampaignId = id, 
                UserId = userId, 
                IsAdmin = isAdmin,
                Request = request 
            };
            var result = await _mediator.Send(command);
            return Ok(ApiResponse<CampaignDto>.SuccessResponse(result, "Campaign updated successfully"));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<CampaignDto>.ErrorResponse("Campaign not found"));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating campaign {CampaignId}", id);
            return StatusCode(500,
                ApiResponse<CampaignDto>.ErrorResponse("Failed to update campaign."));
        }
    }

    // DELETE /api/campaigns/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Advertiser,ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var isAdmin = User.IsInRole("Admin");
            var command = new DeleteCampaignCommand 
            { 
                CampaignId = id, 
                UserId = userId,
                IsAdmin = isAdmin
            };
            await _mediator.Send(command);
            return Ok(ApiResponse<object>.SuccessResponse(null, "Campaign deleted successfully"));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.ErrorResponse("Campaign not found"));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting campaign {CampaignId}", id);
            return StatusCode(500,
                ApiResponse<object>.ErrorResponse("Failed to delete campaign."));
        }
    }

    // GET /api/campaigns/{id}/bookings
    [HttpGet("{id}/bookings")]
    public async Task<ActionResult<ApiResponse<IEnumerable<BookingDto>>>> GetCampaignBookings(Guid id)
    {
        try
        {
            var query = new Application.Features.Bookings.Queries.GetBookingsQuery 
            { 
                CampaignId = id 
            };
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<IEnumerable<BookingDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving bookings for campaign {CampaignId}", id);
            return StatusCode(500,
                ApiResponse<IEnumerable<BookingDto>>.ErrorResponse("Failed to retrieve campaign bookings."));
        }
    }

    // GET /api/campaigns/{id}/screens/stats
    [HttpGet("{id}/screens/stats")]
    public async Task<ActionResult<ApiResponse<CampaignScreensStatsDto>>> GetCampaignScreensStats(Guid id)
    {
        try
        {
            var query = new GetCampaignScreensStatsQuery { CampaignId = id };
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<CampaignScreensStatsDto>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving campaign screen stats for {CampaignId}", id);
            return StatusCode(500,
                ApiResponse<CampaignScreensStatsDto>.ErrorResponse("Failed to retrieve campaign screen stats."));
        }
    }

    /// <summary>
    /// Atomically create a campaign, create bookings, and deduct wallet balance in a single DB transaction.
    /// Either everything succeeds or everything is rolled back.
    /// </summary>
    [HttpPost("wizard")]
    public async Task<ActionResult<ApiResponse<CampaignWizardResult>>> CreateWizard([FromBody] CampaignWizardRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _mediator.Send(new CreateCampaignWizardCommand
            {
                UserId = userId,
                Request = request,
            });
            return Ok(ApiResponse<CampaignWizardResult>.SuccessResponse(result, "Campaign created successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<CampaignWizardResult>.ErrorResponse(ex.Message));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<CampaignWizardResult>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating campaign via wizard");
            return StatusCode(500, ApiResponse<CampaignWizardResult>.ErrorResponse("Failed to create campaign."));
        }
    }
}
