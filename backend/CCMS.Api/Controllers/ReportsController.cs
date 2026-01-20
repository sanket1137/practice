using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Reports;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly ReportExportService _exportService;
    private readonly ILogger<ReportsController> _logger;
    
    // Reports use recent data (30 days) from Impressions table
    // and aggregated data from ImpressionDailySummaries for older data
    private const int RecentDataDays = 30;

    public ReportsController(
        ApplicationDbContext context,
        IRepository<Booking> bookingRepository,
        IRepository<Campaign> campaignRepository,
        IRepository<Screen> screenRepository,
        ReportExportService exportService,
        ILogger<ReportsController> logger)
    {
        _context = context;
        _bookingRepository = bookingRepository;
        _campaignRepository = campaignRepository;
        _screenRepository = screenRepository;
        _exportService = exportService;
        _logger = logger;
    }

    /// <summary>
    /// Get detailed impression report for a specific booking
    /// </summary>
    [HttpGet("bookings/{bookingId}/impressions")]
    public async Task<ActionResult<ApiResponse<BookingImpressionReport>>> GetBookingImpressionReport(
        Guid bookingId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var booking = await _context.Bookings
                .Include(b => b.Screen)
                .Include(b => b.Campaign)
                .Include(b => b.Creative)
                .FirstOrDefaultAsync(b => b.Id == bookingId);

            if (booking == null)
                return NotFound(ApiResponse<BookingImpressionReport>.ErrorResponse("Booking not found"));

            // Default to booking period if no dates provided
            var from = startDate ?? booking.StartDate;
            var to = endDate ?? booking.EndDate;
            
            // Ensure UTC
            from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            var report = await BuildBookingImpressionReport(booking, from, to);
            
            return Ok(ApiResponse<BookingImpressionReport>.SuccessResponse(report));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating booking impression report for {BookingId}", bookingId);
            return StatusCode(500, ApiResponse<BookingImpressionReport>.ErrorResponse("Error generating report"));
        }
    }

    /// <summary>
    /// Get campaign-level summary report across all bookings/screens
    /// </summary>
    [HttpGet("campaigns/{campaignId}/summary")]
    public async Task<ActionResult<ApiResponse<CampaignSummaryReport>>> GetCampaignSummaryReport(
        Guid campaignId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var campaign = await _context.Campaigns
                .Include(c => c.Bookings)
                    .ThenInclude(b => b.Screen)
                .Include(c => c.Creatives)
                .FirstOrDefaultAsync(c => c.Id == campaignId);

            if (campaign == null)
                return NotFound(ApiResponse<CampaignSummaryReport>.ErrorResponse("Campaign not found"));

            // Default to campaign period if no dates provided
            var from = startDate ?? campaign.StartDate;
            var to = endDate ?? campaign.EndDate ?? DateTime.UtcNow;
            
            from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            var report = await BuildCampaignSummaryReport(campaign, from, to);
            
            return Ok(ApiResponse<CampaignSummaryReport>.SuccessResponse(report));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating campaign summary report for {CampaignId}", campaignId);
            return StatusCode(500, ApiResponse<CampaignSummaryReport>.ErrorResponse("Error generating report"));
        }
    }

    /// <summary>
    /// Get daily breakdown for a campaign
    /// </summary>
    [HttpGet("campaigns/{campaignId}/daily")]
    public async Task<ActionResult<ApiResponse<CampaignDailyReport>>> GetCampaignDailyReport(
        Guid campaignId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var campaign = await _campaignRepository.GetByIdAsync(campaignId);
            if (campaign == null)
                return NotFound(ApiResponse<CampaignDailyReport>.ErrorResponse("Campaign not found"));

            var from = startDate ?? campaign.StartDate;
            var to = endDate ?? campaign.EndDate ?? DateTime.UtcNow;
            
            from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            var report = await BuildCampaignDailyReport(campaign, from, to);
            
            return Ok(ApiResponse<CampaignDailyReport>.SuccessResponse(report));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating campaign daily report for {CampaignId}", campaignId);
            return StatusCode(500, ApiResponse<CampaignDailyReport>.ErrorResponse("Error generating report"));
        }
    }

    /// <summary>
    /// Get hourly breakdown for a specific day
    /// </summary>
    [HttpGet("bookings/{bookingId}/hourly")]
    public async Task<ActionResult<ApiResponse<HourlyBreakdownReport>>> GetHourlyBreakdown(
        Guid bookingId,
        [FromQuery] DateTime date)
    {
        try
        {
            var booking = await _bookingRepository.GetByIdAsync(bookingId);
            if (booking == null)
                return NotFound(ApiResponse<HourlyBreakdownReport>.ErrorResponse("Booking not found"));

            var targetDate = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
            var nextDate = targetDate.AddDays(1);

            var impressions = await _context.Impressions
                .Where(i => i.BookingId == bookingId && i.SessionDate == targetDate)
                .ToListAsync();

            var hourlyData = new int[24];
            var hourlyFullPlays = new int[24];
            var hourlyDuration = new int[24];

            foreach (var imp in impressions)
            {
                var hour = imp.PlayedAt.Hour;
                hourlyData[hour]++;
                if (imp.WasFullPlay) hourlyFullPlays[hour]++;
                hourlyDuration[hour] += imp.DurationSeconds ?? 0;
            }

            var report = new HourlyBreakdownReport
            {
                BookingId = bookingId,
                Date = targetDate,
                HourlyPlays = hourlyData.ToList(),
                HourlyFullPlays = hourlyFullPlays.ToList(),
                HourlyDurationSeconds = hourlyDuration.ToList(),
                TotalPlays = impressions.Count,
                TotalFullPlays = impressions.Count(i => i.WasFullPlay),
                TotalDurationSeconds = impressions.Sum(i => i.DurationSeconds ?? 0)
            };

            return Ok(ApiResponse<HourlyBreakdownReport>.SuccessResponse(report));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating hourly breakdown for {BookingId}", bookingId);
            return StatusCode(500, ApiResponse<HourlyBreakdownReport>.ErrorResponse("Error generating report"));
        }
    }

    /// <summary>
    /// Get detailed impression logs for a booking (for transparency/audit)
    /// </summary>
    [HttpGet("bookings/{bookingId}/logs")]
    public async Task<ActionResult<ApiResponse<ImpressionLogsResponse>>> GetImpressionLogs(
        Guid bookingId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        try
        {
            var booking = await _bookingRepository.GetByIdAsync(bookingId);
            if (booking == null)
                return NotFound(ApiResponse<ImpressionLogsResponse>.ErrorResponse("Booking not found"));

            var from = startDate ?? booking.StartDate;
            var to = endDate ?? booking.EndDate;
            
            from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            var query = _context.Impressions
                .Where(i => i.BookingId == bookingId && i.PlayedAt >= from && i.PlayedAt <= to)
                .OrderByDescending(i => i.PlayedAt);

            var totalCount = await query.CountAsync();
            var impressions = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new ImpressionLogEntry
                {
                    ImpressionId = i.ImpressionId ?? i.Id.ToString(),
                    PlayedAt = i.PlayedAt,
                    DurationSeconds = i.DurationSeconds ?? 0,
                    ExpectedDurationSeconds = i.ExpectedDurationSeconds ?? 0,
                    WasFullPlay = i.WasFullPlay,
                    SlotPosition = i.SlotPosition ?? 0,
                    IsVerified = i.IsVerified,
                    DeviceId = i.DeviceId
                })
                .ToListAsync();

            var response = new ImpressionLogsResponse
            {
                BookingId = bookingId,
                StartDate = from,
                EndDate = to,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                Logs = impressions
            };

            return Ok(ApiResponse<ImpressionLogsResponse>.SuccessResponse(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching impression logs for {BookingId}", bookingId);
            return StatusCode(500, ApiResponse<ImpressionLogsResponse>.ErrorResponse("Error fetching logs"));
        }
    }

    #region Private Helper Methods

    private async Task<BookingImpressionReport> BuildBookingImpressionReport(Booking booking, DateTime from, DateTime to)
    {
        var recentCutoff = DateTime.UtcNow.AddDays(-RecentDataDays);
        
        // Get recent data from Impressions table (only data newer than recentCutoff)
        var recentImpressions = await _context.Impressions
            .Where(i => i.BookingId == booking.Id 
                && i.SessionDate >= from 
                && i.SessionDate <= to
                && i.SessionDate >= recentCutoff)
            .ToListAsync();

        // Get aggregated data from ImpressionDailySummaries for older dates
        var summaries = await _context.ImpressionDailySummaries
            .Where(s => s.BookingId == booking.Id && s.Date >= from && s.Date < recentCutoff)
            .ToListAsync();

        // Calculate totals
        var totalPlays = recentImpressions.Count + summaries.Sum(s => s.TotalPlays);
        var fullPlays = recentImpressions.Count(i => i.WasFullPlay) + summaries.Sum(s => s.FullPlays);
        var totalDuration = recentImpressions.Sum(i => i.DurationSeconds ?? 0) + summaries.Sum(s => s.TotalDurationSeconds);
        var totalExpectedDuration = recentImpressions.Sum(i => i.ExpectedDurationSeconds ?? 0) + summaries.Sum(s => s.TotalExpectedDurationSeconds);

        // Build daily breakdown
        var dailyBreakdown = new List<DailyBreakdown>();
        
        // Group recent impressions by date
        var recentByDate = recentImpressions
            .GroupBy(i => i.SessionDate.Date)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Combine with summaries
        for (var date = from.Date; date <= to.Date; date = date.AddDays(1))
        {
            var utcDate = DateTime.SpecifyKind(date, DateTimeKind.Utc);
            
            if (recentByDate.TryGetValue(date, out var dayImpressions))
            {
                dailyBreakdown.Add(new DailyBreakdown
                {
                    Date = utcDate,
                    TotalPlays = dayImpressions.Count,
                    FullPlays = dayImpressions.Count(i => i.WasFullPlay),
                    PartialPlays = dayImpressions.Count(i => !i.WasFullPlay),
                    TotalDurationSeconds = dayImpressions.Sum(i => i.DurationSeconds ?? 0),
                    FirstPlayAt = dayImpressions.Min(i => i.PlayedAt),
                    LastPlayAt = dayImpressions.Max(i => i.PlayedAt),
                    CompletionRate = dayImpressions.Count > 0 
                        ? Math.Round((decimal)dayImpressions.Count(i => i.WasFullPlay) / dayImpressions.Count * 100, 2) 
                        : 0
                });
            }
            else
            {
                var summary = summaries.FirstOrDefault(s => s.Date.Date == date);
                if (summary != null)
                {
                    dailyBreakdown.Add(new DailyBreakdown
                    {
                        Date = utcDate,
                        TotalPlays = summary.TotalPlays,
                        FullPlays = summary.FullPlays,
                        PartialPlays = summary.PartialPlays,
                        TotalDurationSeconds = summary.TotalDurationSeconds,
                        FirstPlayAt = summary.FirstPlayAt,
                        LastPlayAt = summary.LastPlayAt,
                        CompletionRate = summary.CompletionRate
                    });
                }
            }
        }

        return new BookingImpressionReport
        {
            BookingId = booking.Id,
            CampaignId = booking.CampaignId,
            CampaignName = booking.Campaign?.Name ?? "Unknown",
            ScreenId = booking.ScreenId,
            ScreenName = booking.Screen?.Name ?? "Unknown",
            ScreenLocation = booking.Screen?.Location?.City ?? "Unknown",
            CreativeId = booking.CreativeId,
            CreativeName = booking.Creative?.Name ?? "Unknown",
            BookingPeriod = new DateRange { StartDate = booking.StartDate, EndDate = booking.EndDate },
            ReportPeriod = new DateRange { StartDate = from, EndDate = to },
            GeneratedAt = DateTime.UtcNow,
            
            // Summary metrics
            TotalPlays = totalPlays,
            FullPlays = fullPlays,
            PartialPlays = totalPlays - fullPlays,
            TotalDurationSeconds = totalDuration,
            TotalExpectedDurationSeconds = totalExpectedDuration,
            CompletionRate = totalPlays > 0 ? Math.Round((decimal)fullPlays / totalPlays * 100, 2) : 0,
            AveragePlayDurationSeconds = totalPlays > 0 ? Math.Round((decimal)totalDuration / totalPlays, 2) : 0,
            
            // Daily breakdown
            DailyBreakdown = dailyBreakdown.OrderBy(d => d.Date).ToList()
        };
    }

    private async Task<CampaignSummaryReport> BuildCampaignSummaryReport(Campaign campaign, DateTime from, DateTime to)
    {
        var recentCutoff = DateTime.UtcNow.AddDays(-RecentDataDays);
        var bookingIds = campaign.Bookings.Select(b => b.Id).ToList();
        
        // Get recent data from Impressions table (only data newer than recentCutoff)
        var recentImpressions = await _context.Impressions
            .Where(i => bookingIds.Contains(i.BookingId!.Value) 
                && i.SessionDate >= from 
                && i.SessionDate <= to
                && i.SessionDate >= recentCutoff)
            .ToListAsync();

        // Get aggregated data from ImpressionDailySummaries for older dates (before recentCutoff)
        var summaries = await _context.ImpressionDailySummaries
            .Where(s => bookingIds.Contains(s.BookingId!.Value) 
                && s.Date >= from 
                && s.Date <= to
                && s.Date < recentCutoff)
            .ToListAsync();

        // Calculate totals
        var totalPlays = recentImpressions.Count + summaries.Sum(s => s.TotalPlays);
        var fullPlays = recentImpressions.Count(i => i.WasFullPlay) + summaries.Sum(s => s.FullPlays);
        var totalDuration = recentImpressions.Sum(i => i.DurationSeconds ?? 0) + summaries.Sum(s => s.TotalDurationSeconds);

        // Per-screen breakdown
        var screenStats = new List<ScreenSummary>();
        foreach (var booking in campaign.Bookings)
        {
            var bookingImpressions = recentImpressions.Where(i => i.BookingId == booking.Id).ToList();
            var bookingSummaries = summaries.Where(s => s.BookingId == booking.Id).ToList();
            
            var screenTotalPlays = bookingImpressions.Count + bookingSummaries.Sum(s => s.TotalPlays);
            var screenFullPlays = bookingImpressions.Count(i => i.WasFullPlay) + bookingSummaries.Sum(s => s.FullPlays);

            screenStats.Add(new ScreenSummary
            {
                BookingId = booking.Id,
                ScreenId = booking.ScreenId,
                ScreenName = booking.Screen?.Name ?? "Unknown",
                ScreenLocation = booking.Screen?.Location?.City ?? "Unknown",
                TotalPlays = screenTotalPlays,
                FullPlays = screenFullPlays,
                CompletionRate = screenTotalPlays > 0 ? Math.Round((decimal)screenFullPlays / screenTotalPlays * 100, 2) : 0
            });
        }

        return new CampaignSummaryReport
        {
            CampaignId = campaign.Id,
            CampaignName = campaign.Name,
            AdvertiserId = campaign.AdvertiserId,
            CampaignPeriod = new DateRange { StartDate = campaign.StartDate, EndDate = campaign.EndDate ?? DateTime.UtcNow },
            ReportPeriod = new DateRange { StartDate = from, EndDate = to },
            GeneratedAt = DateTime.UtcNow,
            
            // Summary metrics
            TotalScreens = campaign.Bookings.Count,
            TotalPlays = totalPlays,
            FullPlays = fullPlays,
            PartialPlays = totalPlays - fullPlays,
            TotalDurationSeconds = totalDuration,
            CompletionRate = totalPlays > 0 ? Math.Round((decimal)fullPlays / totalPlays * 100, 2) : 0,
            AveragePlayDurationSeconds = totalPlays > 0 ? Math.Round((decimal)totalDuration / totalPlays, 2) : 0,
            
            // Per-screen stats
            ScreenStats = screenStats.OrderByDescending(s => s.TotalPlays).ToList()
        };
    }

    private async Task<CampaignDailyReport> BuildCampaignDailyReport(Campaign campaign, DateTime from, DateTime to)
    {
        var bookings = await _context.Bookings
            .Where(b => b.CampaignId == campaign.Id)
            .ToListAsync();
            
        var bookingIds = bookings.Select(b => b.Id).ToList();
        
        var recentImpressions = await _context.Impressions
            .Where(i => bookingIds.Contains(i.BookingId!.Value) && i.SessionDate >= from && i.SessionDate <= to)
            .ToListAsync();

        var summaries = await _context.ImpressionDailySummaries
            .Where(s => bookingIds.Contains(s.BookingId!.Value) && s.Date >= from && s.Date <= to)
            .ToListAsync();

        // Build daily breakdown
        var dailyBreakdown = new List<DailyBreakdown>();
        var recentByDate = recentImpressions.GroupBy(i => i.SessionDate.Date).ToDictionary(g => g.Key, g => g.ToList());
        var summariesByDate = summaries.GroupBy(s => s.Date.Date).ToDictionary(g => g.Key, g => g.ToList());

        for (var date = from.Date; date <= to.Date; date = date.AddDays(1))
        {
            var utcDate = DateTime.SpecifyKind(date, DateTimeKind.Utc);
            var dayTotalPlays = 0;
            var dayFullPlays = 0;
            var dayDuration = 0;
            DateTime? dayFirstPlay = null;
            DateTime? dayLastPlay = null;

            if (recentByDate.TryGetValue(date, out var dayImpressions))
            {
                dayTotalPlays += dayImpressions.Count;
                dayFullPlays += dayImpressions.Count(i => i.WasFullPlay);
                dayDuration += dayImpressions.Sum(i => i.DurationSeconds ?? 0);
                dayFirstPlay = dayImpressions.Min(i => i.PlayedAt);
                dayLastPlay = dayImpressions.Max(i => i.PlayedAt);
            }

            if (summariesByDate.TryGetValue(date, out var daySummaries))
            {
                dayTotalPlays += daySummaries.Sum(s => s.TotalPlays);
                dayFullPlays += daySummaries.Sum(s => s.FullPlays);
                dayDuration += daySummaries.Sum(s => s.TotalDurationSeconds);
                
                var summaryFirstPlay = daySummaries.Min(s => s.FirstPlayAt);
                var summaryLastPlay = daySummaries.Max(s => s.LastPlayAt);
                
                dayFirstPlay = dayFirstPlay.HasValue 
                    ? (summaryFirstPlay < dayFirstPlay ? summaryFirstPlay : dayFirstPlay)
                    : summaryFirstPlay;
                dayLastPlay = dayLastPlay.HasValue
                    ? (summaryLastPlay > dayLastPlay ? summaryLastPlay : dayLastPlay)
                    : summaryLastPlay;
            }

            if (dayTotalPlays > 0)
            {
                dailyBreakdown.Add(new DailyBreakdown
                {
                    Date = utcDate,
                    TotalPlays = dayTotalPlays,
                    FullPlays = dayFullPlays,
                    PartialPlays = dayTotalPlays - dayFullPlays,
                    TotalDurationSeconds = dayDuration,
                    FirstPlayAt = dayFirstPlay,
                    LastPlayAt = dayLastPlay,
                    CompletionRate = dayTotalPlays > 0 ? Math.Round((decimal)dayFullPlays / dayTotalPlays * 100, 2) : 0
                });
            }
        }

        return new CampaignDailyReport
        {
            CampaignId = campaign.Id,
            CampaignName = campaign.Name,
            ReportPeriod = new DateRange { StartDate = from, EndDate = to },
            GeneratedAt = DateTime.UtcNow,
            TotalPlays = dailyBreakdown.Sum(d => d.TotalPlays),
            TotalFullPlays = dailyBreakdown.Sum(d => d.FullPlays),
            DailyBreakdown = dailyBreakdown.OrderBy(d => d.Date).ToList()
        };
    }

    #endregion

    #region Export Endpoints

    /// <summary>
    /// Export booking impression report to CSV or PDF
    /// </summary>
    [HttpGet("bookings/{bookingId}/export")]
    public async Task<IActionResult> ExportBookingReport(
        Guid bookingId,
        [FromQuery] string format = "csv",
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var booking = await _context.Bookings
                .Include(b => b.Screen)
                .Include(b => b.Campaign)
                .Include(b => b.Creative)
                .FirstOrDefaultAsync(b => b.Id == bookingId);

            if (booking == null)
                return NotFound("Booking not found");

            var from = startDate ?? booking.StartDate;
            var to = endDate ?? booking.EndDate;
            from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            var report = await BuildBookingImpressionReport(booking, from, to);

            if (format.ToLower() == "pdf")
            {
                var pdfBytes = _exportService.ExportBookingReportToPdf(report);
                return File(pdfBytes, "application/pdf", $"booking-report-{bookingId:N}.pdf");
            }
            else
            {
                var csvBytes = _exportService.ExportBookingReportToCsv(report);
                return File(csvBytes, "text/csv", $"booking-report-{bookingId:N}.csv");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting booking report for {BookingId}", bookingId);
            return StatusCode(500, "Error generating export");
        }
    }

    /// <summary>
    /// Export campaign summary report to CSV or PDF
    /// </summary>
    [HttpGet("campaigns/{campaignId}/export")]
    public async Task<IActionResult> ExportCampaignReport(
        Guid campaignId,
        [FromQuery] string format = "csv",
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var campaign = await _context.Campaigns
                .Include(c => c.Bookings)
                    .ThenInclude(b => b.Screen)
                .Include(c => c.Creatives)
                .FirstOrDefaultAsync(c => c.Id == campaignId);

            if (campaign == null)
                return NotFound("Campaign not found");

            var from = startDate ?? campaign.StartDate;
            var to = endDate ?? campaign.EndDate ?? DateTime.UtcNow;
            from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            var report = await BuildCampaignSummaryReport(campaign, from, to);

            if (format.ToLower() == "pdf")
            {
                var pdfBytes = _exportService.ExportCampaignReportToPdf(report);
                return File(pdfBytes, "application/pdf", $"campaign-report-{campaignId:N}.pdf");
            }
            else
            {
                var csvBytes = _exportService.ExportCampaignReportToCsv(report);
                return File(csvBytes, "text/csv", $"campaign-report-{campaignId:N}.csv");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting campaign report for {CampaignId}", campaignId);
            return StatusCode(500, "Error generating export");
        }
    }

    /// <summary>
    /// Export impression logs to CSV
    /// </summary>
    [HttpGet("bookings/{bookingId}/logs/export")]
    public async Task<IActionResult> ExportImpressionLogs(
        Guid bookingId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var booking = await _bookingRepository.GetByIdAsync(bookingId);
            if (booking == null)
                return NotFound("Booking not found");

            var from = startDate ?? booking.StartDate;
            var to = endDate ?? booking.EndDate;
            from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            // Get all logs (no pagination for export)
            var logs = await _context.Impressions
                .Where(i => i.BookingId == bookingId && i.PlayedAt >= from && i.PlayedAt <= to)
                .OrderByDescending(i => i.PlayedAt)
                .Select(i => new ImpressionLogEntry
                {
                    ImpressionId = i.ImpressionId ?? i.Id.ToString(),
                    PlayedAt = i.PlayedAt,
                    DurationSeconds = i.DurationSeconds ?? 0,
                    ExpectedDurationSeconds = i.ExpectedDurationSeconds ?? 0,
                    WasFullPlay = i.WasFullPlay,
                    SlotPosition = i.SlotPosition ?? 0,
                    IsVerified = i.IsVerified,
                    DeviceId = i.DeviceId
                })
                .ToListAsync();

            var response = new ImpressionLogsResponse
            {
                BookingId = bookingId,
                StartDate = from,
                EndDate = to,
                TotalCount = logs.Count,
                Logs = logs
            };

            var csvBytes = _exportService.ExportImpressionLogsToCsv(response);
            return File(csvBytes, "text/csv", $"impression-logs-{bookingId:N}.csv");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting impression logs for {BookingId}", bookingId);
            return StatusCode(500, "Error generating export");
        }
    }

    #endregion
}
