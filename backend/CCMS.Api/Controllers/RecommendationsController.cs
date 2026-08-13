using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/recommendations")]
[Authorize]
public class RecommendationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RecommendationsController> _logger;

    public RecommendationsController(ApplicationDbContext context, ILogger<RecommendationsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private Guid GetCurrentUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value!);

    /// <summary>Get AI-scored screen recommendations for a campaign objective</summary>
    [HttpPost("screens")]
    [Authorize(Roles = "Advertiser,Admin")]
    public async Task<IActionResult> GetRecommendedScreens([FromBody] ScreenRecommendationRequest request)
    {
        try
        {
            var advertiserId = GetCurrentUserId();

            // Load candidate screens
            var screensQuery = _context.Screens.AsNoTracking()
                .Where(s => s.Status == ScreenStatus.Active)
                .Include(s => s.Owner)
                .Include(s => s.Images.Where(i => i.IsPrimary))
                .Include(s => s.TagAssignments).ThenInclude(ta => ta.Tag)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(request.TargetCity))
                screensQuery = screensQuery.Where(s => s.Location.City.ToLower().Contains(request.TargetCity.ToLower()));

            var screens = await screensQuery.Take(200).ToListAsync();

            // Historical bookings for this advertiser (for historicalSuccessScore)
            var campaignIds = await _context.Campaigns.AsNoTracking()
                .Where(c => c.AdvertiserId == advertiserId)
                .Select(c => c.Id)
                .ToListAsync();

            var previousBookings = await _context.Bookings.AsNoTracking()
                .Where(b => b.CampaignId.HasValue && campaignIds.Contains(b.CampaignId.Value))
                .Select(b => new { b.ScreenId, b.Status })
                .ToListAsync();

            var bookedScreenIds = previousBookings.Where(b => b.Status == BookingStatus.Completed || b.Status == BookingStatus.Active).Select(b => b.ScreenId).ToHashSet();
            var rejectedScreenIds = previousBookings.Where(b => b.Status == BookingStatus.Rejected).Select(b => b.ScreenId).ToHashSet();

            // Category -> screen type mapping for categoryMatch
            static bool CategoryMatchesObjective(string objective, string screenType)
            {
                return objective switch
                {
                    "footfall" => screenType is "Mall" or "Transit" or "Metro",
                    "brand_awareness" => true,
                    "sales" => screenType is "Mall" or "Retail",
                    "engagement" => screenType is "Mall" or "Event" or "Entertainment",
                    _ => false
                };
            }

            var dateFrom = string.IsNullOrEmpty(request.DateFrom) ? DateOnly.FromDateTime(DateTime.Today) : DateOnly.Parse(request.DateFrom);
            var dateTo = string.IsNullOrEmpty(request.DateTo) ? dateFrom.AddDays(30) : DateOnly.Parse(request.DateTo);

            var scored = screens.Select(s =>
            {
                // 1. categoryMatch (0.30)
                var catTags = s.TagAssignments?.Select(ta => ta.Tag?.DisplayName ?? string.Empty).ToList() ?? new List<string>();
                var catMatch = catTags.Any(t => CategoryMatchesObjective(request.Objective, t)) ? 1.0m : 0.5m;
                var categoryScore = catMatch * 100m * 0.30m;

                // 2. locationProximityScore (0.25)
                decimal locScore = 50m;
                if (request.TargetLat.HasValue && request.TargetLng.HasValue && s.Latitude != 0 && s.Longitude != 0)
                {
                    var dist = HaversineKm((double)request.TargetLat.Value, (double)request.TargetLng.Value,
                        (double)s.Latitude, (double)s.Longitude);
                    locScore = dist < 1 ? 100m : dist < 5 ? 70m : dist < 10 ? 40m : 10m;
                }
                var locationScore = locScore * 0.25m;

                // 3. budgetFitScore (0.20)
                var estimatedDays = (dateTo.DayNumber - dateFrom.DayNumber) + 1;
                var screenCost = s.PricePerSlot * 6 * estimatedDays;
                var budgetFit = request.Budget > 0 && screenCost > 0
                    ? Math.Min((decimal)request.Budget / screenCost, 1m) * 100m
                    : 50m;
                var budgetScore = budgetFit * 0.20m;

                // 4. normalizedAqs (0.15)
                var aqsScore = (decimal)s.AudienceQualityScore * 0.15m;

                // 5. historicalSuccessScore (0.10)
                decimal histScore = 50m;
                if (bookedScreenIds.Contains(s.Id)) histScore = 80m;
                else if (rejectedScreenIds.Contains(s.Id)) histScore = 20m;
                var historyScore = histScore * 0.10m;

                var totalScore = Math.Round(categoryScore + locationScore + budgetScore + aqsScore + historyScore, 1);

                var reasons = new List<string>();
                if (catMatch > 0.9m) reasons.Add("Category match");
                if (locScore >= 70) reasons.Add($"{locScore:0}% proximity score");
                if (s.AudienceQualityScore >= 70) reasons.Add($"High AQS {s.AudienceQualityScore}");
                if (bookedScreenIds.Contains(s.Id)) reasons.Add("Previously successful");

                return new
                {
                    screen = new
                    {
                        s.Id,
                        s.Name,
                        s.Description,
                        s.Latitude,
                        s.Longitude,
                        Location = s.Location,
                        s.PricePerSlot,
                        s.Currency,
                        s.AudienceQualityScore,
                        s.Status,
                        PrimaryImageUrl = s.Images?.FirstOrDefault()?.ImageUrl,
                        ScoreBreakdown = new
                        {
                            CategoryScore = Math.Round(categoryScore, 1),
                            LocationScore = Math.Round(locationScore, 1),
                            BudgetScore = Math.Round(budgetScore, 1),
                            AqsScore = Math.Round(aqsScore, 1),
                            HistoryScore = Math.Round(historyScore, 1),
                        }
                    },
                    matchScore = totalScore,
                    matchReasons = reasons
                };
            })
            .OrderByDescending(x => x.matchScore)
            .Take(50)
            .ToList();

            return Ok(new { screens = scored });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error computing screen recommendations");
            return StatusCode(500, new { error = "Error computing recommendations" });
        }
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}

public class ScreenRecommendationRequest
{
    public string Objective { get; set; } = "brand_awareness";
    public string TargetCity { get; set; } = string.Empty;
    public decimal? TargetLat { get; set; }
    public decimal? TargetLng { get; set; }
    public decimal? TargetRadius { get; set; }
    public List<string> Categories { get; set; } = new();
    public decimal Budget { get; set; }
    public string DateFrom { get; set; } = string.Empty;
    public string DateTo { get; set; } = string.Empty;
}
