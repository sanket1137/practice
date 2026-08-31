using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Hubs;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using System.Security.Claims;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/stats")]
public class StatsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<StatsController> _logger;

    public StatsController(
        ApplicationDbContext context,
        ILogger<StatsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("screen/{screenId}/today")]
    public async Task<ActionResult<ApiResponse<ScreenStatsDto>>> GetScreenStatsToday(Guid screenId)
    {
        try
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);

            var baseQuery = _context.Impressions
                .Where(i => i.ScreenId == screenId && i.CreatedAt >= today && i.CreatedAt < tomorrow);

            // Scope by who is asking. The screen owner (and admins) see everything
            // played on their screen; an advertiser landing here via "Watch live"
            // sees only plays belonging to THEIR campaigns — screen-wide totals are
            // the owner's business, and showing them to an advertiser both leaks
            // data and reads as a play-count mismatch against their campaign page.
            var scope = "all";
            List<Guid> myCampaignIds = new();

            var isOwnerOrAdmin = User.IsInRole("Admin");
            if (!isOwnerOrAdmin &&
                Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            {
                isOwnerOrAdmin = await _context.Screens
                    .AsNoTracking()
                    .AnyAsync(s => s.Id == screenId && s.OwnerId == userId);

                if (!isOwnerOrAdmin)
                {
                    scope = "mine";
                    myCampaignIds = await _context.Campaigns
                        .AsNoTracking()
                        .Where(c => c.AdvertiserId == userId)
                        .Select(c => c.Id)
                        .ToListAsync();
                    baseQuery = baseQuery.Where(i =>
                        i.CampaignId.HasValue && myCampaignIds.Contains(i.CampaignId.Value));
                }
            }

            var dbCount = await baseQuery.CountAsync();

            // PendingPlays is always 0 now: the hub-side in-memory impression
            // buffer was removed (plays persist solely via /player/sync). The
            // field is kept so existing dashboard clients keep deserializing.
            var response = new ScreenStatsDto
            {
                ScreenId = screenId,
                TotalPlaysToday = dbCount,
                SavedPlays = dbCount,
                PendingPlays = 0,
                LastUpdated = DateTime.UtcNow,
                Scope = scope,
                MyCampaignIds = scope == "mine" ? myCampaignIds : null
            };

            return Ok(ApiResponse<ScreenStatsDto>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get stats for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<ScreenStatsDto>.ErrorResponse("Failed to get screen stats."));
        }
    }

    [HttpGet("campaign/{campaignId}/today")]
    public async Task<ActionResult<ApiResponse<CampaignStatsDto>>> GetCampaignStatsToday(Guid campaignId)
    {
        try
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);
            var dbCount = await _context.Impressions
                .Where(i => i.CampaignId == campaignId && i.CreatedAt >= today && i.CreatedAt < tomorrow)
                .CountAsync();
            
            var response = new CampaignStatsDto
            {
                CampaignId = campaignId,
                TotalPlaysToday = dbCount,
                SavedPlays = dbCount,
                PendingPlays = 0,
                LastUpdated = DateTime.UtcNow
            };
            
            return Ok(ApiResponse<CampaignStatsDto>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get stats for campaign {CampaignId}", campaignId);
            return StatusCode(500, ApiResponse<CampaignStatsDto>.ErrorResponse("Failed to get campaign stats."));
        }
    }

    [HttpGet("buffer-metrics")]
    public ActionResult<ApiResponse<BufferMetricsDto>> GetBufferMetrics()
    {
        // The in-memory impression buffer no longer exists; endpoint retained
        // for dashboard compatibility and always reports zero.
        var metrics = new BufferMetricsDto
        {
            PendingImpressions = 0,
            LastChecked = DateTime.UtcNow
        };

        return Ok(ApiResponse<BufferMetricsDto>.SuccessResponse(metrics));
    }
}

public class ScreenStatsDto
{
    public Guid ScreenId { get; set; }
    public int TotalPlaysToday { get; set; }
    public int SavedPlays { get; set; }
    public int PendingPlays { get; set; }
    public DateTime LastUpdated { get; set; }

    /// <summary>"all" for the screen owner/admin, "mine" for an advertiser
    /// (counts restricted to their own campaigns' plays on this screen).</summary>
    public string Scope { get; set; } = "all";

    /// <summary>When Scope is "mine": the requesting advertiser's campaign ids,
    /// so live widgets can filter real-time events to the same scope.</summary>
    public List<Guid>? MyCampaignIds { get; set; }
}

public class CampaignStatsDto
{
    public Guid CampaignId { get; set; }
    public int TotalPlaysToday { get; set; }
    public int SavedPlays { get; set; }
    public int PendingPlays { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class BufferMetricsDto
{
    public int PendingImpressions { get; set; }
    public DateTime LastChecked { get; set; }
}
