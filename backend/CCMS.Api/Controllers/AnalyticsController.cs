using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Analytics;
using System.Security.Claims;

namespace CCMS.Api.Controllers;

[ApiController]
[Route("api/analytics")]
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
                .Where(b => campaignIds.Contains(b.CampaignId))
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
                .Where(b => campaignIds.Contains(b.CampaignId) && b.CreatedAt >= startDate);
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
}
