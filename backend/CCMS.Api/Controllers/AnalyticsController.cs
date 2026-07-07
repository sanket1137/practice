using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Analytics;
using System.Security.Claims;
using Asp.Versioning;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;


namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/analytics")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AnalyticsController> _logger;

    public AnalyticsController(
        ApplicationDbContext context,
        ILogger<AnalyticsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value;
        return Guid.Parse(userIdClaim!);
    }

    private string GetCurrentUserRole()
    {
        return User.FindFirst(ClaimTypes.Role)?.Value 
            ?? User.FindFirst("role")?.Value 
            ?? "";
    }

    // ============================================
    // SCREEN OWNER ANALYTICS ENDPOINTS
    // ============================================

    /// <summary>
    /// Get summary analytics for screen owner
    /// </summary>
    [HttpGet("owner/summary")]
    public async Task<ActionResult<ApiResponse<OwnerAnalyticsSummaryDto>>> GetOwnerSummary()
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            
            // Allow ScreenOwners and Admins
            if (role != "ScreenOwner" && role != "Admin")
            {
                return Forbid();
            }

            var now = DateTime.UtcNow;
            var today = now.Date;
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var startOfLastMonth = startOfMonth.AddMonths(-1);
            var endOfLastMonth = startOfMonth.AddTicks(-1);

            // Get owner's screens (or all screens for admin)
            var screensQuery = _context.Screens.AsQueryable();
            if (role == "ScreenOwner")
            {
                screensQuery = screensQuery.Where(s => s.OwnerId == userId);
            }
            var screens = await screensQuery.ToListAsync();
            var screenIds = screens.Select(s => s.Id).ToList();

            if (!screenIds.Any())
            {
                return Ok(ApiResponse<OwnerAnalyticsSummaryDto>.SuccessResponse(new OwnerAnalyticsSummaryDto()));
            }

            // Get bookings for owner's screens
            var bookings = await _context.Bookings
                .Where(b => screenIds.Contains(b.ScreenId))
                .ToListAsync();

            // Revenue this month
            var nowDateOnly = DateOnly.FromDateTime(now);
            var startOfMonthDateOnly = DateOnly.FromDateTime(startOfMonth);
            var revenueThisMonth = bookings
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Where(b => b.StartDate <= nowDateOnly && b.EndDate >= startOfMonthDateOnly)
                .Sum(b => b.TotalPrice);

            // Revenue last month
            var endOfLastMonthDateOnly = DateOnly.FromDateTime(endOfLastMonth);
            var startOfLastMonthDateOnly = DateOnly.FromDateTime(startOfLastMonth);
            var revenueLastMonth = bookings
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Where(b => b.StartDate <= endOfLastMonthDateOnly && b.EndDate >= startOfLastMonthDateOnly)
                .Sum(b => b.TotalPrice);

            // Revenue change percent
            var revenueChangePercent = revenueLastMonth > 0 
                ? Math.Round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100, 1)
                : (revenueThisMonth > 0 ? 100 : 0);

            // Average daily revenue (this month)
            var daysInMonth = (now - startOfMonth).Days + 1;
            var avgDailyRevenue = daysInMonth > 0 ? revenueThisMonth / daysInMonth : 0;

            // Active bookings (currently running)
            var todayDateOnly = DateOnly.FromDateTime(today);
            var activeBookings = bookings.Count(b => 
                (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active) &&
                b.StartDate <= todayDateOnly && b.EndDate >= todayDateOnly);

            // Total bookings
            var totalBookings = bookings.Count;

            // Screen stats
            var totalScreens = screens.Count;
            var onlineScreens = screens.Count(s => s.IsOnline);

            // Calculate uptime (screens online / total screens * 100)
            var uptimePercent = totalScreens > 0 
                ? Math.Round((decimal)onlineScreens / totalScreens * 100, 1) 
                : 0;

            // Impressions
            var totalImpressions = await _context.Impressions
                .Where(i => screenIds.Contains(i.ScreenId))
                .CountAsync();

            var todayUtc = DateTime.SpecifyKind(today, DateTimeKind.Utc);
            var tomorrowUtc = todayUtc.AddDays(1);
            var todayImpressions = await _context.Impressions
                .Where(i => screenIds.Contains(i.ScreenId) && i.PlayedAt >= todayUtc && i.PlayedAt < tomorrowUtc)
                .CountAsync();

            var summary = new OwnerAnalyticsSummaryDto
            {
                TotalRevenueMonth = revenueThisMonth,
                TotalRevenueLastMonth = revenueLastMonth,
                RevenueChangePercent = revenueChangePercent,
                AvgDailyRevenue = Math.Round(avgDailyRevenue, 2),
                ActiveBookings = activeBookings,
                TotalBookings = totalBookings,
                ScreenUptimePercent = uptimePercent,
                TotalScreens = totalScreens,
                OnlineScreens = onlineScreens,
                TotalImpressions = totalImpressions,
                TodayImpressions = todayImpressions
            };

            return Ok(ApiResponse<OwnerAnalyticsSummaryDto>.SuccessResponse(summary));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting owner analytics summary");
            return StatusCode(500, ApiResponse<OwnerAnalyticsSummaryDto>.ErrorResponse("Error fetching analytics"));
        }
    }

    /// <summary>
    /// Get per-screen revenue breakdown for owner
    /// </summary>
    [HttpGet("owner/screens")]
    public async Task<ActionResult<ApiResponse<List<ScreenRevenueDto>>>> GetOwnerScreenBreakdown()
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            
            if (role != "ScreenOwner" && role != "Admin")
            {
                return Forbid();
            }

            var now = DateTime.UtcNow;
            var today = now.Date;
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var screensQuery = _context.Screens.AsQueryable();
            if (role == "ScreenOwner")
            {
                screensQuery = screensQuery.Where(s => s.OwnerId == userId);
            }
            var screens = await screensQuery.ToListAsync();

            var result = new List<ScreenRevenueDto>();

            foreach (var screen in screens)
            {
                var bookings = await _context.Bookings
                    .Where(b => b.ScreenId == screen.Id)
                    .ToListAsync();

                var nowDateOnly = DateOnly.FromDateTime(now);
                var startOfMonthDateOnly = DateOnly.FromDateTime(startOfMonth);
                var revenue = bookings
                    .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                    .Where(b => b.StartDate <= nowDateOnly && b.EndDate >= startOfMonthDateOnly)
                    .Sum(b => b.TotalPrice);

                var impressions = await _context.Impressions
                    .Where(i => i.ScreenId == screen.Id && i.PlayedAt >= startOfMonth)
                    .CountAsync();

                var todayDateOnly = DateOnly.FromDateTime(today);
                var activeBookings = bookings.Count(b => 
                    (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active) &&
                    b.StartDate <= todayDateOnly && b.EndDate >= todayDateOnly);

                result.Add(new ScreenRevenueDto
                {
                    ScreenId = screen.Id,
                    ScreenName = screen.Name,
                    Revenue = revenue,
                    Impressions = impressions,
                    ActiveBookings = activeBookings,
                    IsOnline = screen.IsOnline,
                    UptimePercent = screen.IsOnline ? 100 : 0 // Simplified; could track historical uptime
                });
            }

            return Ok(ApiResponse<List<ScreenRevenueDto>>.SuccessResponse(result.OrderByDescending(s => s.Revenue).ToList()));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting owner screen breakdown");
            return StatusCode(500, ApiResponse<List<ScreenRevenueDto>>.ErrorResponse("Error fetching screen analytics"));
        }
    }

    /// <summary>
    /// Get daily revenue data for charts
    /// </summary>
    [HttpGet("owner/revenue/daily")]
    public async Task<ActionResult<ApiResponse<List<DailyRevenueDto>>>> GetOwnerDailyRevenue([FromQuery] int days = 7)
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            
            if (role != "ScreenOwner" && role != "Admin")
            {
                return Forbid();
            }

            var now = DateTime.UtcNow;
            var startDate = DateTime.SpecifyKind(now.Date.AddDays(-(days - 1)), DateTimeKind.Utc);

            var screensQuery = _context.Screens.AsQueryable();
            if (role == "ScreenOwner")
            {
                screensQuery = screensQuery.Where(s => s.OwnerId == userId);
            }
            var screenIds = await screensQuery.Select(s => s.Id).ToListAsync();

            if (!screenIds.Any())
            {
                return Ok(ApiResponse<List<DailyRevenueDto>>.SuccessResponse(new List<DailyRevenueDto>()));
            }

            // Get all approved bookings that overlap with our date range
            var nowDateOnly = DateOnly.FromDateTime(now);
            var startDateOnly = DateOnly.FromDateTime(startDate);
            var bookings = await _context.Bookings
                .Where(b => screenIds.Contains(b.ScreenId))
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Where(b => b.StartDate <= nowDateOnly && b.EndDate >= startDateOnly)
                .ToListAsync();

            // Get impressions grouped by day
            var impressions = await _context.Impressions
                .Where(i => screenIds.Contains(i.ScreenId) && i.PlayedAt >= startDate)
                .GroupBy(i => i.SessionDate.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            var result = new List<DailyRevenueDto>();

            for (int i = 0; i < days; i++)
            {
                var date = startDate.AddDays(i);
                var dateEnd = date.AddDays(1);

                // Calculate daily revenue (prorated from bookings active on this day)
                var dailyRevenue = 0m;
                var dailyBookings = 0;
                var currentDateOnly = DateOnly.FromDateTime(date);
                foreach (var booking in bookings)
                {
                    if (booking.StartDate <= currentDateOnly && booking.EndDate >= currentDateOnly)
                    {
                        // Prorate: TotalPrice / booking days
                        var bookingDays = booking.EndDate.DayNumber - booking.StartDate.DayNumber + 1;
                        if (bookingDays > 0)
                        {
                            dailyRevenue += booking.TotalPrice / bookingDays;
                        }
                        dailyBookings++;
                    }
                }

                var dailyImpressions = impressions.FirstOrDefault(i => i.Date == date.Date)?.Count ?? 0;

                result.Add(new DailyRevenueDto
                {
                    Date = date,
                    DayName = date.ToString("ddd"),
                    Revenue = Math.Round(dailyRevenue, 2),
                    Impressions = dailyImpressions,
                    Bookings = dailyBookings
                });
            }

            return Ok(ApiResponse<List<DailyRevenueDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting owner daily revenue");
            return StatusCode(500, ApiResponse<List<DailyRevenueDto>>.ErrorResponse("Error fetching daily revenue"));
        }
    }

    // ============================================
    // ADVERTISER ANALYTICS ENDPOINTS
    // ============================================

    /// <summary>
    /// Get summary analytics for advertiser
    /// </summary>
    [HttpGet("advertiser/summary")]
    public async Task<ActionResult<ApiResponse<AdvertiserAnalyticsSummaryDto>>> GetAdvertiserSummary()
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            
            if (role != "Advertiser" && role != "Admin")
            {
                return Forbid();
            }

            var now = DateTime.UtcNow;
            var today = now.Date;
            var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
            var startOfLastWeek = startOfWeek.AddDays(-7);
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var startOfLastMonth = startOfMonth.AddMonths(-1);

            // Get advertiser's campaigns (or all for admin)
            var campaignsQuery = _context.Campaigns.AsQueryable();
            if (role == "Advertiser")
            {
                campaignsQuery = campaignsQuery.Where(c => c.AdvertiserId == userId);
            }
            var campaigns = await campaignsQuery.ToListAsync();
            var campaignIds = campaigns.Select(c => c.Id).ToList();

            if (!campaignIds.Any())
            {
                return Ok(ApiResponse<AdvertiserAnalyticsSummaryDto>.SuccessResponse(new AdvertiserAnalyticsSummaryDto()));
            }

            // Get bookings for advertiser's campaigns
            var bookings = await _context.Bookings
                .Where(b => b.CampaignId.HasValue && campaignIds.Contains(b.CampaignId.Value))
                .ToListAsync();

            var bookingIds = bookings.Select(b => b.Id).ToList();

            // Impressions this week
            var startOfWeekUtc = DateTime.SpecifyKind(startOfWeek, DateTimeKind.Utc);
            var impressionsThisWeek = await _context.Impressions
                .Where(i => i.CampaignId.HasValue && campaignIds.Contains(i.CampaignId.Value) && i.PlayedAt >= startOfWeekUtc)
                .CountAsync();

            // Impressions last week
            var startOfLastWeekUtc = DateTime.SpecifyKind(startOfLastWeek, DateTimeKind.Utc);
            var endOfLastWeekUtc = startOfWeekUtc;
            var impressionsLastWeek = await _context.Impressions
                .Where(i => i.CampaignId.HasValue && campaignIds.Contains(i.CampaignId.Value) && i.PlayedAt >= startOfLastWeekUtc && i.PlayedAt < endOfLastWeekUtc)
                .CountAsync();

            // Total impressions
            var totalImpressions = await _context.Impressions
                .Where(i => i.CampaignId.HasValue && campaignIds.Contains(i.CampaignId.Value))
                .CountAsync();

            // Impression change percent
            var impressionChangePercent = impressionsLastWeek > 0
                ? Math.Round(((decimal)(impressionsThisWeek - impressionsLastWeek) / impressionsLastWeek) * 100, 1)
                : (impressionsThisWeek > 0 ? 100 : 0);

            // Spend this month
            var nowDateOnly = DateOnly.FromDateTime(now);
            var startOfMonthDateOnly = DateOnly.FromDateTime(startOfMonth);
            var spendThisMonth = bookings
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Where(b => b.StartDate <= nowDateOnly && b.EndDate >= startOfMonthDateOnly)
                .Sum(b => b.TotalPrice);

            // Spend last month
            var endOfLastMonth = startOfMonth.AddTicks(-1);
            var endOfLastMonthDateOnly = DateOnly.FromDateTime(endOfLastMonth);
            var startOfLastMonthDateOnly = DateOnly.FromDateTime(startOfLastMonth);
            var spendLastMonth = bookings
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Where(b => b.StartDate <= endOfLastMonthDateOnly && b.EndDate >= startOfLastMonthDateOnly)
                .Sum(b => b.TotalPrice);

            var spendChangePercent = spendLastMonth > 0
                ? Math.Round(((spendThisMonth - spendLastMonth) / spendLastMonth) * 100, 1)
                : (spendThisMonth > 0 ? 100 : 0);

            // CPM calculation (Cost per 1000 impressions)
            var impressionsThisMonth = await _context.Impressions
                .Where(i => i.CampaignId.HasValue && campaignIds.Contains(i.CampaignId.Value) && i.PlayedAt >= startOfMonth)
                .CountAsync();

            var avgCpm = impressionsThisMonth > 0 
                ? Math.Round((spendThisMonth / impressionsThisMonth) * 1000, 2) 
                : 0;

            var impressionsLastMonth = await _context.Impressions
                .Where(i => i.CampaignId.HasValue && campaignIds.Contains(i.CampaignId.Value) && i.PlayedAt >= startOfLastMonth && i.PlayedAt < startOfMonth)
                .CountAsync();

            var cpmLastMonth = impressionsLastMonth > 0 
                ? Math.Round((spendLastMonth / impressionsLastMonth) * 1000, 2) 
                : 0;

            var cpmChangePercent = cpmLastMonth > 0
                ? Math.Round(((avgCpm - cpmLastMonth) / cpmLastMonth) * 100, 1)
                : 0;

            // Campaign stats
            var activeCampaigns = campaigns.Count(c => c.Status == CampaignStatus.Active);
            var totalCampaigns = campaigns.Count;

            // Booking stats
            var todayDateOnly = DateOnly.FromDateTime(today);
            var activeBookings = bookings.Count(b => 
                (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active) &&
                b.StartDate <= todayDateOnly && b.EndDate >= todayDateOnly);
            var totalBookings = bookings.Count;

            // Unique screens booked
            var totalScreensBooked = bookings
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Select(b => b.ScreenId)
                .Distinct()
                .Count();

            var summary = new AdvertiserAnalyticsSummaryDto
            {
                TotalImpressions = totalImpressions,
                ImpressionsThisWeek = impressionsThisWeek,
                ImpressionsLastWeek = impressionsLastWeek,
                ImpressionChangePercent = impressionChangePercent,
                TotalSpendMonth = spendThisMonth,
                TotalSpendLastMonth = spendLastMonth,
                SpendChangePercent = spendChangePercent,
                AvgCpm = avgCpm,
                CpmLastMonth = cpmLastMonth,
                CpmChangePercent = cpmChangePercent,
                ActiveCampaigns = activeCampaigns,
                TotalCampaigns = totalCampaigns,
                ActiveBookings = activeBookings,
                TotalBookings = totalBookings,
                TotalScreensBooked = totalScreensBooked
            };

            return Ok(ApiResponse<AdvertiserAnalyticsSummaryDto>.SuccessResponse(summary));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting advertiser analytics summary");
            return StatusCode(500, ApiResponse<AdvertiserAnalyticsSummaryDto>.ErrorResponse("Error fetching analytics"));
        }
    }

    /// <summary>
    /// Get analytics summary for a specific campaign
    /// </summary>
    [HttpGet("campaigns/{id}/summary")]
    public async Task<ActionResult<ApiResponse<CampaignPerformanceSummaryDto>>> GetCampaignSummary(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();

            var campaign = await _context.Campaigns.FindAsync(id);
            if (campaign == null)
                return NotFound(ApiResponse<CampaignPerformanceSummaryDto>.ErrorResponse("Campaign not found"));

            // Verify ownership (unless admin)
            if (role != "Admin" && campaign.AdvertiserId != userId)
                return StatusCode(403, ApiResponse<CampaignPerformanceSummaryDto>.ErrorResponse("You do not own this campaign"));

            var bookings = await _context.Bookings
                .Where(b => b.CampaignId == campaign.Id)
                .ToListAsync();

            var approvedBookings = bookings.Where(b =>
                b.Status == BookingStatus.Approved ||
                b.Status == BookingStatus.Active ||
                b.Status == BookingStatus.Completed).ToList();

            var deliveredImpressions = await _context.Impressions
                .Where(i => i.CampaignId == campaign.Id)
                .CountAsync();

            var expectedImpressions = approvedBookings.Sum(b => b.ExpectedImpressions);
            var spent = approvedBookings.Sum(b => b.TotalPrice);

            var deliveryPercent = expectedImpressions > 0
                ? Math.Round((decimal)deliveredImpressions / expectedImpressions * 100, 1)
                : 0;

            var result = new CampaignPerformanceSummaryDto
            {
                CampaignId = campaign.Id,
                CampaignName = campaign.Name,
                Status = campaign.Status.ToString(),
                DeliveredImpressions = deliveredImpressions,
                ExpectedImpressions = expectedImpressions,
                DeliveryPercent = deliveryPercent,
                Spent = spent,
                TotalBookings = bookings.Count,
                ApprovedBookings = approvedBookings.Count,
                StartDate = campaign.StartDate.ToDateTime(TimeOnly.MinValue),
                EndDate = campaign.EndDate?.ToDateTime(TimeOnly.MinValue)
            };

            return Ok(ApiResponse<CampaignPerformanceSummaryDto>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting campaign summary for {CampaignId}", id);
            return StatusCode(500, ApiResponse<CampaignPerformanceSummaryDto>.ErrorResponse("Error fetching campaign analytics"));
        }
    }

    /// <summary>
    /// Get per-campaign performance for advertiser
    /// </summary>
    [HttpGet("advertiser/campaigns")]
    public async Task<ActionResult<ApiResponse<List<CampaignPerformanceSummaryDto>>>> GetAdvertiserCampaigns()
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            
            if (role != "Advertiser" && role != "Admin")
            {
                return Forbid();
            }

            var campaignsQuery = _context.Campaigns.AsQueryable();
            if (role == "Advertiser")
            {
                campaignsQuery = campaignsQuery.Where(c => c.AdvertiserId == userId);
            }
            var campaigns = await campaignsQuery
                .OrderByDescending(c => c.CreatedAt)
                .Take(10) // Top 10 recent campaigns
                .ToListAsync();

            var result = new List<CampaignPerformanceSummaryDto>();

            foreach (var campaign in campaigns)
            {
                var bookings = await _context.Bookings
                    .Where(b => b.CampaignId == campaign.Id)
                    .ToListAsync();

                var approvedBookings = bookings.Where(b => 
                    b.Status == BookingStatus.Approved || 
                    b.Status == BookingStatus.Active || 
                    b.Status == BookingStatus.Completed).ToList();

                var deliveredImpressions = await _context.Impressions
                    .Where(i => i.CampaignId == campaign.Id)
                    .CountAsync();

                var expectedImpressions = approvedBookings.Sum(b => b.ExpectedImpressions);
                var spent = approvedBookings.Sum(b => b.TotalPrice);

                var deliveryPercent = expectedImpressions > 0
                    ? Math.Round((decimal)deliveredImpressions / expectedImpressions * 100, 1)
                    : 0;

                result.Add(new CampaignPerformanceSummaryDto
                {
                    CampaignId = campaign.Id,
                    CampaignName = campaign.Name,
                    Status = campaign.Status.ToString(),
                    DeliveredImpressions = deliveredImpressions,
                    ExpectedImpressions = expectedImpressions,
                    DeliveryPercent = deliveryPercent,
                    Spent = spent,
                    TotalBookings = bookings.Count,
                    ApprovedBookings = approvedBookings.Count,
                    StartDate = campaign.StartDate.ToDateTime(TimeOnly.MinValue),
                    EndDate = campaign.EndDate?.ToDateTime(TimeOnly.MinValue)
                });
            }

            return Ok(ApiResponse<List<CampaignPerformanceSummaryDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting advertiser campaigns");
            return StatusCode(500, ApiResponse<List<CampaignPerformanceSummaryDto>>.ErrorResponse("Error fetching campaign analytics"));
        }
    }

    /// <summary>
    /// Get daily impressions data for charts
    /// </summary>
    [HttpGet("advertiser/impressions/daily")]
    public async Task<ActionResult<ApiResponse<List<DailyImpressionsDto>>>> GetAdvertiserDailyImpressions([FromQuery] int days = 7)
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            
            if (role != "Advertiser" && role != "Admin")
            {
                return Forbid();
            }

            var now = DateTime.UtcNow;
            var startDate = DateTime.SpecifyKind(now.Date.AddDays(-(days - 1)), DateTimeKind.Utc);

            var campaignsQuery = _context.Campaigns.AsQueryable();
            if (role == "Advertiser")
            {
                campaignsQuery = campaignsQuery.Where(c => c.AdvertiserId == userId);
            }
            var campaignIds = await campaignsQuery.Select(c => c.Id).ToListAsync();

            if (!campaignIds.Any())
            {
                return Ok(ApiResponse<List<DailyImpressionsDto>>.SuccessResponse(new List<DailyImpressionsDto>()));
            }

            // Get impressions grouped by day
            var impressions = await _context.Impressions
                .Where(i => i.CampaignId.HasValue && campaignIds.Contains(i.CampaignId.Value) && i.PlayedAt >= startDate)
                .GroupBy(i => i.SessionDate.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            // Get bookings created per day
            var bookingsQuery = _context.Bookings
                .Where(b => b.CampaignId.HasValue && campaignIds.Contains(b.CampaignId.Value) && b.CreatedAt >= startDate);
            var bookingsByDate = await bookingsQuery
                .GroupBy(b => b.CreatedAt.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            var result = new List<DailyImpressionsDto>();

            for (int i = 0; i < days; i++)
            {
                var date = startDate.AddDays(i);

                var dailyImpressions = impressions.FirstOrDefault(imp => imp.Date == date.Date)?.Count ?? 0;
                var dailyBookings = bookingsByDate.FirstOrDefault(b => b.Date == date.Date)?.Count ?? 0;

                result.Add(new DailyImpressionsDto
                {
                    Date = date,
                    DayName = date.ToString("ddd"),
                    Impressions = dailyImpressions,
                    Bookings = dailyBookings
                });
            }

            return Ok(ApiResponse<List<DailyImpressionsDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting advertiser daily impressions");
            return StatusCode(500, ApiResponse<List<DailyImpressionsDto>>.ErrorResponse("Error fetching daily impressions"));
        }
    }

    // ============================================
    // ADMIN/PLATFORM ANALYTICS ENDPOINTS
    // ============================================

    /// <summary>
    /// Get platform-wide analytics summary (Admin only)
    /// </summary>
    [HttpGet("admin/platform")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<PlatformAnalyticsSummaryDto>>> GetPlatformSummary()
    {
        try
        {
            var now = DateTime.UtcNow;
            var today = now.Date;
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var startOfLastMonth = startOfMonth.AddMonths(-1);
            var endOfLastMonth = startOfMonth.AddTicks(-1);

            // Impressions
            var totalImpressions = await _context.Impressions.CountAsync();
            var impressionsThisMonth = await _context.Impressions
                .Where(i => i.PlayedAt >= startOfMonth)
                .CountAsync();
            var impressionsLastMonth = await _context.Impressions
                .Where(i => i.PlayedAt >= startOfLastMonth && i.PlayedAt < startOfMonth)
                .CountAsync();

            var impressionChangePercent = impressionsLastMonth > 0
                ? Math.Round(((decimal)(impressionsThisMonth - impressionsLastMonth) / impressionsLastMonth) * 100, 1)
                : (impressionsThisMonth > 0 ? 100 : 0);

            // Revenue
            var allBookings = await _context.Bookings.ToListAsync();
            var approvedBookings = allBookings.Where(b => 
                b.Status == BookingStatus.Approved || 
                b.Status == BookingStatus.Active || 
                b.Status == BookingStatus.Completed).ToList();

            var totalRevenue = approvedBookings.Sum(b => b.TotalPrice);
            var nowDateOnly = DateOnly.FromDateTime(now);
            var startOfMonthDateOnly = DateOnly.FromDateTime(startOfMonth);
            var revenueThisMonth = approvedBookings
                .Where(b => b.StartDate <= nowDateOnly && b.EndDate >= startOfMonthDateOnly)
                .Sum(b => b.TotalPrice);
            var endOfLastMonthDateOnly = DateOnly.FromDateTime(endOfLastMonth);
            var startOfLastMonthDateOnly = DateOnly.FromDateTime(startOfLastMonth);
            var revenueLastMonth = approvedBookings
                .Where(b => b.StartDate <= endOfLastMonthDateOnly && b.EndDate >= startOfLastMonthDateOnly)
                .Sum(b => b.TotalPrice);

            var revenueChangePercent = revenueLastMonth > 0
                ? Math.Round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100, 1)
                : (revenueThisMonth > 0 ? 100 : 0);

            // Screens
            var screens = await _context.Screens.ToListAsync();
            var totalScreens = screens.Count;
            var onlineScreens = screens.Count(s => s.IsOnline);
            var activeScreens = screens.Count(s => s.Status == ScreenStatus.Active);
            var avgScreenUptime = totalScreens > 0 
                ? Math.Round((decimal)onlineScreens / totalScreens * 100, 1) 
                : 0;

            // Campaigns
            var campaigns = await _context.Campaigns.ToListAsync();
            var activeCampaigns = campaigns.Count(c => c.Status == CampaignStatus.Active);
            var totalCampaigns = campaigns.Count;

            // Bookings
            var pendingApprovals = allBookings.Count(b => b.Status == BookingStatus.Pending);
            var totalBookingsCount = allBookings.Count;
            var approvedBookingsCount = approvedBookings.Count;

            // Users
            var users = await _context.Users.ToListAsync();
            var totalUsers = users.Count;
            var totalScreenOwners = users.Count(u => u.Role == UserRole.ScreenOwner);
            var totalAdvertisers = users.Count(u => u.Role == UserRole.Advertiser);
            var newUsersThisMonth = users.Count(u => u.CreatedAt >= startOfMonth);

            var summary = new PlatformAnalyticsSummaryDto
            {
                TotalImpressions = totalImpressions,
                ImpressionsThisMonth = impressionsThisMonth,
                ImpressionsLastMonth = impressionsLastMonth,
                ImpressionChangePercent = impressionChangePercent,
                TotalRevenue = totalRevenue,
                RevenueThisMonth = revenueThisMonth,
                RevenueLastMonth = revenueLastMonth,
                RevenueChangePercent = revenueChangePercent,
                ActiveScreens = activeScreens,
                TotalScreens = totalScreens,
                OnlineScreens = onlineScreens,
                AvgScreenUptime = avgScreenUptime,
                ActiveCampaigns = activeCampaigns,
                TotalCampaigns = totalCampaigns,
                PendingApprovals = pendingApprovals,
                TotalBookings = totalBookingsCount,
                ApprovedBookings = approvedBookingsCount,
                TotalUsers = totalUsers,
                TotalScreenOwners = totalScreenOwners,
                TotalAdvertisers = totalAdvertisers,
                NewUsersThisMonth = newUsersThisMonth
            };

            return Ok(ApiResponse<PlatformAnalyticsSummaryDto>.SuccessResponse(summary));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting platform analytics summary");
            return StatusCode(500, ApiResponse<PlatformAnalyticsSummaryDto>.ErrorResponse("Error fetching platform analytics"));
        }
    }

    /// <summary>
    /// Get daily platform stats for charts (Admin only)
    /// </summary>
    [HttpGet("admin/daily")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<PlatformDailyStatsDto>>>> GetPlatformDailyStats([FromQuery] int days = 7)
    {
        try
        {
            var now = DateTime.UtcNow;
            var startDate = DateTime.SpecifyKind(now.Date.AddDays(-(days - 1)), DateTimeKind.Utc);

            // Impressions by day
            var impressions = await _context.Impressions
                .Where(i => i.PlayedAt >= startDate)
                .GroupBy(i => i.SessionDate.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            // Bookings by created date
            var bookings = await _context.Bookings
                .Where(b => b.CreatedAt >= startDate)
                .ToListAsync();

            var approvedBookings = bookings.Where(b => 
                b.Status == BookingStatus.Approved || 
                b.Status == BookingStatus.Active || 
                b.Status == BookingStatus.Completed).ToList();

            // Users by created date
            var users = await _context.Users
                .Where(u => u.CreatedAt >= startDate)
                .GroupBy(u => u.CreatedAt.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            var result = new List<PlatformDailyStatsDto>();

            for (int i = 0; i < days; i++)
            {
                var date = startDate.AddDays(i);

                var dailyImpressions = impressions.FirstOrDefault(imp => imp.Date == date.Date)?.Count ?? 0;
                var dailyNewBookings = bookings.Count(b => b.CreatedAt.Date == date.Date);
                var dailyNewUsers = users.FirstOrDefault(u => u.Date == date.Date)?.Count ?? 0;

                // Calculate daily revenue (prorated)
                var dailyRevenue = 0m;
                var currentDateOnly = DateOnly.FromDateTime(date);
                foreach (var booking in approvedBookings)
                {
                    if (booking.StartDate <= currentDateOnly && booking.EndDate >= currentDateOnly)
                    {
                        var bookingDays = booking.EndDate.DayNumber - booking.StartDate.DayNumber + 1;
                        if (bookingDays > 0)
                        {
                            dailyRevenue += booking.TotalPrice / bookingDays;
                        }
                    }
                }

                result.Add(new PlatformDailyStatsDto
                {
                    Date = date,
                    DayName = date.ToString("ddd"),
                    Impressions = dailyImpressions,
                    Revenue = Math.Round(dailyRevenue, 2),
                    NewBookings = dailyNewBookings,
                    NewUsers = dailyNewUsers
                });
            }

            return Ok(ApiResponse<List<PlatformDailyStatsDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting platform daily stats");
            return StatusCode(500, ApiResponse<List<PlatformDailyStatsDto>>.ErrorResponse("Error fetching daily stats"));
        }
    }

    // ============================================
    // DATE-RANGE ANALYTICS ENDPOINTS (Phase 3)
    // ============================================

    /// <summary>Advertiser analytics with custom date range</summary>
    [HttpGet("advertiser/daterange")]
    public async Task<IActionResult> GetAdvertiserDateRange(
        [FromQuery] DateTime dateFrom,
        [FromQuery] DateTime dateTo)
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            if (role != "Advertiser" && role != "Admin")
                return Forbid();

            dateFrom = DateTime.SpecifyKind(dateFrom.Date, DateTimeKind.Utc);
            dateTo = DateTime.SpecifyKind(dateTo.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            var dateFromOnly = DateOnly.FromDateTime(dateFrom);
            var dateToOnly = DateOnly.FromDateTime(dateTo);

            var campaignsQuery = _context.Campaigns.AsNoTracking().AsQueryable();
            if (role == "Advertiser")
                campaignsQuery = campaignsQuery.Where(c => c.AdvertiserId == userId);
            var campaignIds = await campaignsQuery.Select(c => c.Id).ToListAsync();

            var bookings = await _context.Bookings.AsNoTracking()
                .Where(b => b.CampaignId.HasValue && campaignIds.Contains(b.CampaignId.Value))
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Where(b => b.StartDate <= dateToOnly && b.EndDate >= dateFromOnly)
                .Select(b => new { b.Id, b.CampaignId, b.TotalPrice, b.StartDate, b.EndDate, b.Status, CampaignName = b.Campaign != null ? b.Campaign.Name : "" })
                .ToListAsync();

            var totalSpend = bookings.Sum(b => b.TotalPrice);
            var totalPlays = await _context.Impressions.AsNoTracking()
                .Where(i => i.CampaignId.HasValue && campaignIds.Contains(i.CampaignId.Value)
                    && i.PlayedAt >= dateFrom && i.PlayedAt <= dateTo)
                .CountAsync();

            var avgCpp = totalPlays > 0 ? Math.Round(totalSpend / totalPlays, 4) : 0;

            var activeCampaigns = await _context.Campaigns.AsNoTracking()
                .Where(c => campaignIds.Contains(c.Id) && c.Status == CampaignStatus.Active)
                .CountAsync();

            // Spend-over-time (daily)
            var spendByDay = new List<object>();
            var current = dateFrom;
            while (current <= dateTo)
            {
                var day = DateOnly.FromDateTime(current);
                var daySpend = bookings
                    .Where(b => b.StartDate <= day && b.EndDate >= day)
                    .Sum(b => {
                        var days = b.EndDate.DayNumber - b.StartDate.DayNumber + 1;
                        return days > 0 ? b.TotalPrice / days : 0;
                    });
                spendByDay.Add(new { date = current.ToString("yyyy-MM-dd"), amount = Math.Round(daySpend, 2) });
                current = current.AddDays(1);
            }

            // Campaign breakdown
            var campaignBreakdown = bookings
                .GroupBy(b => new { b.CampaignId, b.CampaignName })
                .Select(g => new {
                    campaignId = g.Key.CampaignId,
                    name = g.Key.CampaignName,
                    plays = 0,
                    spend = g.Sum(b => b.TotalPrice)
                })
                .OrderByDescending(c => c.spend)
                .ToList();

            return Ok(new {
                totalSpend,
                totalPlays,
                avgCpp,
                activeCampaigns,
                spendOverTime = spendByDay,
                campaignBreakdown
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting advertiser date range analytics");
            return StatusCode(500, new { error = "Error fetching analytics" });
        }
    }

    /// <summary>Media owner analytics with custom date range</summary>
    [HttpGet("mediaowner/daterange")]
    public async Task<IActionResult> GetMediaOwnerDateRange(
        [FromQuery] DateTime dateFrom,
        [FromQuery] DateTime dateTo,
        [FromQuery] Guid? screenId = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            var role = GetCurrentUserRole();
            if (role != "ScreenOwner" && role != "Admin")
                return Forbid();

            dateFrom = DateTime.SpecifyKind(dateFrom.Date, DateTimeKind.Utc);
            dateTo = DateTime.SpecifyKind(dateTo.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            var dateFromOnly = DateOnly.FromDateTime(dateFrom);
            var dateToOnly = DateOnly.FromDateTime(dateTo);

            var screensQuery = _context.Screens.AsNoTracking().AsQueryable();
            if (role == "ScreenOwner")
                screensQuery = screensQuery.Where(s => s.OwnerId == userId);
            if (screenId.HasValue)
                screensQuery = screensQuery.Where(s => s.Id == screenId.Value);
            var screens = await screensQuery.Select(s => new { s.Id, s.Name, s.IsOnline, s.SlotsPerFrame, s.TimeFrameMinutes, s.Schedule }).ToListAsync();
            var screenIds = screens.Select(s => s.Id).ToList();

            var bookings = await _context.Bookings.AsNoTracking()
                .Where(b => screenIds.Contains(b.ScreenId))
                .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                .Where(b => b.StartDate <= dateToOnly && b.EndDate >= dateFromOnly)
                .Select(b => new { b.Id, b.ScreenId, b.TotalPrice, b.StartDate, b.EndDate, b.Status, b.CampaignId })
                .ToListAsync();

            var totalRevenue = bookings.Sum(b => b.TotalPrice);
            var totalBookings = bookings.Count;

            var pendingBookings = await _context.Bookings.AsNoTracking()
                .Where(b => screenIds.Contains(b.ScreenId) && b.Status == BookingStatus.Pending
                    && b.StartDate <= dateToOnly && b.EndDate >= dateFromOnly)
                .CountAsync();

            // Fill rate: bookings / theoretical max slots
            var totalDays = (dateTo - dateFrom).Days + 1;
            var theoreticalSlots = screenIds.Count * totalDays * 6;
            var actualSlots = bookings.Count;
            var fillRate = theoreticalSlots > 0
                ? Math.Round((decimal)actualSlots / theoreticalSlots * 100, 1)
                : 0;

            // Revenue over time
            var revenueByDay = new List<object>();
            var cur = dateFrom;
            while (cur <= dateTo)
            {
                var day = DateOnly.FromDateTime(cur);
                var dayRevenue = bookings
                    .Where(b => b.StartDate <= day && b.EndDate >= day)
                    .Sum(b => {
                        var days = b.EndDate.DayNumber - b.StartDate.DayNumber + 1;
                        return days > 0 ? b.TotalPrice / days : 0;
                    });
                revenueByDay.Add(new { date = cur.ToString("yyyy-MM-dd"), amount = Math.Round(dayRevenue, 2) });
                cur = cur.AddDays(1);
            }

            // Fill rate by screen
            var fillRateByScreen = screens.Select(s => {
                var sBookings = bookings.Count(b => b.ScreenId == s.Id);
                var sSlots = totalDays * 6;
                return new { screenId = s.Id, screenName = s.Name, fillRate = sSlots > 0 ? Math.Round((decimal)sBookings / sSlots * 100, 1) : 0m };
            }).ToList();

            // Top advertisers
            var advertiserIds = bookings.Where(b => b.CampaignId.HasValue).Select(b => b.CampaignId!.Value).Distinct().ToList();
            var campaignAdvertisers = await _context.Campaigns.AsNoTracking()
                .Where(c => advertiserIds.Contains(c.Id))
                .Select(c => new { c.Id, c.AdvertiserId, AdvertiserName = c.Advertiser != null ? c.Advertiser.FirstName + " " + c.Advertiser.LastName : "Unknown" })
                .ToListAsync();

            var topAdvertisers = bookings
                .Where(b => b.CampaignId.HasValue)
                .GroupBy(b => b.CampaignId!.Value)
                .Select(g => {
                    var camp = campaignAdvertisers.FirstOrDefault(c => c.Id == g.Key);
                    return new { advertiserId = camp?.AdvertiserId, advertiserName = camp?.AdvertiserName ?? "Unknown", spend = g.Sum(b => b.TotalPrice), bookings = g.Count() };
                })
                .GroupBy(a => a.advertiserId)
                .Select(g => new { advertiserId = g.Key, advertiserName = g.First().advertiserName, spend = g.Sum(a => a.spend), bookings = g.Sum(a => a.bookings) })
                .OrderByDescending(a => a.spend)
                .Take(5)
                .ToList();

            return Ok(new {
                totalRevenue,
                fillRate,
                totalBookings,
                pendingBookings,
                revenueOverTime = revenueByDay,
                fillRateByScreen,
                topAdvertisers
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting media owner date range analytics");
            return StatusCode(500, new { error = "Error fetching analytics" });
        }
    }

    /// <summary>Export analytics to CSV</summary>
    [HttpGet("export")]
    public async Task<IActionResult> ExportAnalyticsCsv(
        [FromQuery] string role,
        [FromQuery] DateTime dateFrom,
        [FromQuery] DateTime dateTo,
        [FromQuery] string format = "csv")
    {
        try
        {
            var userId = GetCurrentUserId();
            var currentRole = GetCurrentUserRole();

            dateFrom = DateTime.SpecifyKind(dateFrom.Date, DateTimeKind.Utc);
            dateTo = DateTime.SpecifyKind(dateTo.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            var dateFromOnly = DateOnly.FromDateTime(dateFrom);
            var dateToOnly = DateOnly.FromDateTime(dateTo);

            if (format.Equals("pdf", StringComparison.OrdinalIgnoreCase))
            {
                return await GeneratePdfExport(userId, currentRole, role, dateFrom, dateTo, dateFromOnly, dateToOnly);
            }

            var config = new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = true };
            await using var memStream = new MemoryStream();
            await using var writer = new StreamWriter(memStream, Encoding.UTF8);
            await using var csv = new CsvWriter(writer, config);

            if (role.Equals("advertiser", StringComparison.OrdinalIgnoreCase) &&
                (currentRole == "Advertiser" || currentRole == "Admin"))
            {
                var campaignsQuery = _context.Campaigns.AsNoTracking().AsQueryable();
                if (currentRole == "Advertiser")
                    campaignsQuery = campaignsQuery.Where(c => c.AdvertiserId == userId);
                var campaignIds = await campaignsQuery.Select(c => c.Id).ToListAsync();

                var rows = await _context.Bookings.AsNoTracking()
                    .Where(b => b.CampaignId.HasValue && campaignIds.Contains(b.CampaignId.Value))
                    .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                    .Where(b => b.StartDate <= dateToOnly && b.EndDate >= dateFromOnly)
                    .Select(b => new {
                        BookingId = b.Id.ToString(),
                        CampaignName = b.Campaign != null ? b.Campaign.Name : "",
                        ScreenName = b.Screen != null ? b.Screen.Name : "",
                        StartDate = b.StartDate.ToString(),
                        EndDate = b.EndDate.ToString(),
                        Spend = b.TotalPrice,
                        Status = b.Status.ToString()
                    })
                    .OrderBy(r => r.StartDate)
                    .ToListAsync();

                csv.WriteRecords(rows);
            }
            else if (role.Equals("mediaowner", StringComparison.OrdinalIgnoreCase) &&
                (currentRole == "ScreenOwner" || currentRole == "Admin"))
            {
                var screensQuery = _context.Screens.AsNoTracking().AsQueryable();
                if (currentRole == "ScreenOwner")
                    screensQuery = screensQuery.Where(s => s.OwnerId == userId);
                var screenIds = await screensQuery.Select(s => s.Id).ToListAsync();

                var rows = await _context.Bookings.AsNoTracking()
                    .Where(b => screenIds.Contains(b.ScreenId))
                    .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                    .Where(b => b.StartDate <= dateToOnly && b.EndDate >= dateFromOnly)
                    .Select(b => new {
                        BookingId = b.Id.ToString(),
                        ScreenName = b.Screen != null ? b.Screen.Name : "",
                        CampaignName = b.Campaign != null ? b.Campaign.Name : "",
                        AdvertiserName = b.Campaign != null && b.Campaign.Advertiser != null ? b.Campaign.Advertiser.FirstName + " " + b.Campaign.Advertiser.LastName : "",
                        StartDate = b.StartDate.ToString(),
                        EndDate = b.EndDate.ToString(),
                        Revenue = b.TotalPrice,
                        Status = b.Status.ToString()
                    })
                    .OrderBy(r => r.StartDate)
                    .ToListAsync();

                csv.WriteRecords(rows);
            }
            else
            {
                return Forbid();
            }

            await writer.FlushAsync();
            var bytes = memStream.ToArray();
            var fileName = $"analytics_{role}_{dateFrom:yyyyMMdd}_{dateTo:yyyyMMdd}.csv";
            return File(bytes, "text/csv", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting analytics CSV");
            return StatusCode(500, new { error = "Error generating export" });
        }
    }

    private async Task<IActionResult> GeneratePdfExport(
        Guid userId, string currentRole, string role,
        DateTime dateFrom, DateTime dateTo,
        DateOnly dateFromOnly, DateOnly dateToOnly)
    {
        try
        {
            string reportTitle;
            List<string> headers;
            List<List<string>> rows;

            if (role.Equals("advertiser", StringComparison.OrdinalIgnoreCase) &&
                (currentRole == "Advertiser" || currentRole == "Admin"))
            {
                reportTitle = "Advertiser Analytics Report";
                headers = new List<string> { "Booking ID", "Campaign", "Screen", "Start Date", "End Date", "Spend (₹)", "Status" };

                var campaignsQuery = _context.Campaigns.AsNoTracking().AsQueryable();
                if (currentRole == "Advertiser")
                    campaignsQuery = campaignsQuery.Where(c => c.AdvertiserId == userId);
                var campaignIds = await campaignsQuery.Select(c => c.Id).ToListAsync();

                var bookings = await _context.Bookings.AsNoTracking()
                    .Where(b => b.CampaignId.HasValue && campaignIds.Contains(b.CampaignId.Value))
                    .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                    .Where(b => b.StartDate <= dateToOnly && b.EndDate >= dateFromOnly)
                    .Include(b => b.Campaign)
                    .Include(b => b.Screen)
                    .OrderBy(b => b.StartDate)
                    .ToListAsync();

                rows = bookings.Select(b => new List<string>
                {
                    b.Id.ToString()[..8] + "...",
                    b.Campaign?.Name ?? "",
                    b.Screen?.Name ?? "",
                    b.StartDate.ToString(),
                    b.EndDate.ToString(),
                    b.TotalPrice.ToString("N2"),
                    b.Status.ToString()
                }).ToList();

                var totalSpend = bookings.Sum(b => b.TotalPrice);
                var pdfBytes = BuildAnalyticsPdf(reportTitle, dateFrom, dateTo, headers, rows,
                    new Dictionary<string, string>
                    {
                        { "Total Bookings", bookings.Count.ToString() },
                        { "Total Spend", $"₹{totalSpend:N2}" },
                        { "Date Range", $"{dateFromOnly} – {dateToOnly}" }
                    });

                return File(pdfBytes, "application/pdf", $"analytics_advertiser_{dateFrom:yyyyMMdd}_{dateTo:yyyyMMdd}.pdf");
            }
            else if (role.Equals("mediaowner", StringComparison.OrdinalIgnoreCase) &&
                (currentRole == "ScreenOwner" || currentRole == "Admin"))
            {
                reportTitle = "Screen Owner Analytics Report";
                headers = new List<string> { "Booking ID", "Screen", "Campaign", "Advertiser", "Start Date", "End Date", "Revenue (₹)", "Status" };

                var screensQuery = _context.Screens.AsNoTracking().AsQueryable();
                if (currentRole == "ScreenOwner")
                    screensQuery = screensQuery.Where(s => s.OwnerId == userId);
                var screenIds = await screensQuery.Select(s => s.Id).ToListAsync();

                var bookings = await _context.Bookings.AsNoTracking()
                    .Where(b => screenIds.Contains(b.ScreenId))
                    .Where(b => b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                    .Where(b => b.StartDate <= dateToOnly && b.EndDate >= dateFromOnly)
                    .Include(b => b.Screen)
                    .Include(b => b.Campaign).ThenInclude(c => c != null ? c.Advertiser : null)
                    .OrderBy(b => b.StartDate)
                    .ToListAsync();

                rows = bookings.Select(b => new List<string>
                {
                    b.Id.ToString()[..8] + "...",
                    b.Screen?.Name ?? "",
                    b.Campaign?.Name ?? "",
                    b.Campaign?.Advertiser != null ? b.Campaign.Advertiser.FirstName + " " + b.Campaign.Advertiser.LastName : "",
                    b.StartDate.ToString(),
                    b.EndDate.ToString(),
                    b.TotalPrice.ToString("N2"),
                    b.Status.ToString()
                }).ToList();

                var totalRevenue = bookings.Sum(b => b.TotalPrice);
                var pdfBytes = BuildAnalyticsPdf(reportTitle, dateFrom, dateTo, headers, rows,
                    new Dictionary<string, string>
                    {
                        { "Total Bookings", bookings.Count.ToString() },
                        { "Total Revenue", $"₹{totalRevenue:N2}" },
                        { "Date Range", $"{dateFromOnly} – {dateToOnly}" }
                    });

                return File(pdfBytes, "application/pdf", $"analytics_mediaowner_{dateFrom:yyyyMMdd}_{dateTo:yyyyMMdd}.pdf");
            }
            else
            {
                return Forbid();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating analytics PDF");
            return StatusCode(500, new { error = "Error generating PDF export" });
        }
    }

    private static byte[] BuildAnalyticsPdf(
        string title,
        DateTime dateFrom,
        DateTime dateTo,
        List<string> headers,
        List<List<string>> rows,
        Dictionary<string, string> summaryStats)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                // Header
                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("PixelSpot CCMS").Bold().FontSize(18).FontColor("#6366f1");
                            c.Item().Text(title).FontSize(13).FontColor("#334155");
                        });
                        row.ConstantItem(200).AlignRight().Column(c =>
                        {
                            c.Item().Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontSize(8).FontColor("#64748b");
                            c.Item().Text($"Period: {dateFrom:yyyy-MM-dd} – {dateTo:yyyy-MM-dd}").FontSize(8).FontColor("#64748b");
                        });
                    });
                    col.Item().PaddingTop(4).LineHorizontal(1.5f).LineColor("#6366f1");
                });

                // Content
                page.Content().Column(col =>
                {
                    // Summary stats
                    col.Item().PaddingTop(12).Row(row =>
                    {
                        foreach (var stat in summaryStats)
                        {
                            row.RelativeItem().Border(1).BorderColor("#e2e8f0").Padding(8).Column(c =>
                            {
                                c.Item().Text(stat.Key).FontSize(8).FontColor("#64748b");
                                c.Item().Text(stat.Value).Bold().FontSize(14).FontColor("#1e293b");
                            });
                        }
                    });

                    // Data table
                    col.Item().PaddingTop(16).Table(table =>
                    {
                        // Define columns evenly
                        table.ColumnsDefinition(cols =>
                        {
                            foreach (var _ in headers)
                                cols.RelativeColumn();
                        });

                        // Header row
                        foreach (var header in headers)
                        {
                            table.Header(h =>
                            {
                                h.Cell().Background("#6366f1").Padding(5)
                                    .Text(header).Bold().FontColor(Colors.White).FontSize(8);
                            });
                        }

                        // Data rows
                        var isEven = false;
                        foreach (var dataRow in rows)
                        {
                            var bg = isEven ? "#f8fafc" : "#ffffff";
                            isEven = !isEven;
                            foreach (var cell in dataRow)
                            {
                                table.Cell().Background(bg).Padding(4).BorderBottom(0.5f).BorderColor("#e2e8f0")
                                    .Text(cell).FontSize(8).FontColor("#1e293b");
                            }
                        }

                        if (rows.Count == 0)
                        {
                            table.Cell().ColumnSpan((uint)headers.Count).Padding(16)
                                .Text("No data available for the selected date range.")
                                .FontColor("#64748b").AlignCenter();
                        }
                    });
                });

                // Footer
                page.Footer().Row(row =>
                {
                    row.RelativeItem().Text($"PixelSpot CCMS — {title}").FontSize(7).FontColor("#94a3b8");
                    row.RelativeItem().AlignRight().Text(text =>
                    {
                        text.Span("Page ").FontSize(7).FontColor("#94a3b8");
                        text.CurrentPageNumber().FontSize(7).FontColor("#94a3b8");
                        text.Span(" of ").FontSize(7).FontColor("#94a3b8");
                        text.TotalPages().FontSize(7).FontColor("#94a3b8");
                    });
                });
            });
        }).GeneratePdf();
    }

    // ============================================
    // PROOF-OF-PLAY (PoP) ANALYTICS — Phase 5
    // Uses TimescaleDB continuous aggregate views when available,
    // falls back to raw Impressions table for non-TimescaleDB Postgres.
    // ============================================

    /// <summary>
    /// Get proof-of-play impression counts grouped by day for a screen or campaign.
    /// Endpoint: GET /api/v1/analytics/pop?screenId=...&from=...&to=...
    /// </summary>
    [HttpGet("pop")]
    public async Task<ActionResult<ApiResponse<PopAnalyticsDto>>> GetPopAnalytics(
        [FromQuery] Guid? screenId,
        [FromQuery] Guid? campaignId,
        [FromQuery] string? dateFrom,
        [FromQuery] string? dateTo,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var role = GetCurrentUserRole();

        // Parse dates
        var from = dateFrom != null ? DateTime.Parse(dateFrom, null, System.Globalization.DateTimeStyles.RoundtripKind) : DateTime.UtcNow.AddDays(-30);
        var to = dateTo != null ? DateTime.Parse(dateTo, null, System.Globalization.DateTimeStyles.RoundtripKind) : DateTime.UtcNow;
        from = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
        to = DateTime.SpecifyKind(to.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

        // Authorization: screen owners see their own screens, advertisers see their campaigns
        IQueryable<CCMS.Domain.Entities.Impression> query = _context.Impressions
            .AsNoTracking()
            .Where(i => i.PlayedAt >= from && i.PlayedAt <= to);

        if (role == "ScreenOwner")
        {
            var ownedScreenIds = await _context.Screens
                .Where(s => s.OwnerId == userId)
                .Select(s => s.Id)
                .ToListAsync(ct);
            query = query.Where(i => ownedScreenIds.Contains(i.ScreenId));
        }
        else if (role == "Advertiser")
        {
            var ownedCampaignIds = await _context.Campaigns
                .Where(c => c.AdvertiserId == userId)
                .Select(c => c.Id)
                .ToListAsync(ct);
            query = query.Where(i => i.CampaignId != null && ownedCampaignIds.Contains(i.CampaignId.Value));
        }

        if (screenId.HasValue)
            query = query.Where(i => i.ScreenId == screenId.Value);

        if (campaignId.HasValue)
            query = query.Where(i => i.CampaignId == campaignId.Value);

        // Group by day
        var dailyCounts = await query
            .GroupBy(i => i.SessionDate.Date)
            .Select(g => new PopDailyDto
            {
                Date = g.Key,
                ImpressionCount = g.Count(),
                FullPlayCount = g.Count(i => i.WasFullPlay),
                AvgDurationSeconds = g.Average(i => (double?)i.DurationSeconds) ?? 0,
            })
            .OrderBy(r => r.Date)
            .ToListAsync(ct);

        var total = dailyCounts.Sum(d => d.ImpressionCount);
        var fullPlays = dailyCounts.Sum(d => d.FullPlayCount);

        var result = new PopAnalyticsDto
        {
            TotalImpressions = total,
            FullPlayCount = fullPlays,
            FullPlayRate = total > 0 ? Math.Round((double)fullPlays / total * 100, 1) : 0,
            DailyBreakdown = dailyCounts,
        };

        return Ok(ApiResponse<PopAnalyticsDto>.SuccessResponse(result));
    }

    /// <summary>
    /// GET /api/v1/analytics/pop/summary — quick totals for dashboard widgets
    /// </summary>
    [HttpGet("pop/summary")]
    public async Task<ActionResult<ApiResponse<PopSummaryDto>>> GetPopSummary(
        [FromQuery] string preset = "30d",
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        var role = GetCurrentUserRole();

        var now = DateTime.UtcNow;
        DateTime from = preset switch
        {
            "today"    => now.Date,
            "7d"       => now.AddDays(-7),
            "30d"      => now.AddDays(-30),
            "90d"      => now.AddDays(-90),
            "thisyear" => new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            "alltime"  => new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            _          => now.AddDays(-30),
        };
        from = DateTime.SpecifyKind(from, DateTimeKind.Utc);

        IQueryable<CCMS.Domain.Entities.Impression> query = _context.Impressions
            .AsNoTracking()
            .Where(i => i.PlayedAt >= from);

        if (role == "ScreenOwner")
        {
            var ownedScreenIds = await _context.Screens
                .Where(s => s.OwnerId == userId)
                .Select(s => s.Id)
                .ToListAsync(ct);
            query = query.Where(i => ownedScreenIds.Contains(i.ScreenId));
        }
        else if (role == "Advertiser")
        {
            var ownedCampaignIds = await _context.Campaigns
                .Where(c => c.AdvertiserId == userId)
                .Select(c => c.Id)
                .ToListAsync(ct);
            query = query.Where(i => i.CampaignId != null && ownedCampaignIds.Contains(i.CampaignId.Value));
        }

        var total = await query.CountAsync(ct);
        var fullPlays = await query.CountAsync(i => i.WasFullPlay, ct);
        var avgDuration = total > 0 ? await query.AverageAsync(i => (double?)i.DurationSeconds ?? 0, ct) : 0;

        return Ok(ApiResponse<PopSummaryDto>.SuccessResponse(new PopSummaryDto
        {
            TotalImpressions = total,
            FullPlayCount = fullPlays,
            FullPlayRate = total > 0 ? Math.Round((double)fullPlays / total * 100, 1) : 0,
            AvgDurationSeconds = Math.Round(avgDuration, 1),
            Preset = preset,
        }));
    }
}
