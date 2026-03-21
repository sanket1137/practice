using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Hubs;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

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
            var dbCount = await _context.Impressions
                .Where(i => i.ScreenId == screenId && i.CreatedAt >= today && i.CreatedAt < tomorrow)
                .CountAsync();
            
            var memoryCount = PlaybackHub.GetPendingCount(screenId: screenId);
            
            var response = new ScreenStatsDto
            {
                ScreenId = screenId,
                TotalPlaysToday = dbCount + memoryCount,
                SavedPlays = dbCount,
                PendingPlays = memoryCount,
                LastUpdated = DateTime.UtcNow
            };
            
            return Ok(ApiResponse<ScreenStatsDto>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get stats for screen {screenId}");
            return StatusCode(500, ApiResponse<ScreenStatsDto>.ErrorResponse($"Failed to get stats: {ex.Message}"));
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
            
            var memoryCount = PlaybackHub.GetPendingCount(campaignId: campaignId);
            
            var response = new CampaignStatsDto
            {
                CampaignId = campaignId,
                TotalPlaysToday = dbCount + memoryCount,
                SavedPlays = dbCount,
                PendingPlays = memoryCount,
                LastUpdated = DateTime.UtcNow
            };
            
            return Ok(ApiResponse<CampaignStatsDto>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get stats for campaign {campaignId}");
            return StatusCode(500, ApiResponse<CampaignStatsDto>.ErrorResponse($"Failed to get stats: {ex.Message}"));
        }
    }

    [HttpGet("buffer-metrics")]
    public ActionResult<ApiResponse<BufferMetricsDto>> GetBufferMetrics()
    {
        var metrics = new BufferMetricsDto
        {
            PendingImpressions = PlaybackHub.GetPendingCount(),
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
