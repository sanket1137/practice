using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Services;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Reports;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/reports")]
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

            // Default to booking period if no dates provided (convert DateOnly to DateTime)
            var from = startDate ?? booking.StartDate.ToDateTime(TimeOnly.MinValue);
            var to = endDate ?? booking.EndDate.ToDateTime(TimeOnly.MaxValue);
            
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

            // Default to campaign period if no dates provided (convert DateOnly to DateTime)
            var from = startDate ?? campaign.StartDate.ToDateTime(TimeOnly.MinValue);
            var to = endDate ?? campaign.EndDate?.ToDateTime(TimeOnly.MaxValue) ?? DateTime.UtcNow;
            
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

            var from = startDate ?? campaign.StartDate.ToDateTime(TimeOnly.MinValue);
            var to = endDate ?? campaign.EndDate?.ToDateTime(TimeOnly.MaxValue) ?? DateTime.UtcNow;
            
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

            var from = startDate ?? booking.StartDate.ToDateTime(TimeOnly.MinValue);
            var to = endDate ?? booking.EndDate.ToDateTime(TimeOnly.MaxValue);
            
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

    /// <summary>
    /// Owner-wide proof-of-play log across all of the caller's screens, filterable
    /// by screen / campaign / booking / date range. This is the log an owner hands
    /// an advertiser when asked "prove my ad played": every entry carries the
    /// screen, campaign, advertiser, slot, duration, and verification flag.
    /// </summary>
    [HttpGet("owner/play-log")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> GetOwnerPlayLog(
        [FromQuery] Guid? screenId = null,
        [FromQuery] Guid? campaignId = null,
        [FromQuery] Guid? bookingId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? contentType = null,   // all | campaign | house
        [FromQuery] string? quality = null,       // all | full | partial
        [FromQuery] string? verification = null,  // all | verified | late
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var isAdmin = User.IsInRole("Admin");

            var screenIdsQuery = _context.Screens.Where(s => !s.IsDeleted);
            if (!isAdmin) screenIdsQuery = screenIdsQuery.Where(s => s.OwnerId == userId);
            if (screenId.HasValue) screenIdsQuery = screenIdsQuery.Where(s => s.Id == screenId.Value);
            var screenIds = await screenIdsQuery.Select(s => s.Id).ToListAsync();
            if (screenIds.Count == 0)
                return Ok(ApiResponse<object>.SuccessResponse(new { totalCount = 0, page, pageSize, totals = new { plays = 0, fullPlays = 0, verified = 0 }, entries = Array.Empty<object>() }));

            var fromUtc = DateTime.SpecifyKind((from ?? DateTime.UtcNow.AddDays(-7)).Date, DateTimeKind.Utc);
            var toUtc = DateTime.SpecifyKind((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var query = _context.Impressions.AsNoTracking()
                .Where(i => screenIds.Contains(i.ScreenId) && i.PlayedAt >= fromUtc && i.PlayedAt <= toUtc);
            if (campaignId.HasValue) query = query.Where(i => i.CampaignId == campaignId.Value);
            if (bookingId.HasValue) query = query.Where(i => i.BookingId == bookingId.Value);
            if (contentType == "campaign") query = query.Where(i => i.OwnerContentId == null);
            else if (contentType == "house") query = query.Where(i => i.OwnerContentId != null);
            if (quality == "full") query = query.Where(i => i.WasFullPlay);
            else if (quality == "partial") query = query.Where(i => !i.WasFullPlay);
            if (verification == "verified") query = query.Where(i => i.IsVerified);
            else if (verification == "late") query = query.Where(i => !i.IsVerified);

            var totalCount = await query.CountAsync();
            var fullPlays = await query.CountAsync(i => i.WasFullPlay);
            var verified = await query.CountAsync(i => i.IsVerified);

            var entries = await query
                .OrderByDescending(i => i.PlayedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new
                {
                    playedAt = i.PlayedAt,
                    screenId = i.ScreenId,
                    screenName = _context.Screens.Where(s => s.Id == i.ScreenId).Select(s => s.Name).FirstOrDefault(),
                    campaignId = i.CampaignId,
                    campaignName = i.CampaignId != null
                        ? _context.Campaigns.Where(c => c.Id == i.CampaignId).Select(c => c.Name).FirstOrDefault()
                        : null,
                    advertiserName = i.CampaignId != null
                        ? _context.Campaigns.Where(c => c.Id == i.CampaignId)
                            .Join(_context.Users, c => c.AdvertiserId, u => u.Id,
                                (c, u) => u.CompanyName ?? (u.FirstName + " " + u.LastName))
                            .FirstOrDefault()
                        : null,
                    bookingId = i.BookingId,
                    isHouseContent = i.OwnerContentId != null,
                    slotPosition = i.SlotPosition,
                    durationSeconds = i.DurationSeconds,
                    wasFullPlay = i.WasFullPlay,
                    isVerified = i.IsVerified,
                    // Proof fields: device-side identity + tamper-evidence hashes,
                    // plus every raw value the canonical record hash is built from,
                    // so exports are independently recomputable without trusting us.
                    impressionId = i.ImpressionId,
                    slotPlayKey = i.SlotPlayKey,
                    verificationHash = i.VerificationHash,
                    canonicalId = i.ImpressionId ?? i.Id.ToString(),
                    playedAtTicks = i.PlayedAt.Ticks,
                    ownerContentId = i.OwnerContentId
                })
                .ToListAsync();

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                from = fromUtc,
                to = toUtc,
                totals = new { plays = totalCount, fullPlays, verified },
                entries
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error building owner play log");
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Error fetching play log"));
        }
    }

    /// <summary>
    /// Price/reach estimate for a selection of screens over a date range —
    /// the Plan tray's numbers, priced through the REAL booking engine (per-day
    /// pricing rules included) so the tray always equals checkout. Also the
    /// data source for the proposal PDF, so the document can never disagree
    /// with the estimate the buyer saw.
    /// </summary>
    [HttpPost("proposal/estimate")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> EstimateProposal(
        [FromBody] ProposalRequest request,
        [FromServices] CCMS.Application.Services.BookingCalculationService calculationService,
        [FromServices] CCMS.Application.Services.SlotAvailabilityService availabilityService)
    {
        try
        {
            var plan = await BuildPlanAsync(request, calculationService, availabilityService);
            if (plan == null)
                return BadRequest(ApiResponse<object>.ErrorResponse("Pick 1–20 screens and a valid date range."));
            return Ok(ApiResponse<object>.SuccessResponse(plan));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error estimating proposal");
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Estimate failed"));
        }
    }

    /// <summary>
    /// The client-ready proposal PDF: plan summary, per-screen spec cards
    /// (type, environment, resolution, physical size, audience, footfall,
    /// prices from the real engine), creative spec sheet, and the proof
    /// promise. Same numbers as the estimate — one source of truth.
    /// </summary>
    [HttpPost("proposal")]
    [Authorize]
    public async Task<IActionResult> DownloadProposal(
        [FromBody] ProposalRequest request,
        [FromServices] CCMS.Application.Services.BookingCalculationService calculationService,
        [FromServices] CCMS.Application.Services.SlotAvailabilityService availabilityService,
        [FromServices] CCMS.Application.Interfaces.IFileStorageService fileStorage)
    {
        try
        {
            var plan = await BuildPlanAsync(request, calculationService, availabilityService);
            if (plan == null)
                return BadRequest("Pick 1–20 screens and a valid date range.");

            // Resolve stored image URLs to bytes for embedding. A missing or
            // unreadable image never blocks the document — the card simply
            // renders without that photo.
            var imageBytes = new Dictionary<Guid, List<byte[]>>();
            foreach (var item in plan.Screens)
            {
                var list = new List<byte[]>();
                foreach (var url in item.ImageUrls.Take(2))
                {
                    try
                    {
                        await using var stream = await fileStorage.GetFileAsync(url);
                        using var ms = new MemoryStream();
                        await stream.CopyToAsync(ms);
                        if (ms.Length > 0 && ms.Length <= 15 * 1024 * 1024)
                            list.Add(ms.ToArray());
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Proposal image fetch failed for {Url}", url);
                    }
                }
                if (list.Count > 0) imageBytes[item.ScreenId] = list;
            }

            var pdf = _exportService.ExportProposalToPdf(plan, imageBytes);
            return File(pdf, "application/pdf",
                $"pixelspot-media-plan-{request.From:yyyy-MM-dd}-to-{request.To:yyyy-MM-dd}.pdf");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating proposal PDF");
            return StatusCode(500, "Proposal generation failed");
        }
    }

    private async Task<ProposalPlan?> BuildPlanAsync(
        ProposalRequest request,
        CCMS.Application.Services.BookingCalculationService calculationService,
        CCMS.Application.Services.SlotAvailabilityService availabilityService)
    {
        if (request.ScreenIds == null || request.ScreenIds.Count is 0 or > 20) return null;
        var from = request.From.Date;
        var to = request.To.Date;
        if (to < from || (to - from).TotalDays > 92) return null;

        var screens = await _context.Screens
            .Where(s => request.ScreenIds.Contains(s.Id) && !s.IsDeleted
                        && s.Status == Domain.Enums.ScreenStatus.Active)
            .ToListAsync();
        if (screens.Count == 0) return null;

        var screenIds = screens.Select(s => s.Id).ToList();
        var tagsByScreen = (await _context.ScreenTagAssignments.AsNoTracking()
                .Where(a => screenIds.Contains(a.ScreenId))
                .OrderByDescending(a => a.IsPrimary).ThenByDescending(a => a.Score)
                .Select(a => new { a.ScreenId, a.Tag.DisplayName })
                .ToListAsync())
            .GroupBy(t => t.ScreenId)
            .ToDictionary(g => g.Key, g => g.Select(t => t.DisplayName).Distinct().Take(5).ToList());
        // Screen photo first (primary leading), then one surrounding shot — the
        // proposal shows at most two images per screen.
        var imagesByScreen = (await _context.ScreenImages.AsNoTracking()
                .Where(i => screenIds.Contains(i.ScreenId) && !i.IsDeleted)
                .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder)
                .Select(i => new { i.ScreenId, i.ImageUrl, i.ImageType })
                .ToListAsync())
            .GroupBy(i => i.ScreenId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var screenShot = g.Where(x => x.ImageType == Domain.Enums.ScreenImageType.Screen)
                        .Select(x => x.ImageUrl).FirstOrDefault();
                    var surrounding = g.Where(x => x.ImageType == Domain.Enums.ScreenImageType.Surrounding)
                        .Select(x => x.ImageUrl).FirstOrDefault();
                    return new[] { screenShot, surrounding }.Where(u => !string.IsNullOrWhiteSpace(u))
                        .Select(u => u!).ToList();
                });

        var items = new List<ProposalScreenItem>();
        foreach (var screen in screens)
        {
            var calc = await calculationService.CalculateBookingWithAvailability(
                screen, 1, from, to, availabilityService);
            var playsRange = calc.DailyBreakdown.Where(d => d.IsAvailable).Sum(d => d.Frames);
            var availableDays = calc.DailyBreakdown.Count(d => d.IsAvailable);
            items.Add(new ProposalScreenItem
            {
                ScreenId = screen.Id,
                Name = screen.Name,
                City = screen.Location?.City ?? "",
                State = screen.Location?.State ?? "",
                ScreenType = screen.ScreenType.ToString(),
                VenueType = screen.VenueType == Domain.Enums.VenueType.Unclassified
                    ? "" : screen.VenueType.ToString(),
                Description = screen.Description ?? "",
                Tags = tagsByScreen.GetValueOrDefault(screen.Id) ?? new List<string>(),
                ImageUrls = imagesByScreen.GetValueOrDefault(screen.Id) ?? new List<string>(),
                Environment = screen.DisplayType.ToString(),
                Orientation = screen.Orientation.ToString(),
                ResolutionWidth = screen.ResolutionWidth,
                ResolutionHeight = screen.ResolutionHeight,
                PhysicalSize = screen.PhysicalWidth > 0
                    ? $"{screen.PhysicalWidth:0.#} × {screen.PhysicalHeight:0.#} {screen.DimensionUnit}" : "—",
                SlotSeconds = screen.SlotsPerFrame > 0
                    ? (int)Math.Round(screen.TimeFrameMinutes * 60.0 / screen.SlotsPerFrame) : 0,
                Aqs = screen.AudienceQualityScore,
                DailyFootfall = screen.DailyTotalImpressions,
                PricePerSlot = screen.PricePerSlot,
                Currency = screen.Currency,
                AvailableDays = availableDays,
                TotalDays = calc.DailyBreakdown.Count,
                EstPlays = playsRange,
                EstCost = Math.Round(calc.TotalCost, 0),
            });
        }

        return new ProposalPlan
        {
            PreparedFor = string.IsNullOrWhiteSpace(request.PreparedFor) ? null : request.PreparedFor.Trim(),
            From = from,
            To = to,
            Days = (int)(to - from).TotalDays + 1,
            Currency = items[0].Currency,
            Screens = items.OrderByDescending(i => i.EstCost).ToList(),
            TotalFootfallPerDay = items.Sum(i => (long)i.DailyFootfall),
            TotalEstPlays = items.Sum(i => (long)i.EstPlays),
            TotalEstCost = items.Sum(i => i.EstCost),
            GeneratedAt = DateTime.UtcNow,
        };
    }

    /// <summary>
    /// Ledger integrity for one screen's play log: a per-screen, per-day hash
    /// chain. Every closed UTC day is sealed exactly once — RecordsRoot is the
    /// SHA-256 digest of the day's canonical impression records, and each
    /// SealHash binds that root to the previous day's seal. Verification
    /// recomputes every root from the raw records live and re-derives every
    /// link, so this endpoint PROVES integrity on each call rather than
    /// asserting it. Editing or deleting any historical play breaks the chain
    /// visibly.
    /// </summary>
    [HttpGet("owner/play-log/integrity")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> GetPlayLogIntegrity(
        [FromQuery] Guid screenId,
        [FromQuery] int days = 30)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var isAdmin = User.IsInRole("Admin");

            var screen = await _context.Screens.AsNoTracking()
                .Where(s => s.Id == screenId && !s.IsDeleted)
                .Select(s => new { s.OwnerId, s.Name })
                .FirstOrDefaultAsync();
            if (screen == null)
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            if (!isAdmin && screen.OwnerId != userId)
                return Forbid();

            days = Math.Clamp(days, 1, 90);
            var todayUtc = DateTime.UtcNow.Date;

            // ── Seal any not-yet-sealed closed days, in order, so the chain is
            // contiguous from the first recorded play to yesterday. ──
            var firstPlay = await _context.Impressions
                .Where(i => i.ScreenId == screenId)
                .OrderBy(i => i.PlayedAt)
                .Select(i => (DateTime?)i.PlayedAt)
                .FirstOrDefaultAsync();

            if (firstPlay.HasValue)
            {
                var lastSealedDay = await _context.PlayLogSeals
                    .Where(s => s.ScreenId == screenId)
                    .MaxAsync(s => (DateTime?)s.Day);
                var sealFrom = lastSealedDay?.AddDays(1) ?? firstPlay.Value.Date;
                // Bounded per request; older backlog completes across calls.
                var sealed_ = 0;
                for (var day = sealFrom; day < todayUtc && sealed_ < 120; day = day.AddDays(1), sealed_++)
                {
                    await SealDayAsync(screenId, DateTime.SpecifyKind(day, DateTimeKind.Utc));
                }
            }

            // ── Load the window and verify every link live. ──
            var windowFrom = todayUtc.AddDays(-days);
            var seals = await _context.PlayLogSeals.AsNoTracking()
                .Where(s => s.ScreenId == screenId && s.Day >= windowFrom)
                .OrderBy(s => s.Day)
                .ToListAsync();

            // The link before the window anchors the first in-window check.
            var anchor = await _context.PlayLogSeals.AsNoTracking()
                .Where(s => s.ScreenId == screenId && s.Day < windowFrom)
                .OrderByDescending(s => s.Day)
                .FirstOrDefaultAsync();

            var chainIntact = true;
            var results = new List<object>();
            var prevHash = anchor?.SealHash;
            foreach (var seal in seals)
            {
                var liveRoot = await ComputeDayRootAsync(screenId, seal.Day);
                var rootMatches = string.Equals(liveRoot.root, seal.RecordsRoot, StringComparison.OrdinalIgnoreCase)
                                  && liveRoot.count == seal.RecordCount;
                var linkOk = prevHash == null || string.Equals(seal.PrevSealHash, prevHash, StringComparison.OrdinalIgnoreCase);
                var sealOk = string.Equals(
                    ComputeSealHash(screenId, seal.Day, seal.RecordCount, seal.RecordsRoot, seal.PrevSealHash),
                    seal.SealHash, StringComparison.OrdinalIgnoreCase);
                if (!(rootMatches && linkOk && sealOk)) chainIntact = false;

                results.Add(new
                {
                    day = seal.Day.ToString("yyyy-MM-dd"),
                    recordCount = seal.RecordCount,
                    recordsRoot = seal.RecordsRoot,
                    prevSealHash = seal.PrevSealHash,
                    sealHash = seal.SealHash,
                    sealedAt = seal.SealedAt,
                    verified = rootMatches && linkOk && sealOk,
                });
                prevHash = seal.SealHash;
            }
            results.Reverse(); // newest first for display

            var pendingToday = await _context.Impressions
                .CountAsync(i => i.ScreenId == screenId && i.PlayedAt >= todayUtc);

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                screenId,
                screenName = screen.Name,
                algorithm = "SHA-256 hash chain: per-record canonical hash → daily RecordsRoot → SealHash = SHA256(screenId|day|count|root|prevSeal)",
                verifiedAt = DateTime.UtcNow,
                chainIntact,
                sealedDays = seals.Count,
                latestSealHash = seals.LastOrDefault()?.SealHash ?? anchor?.SealHash,
                pendingToday,
                note = "Today's plays are still accumulating and seal automatically when the UTC day closes. " +
                       "Each 'verified' flag means this call recomputed the day's digest from the raw records " +
                       "just now and it matched the stored seal and its chain link.",
                days = results
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying play-log integrity for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Integrity check failed"));
        }
    }

    /// <summary>Canonical per-day digest: sorted records → per-record SHA-256 → SHA-256 of the concatenation.</summary>
    private async Task<(string root, int count)> ComputeDayRootAsync(Guid screenId, DateTime dayUtc)
    {
        var next = dayUtc.AddDays(1);
        // Ordering ties break on SlotPlayKey (unique and present in exports),
        // never on the internal row id — so an outside party holding only the
        // exported CSV can reproduce the exact same sequence and digest.
        var records = await _context.Impressions.AsNoTracking()
            .Where(i => i.ScreenId == screenId && i.PlayedAt >= dayUtc && i.PlayedAt < next)
            .OrderBy(i => i.PlayedAt).ThenBy(i => i.SlotPlayKey)
            .Select(i => new
            {
                i.Id, i.ImpressionId, i.SlotPlayKey, i.PlayedAt, i.BookingId, i.CampaignId,
                i.OwnerContentId, i.SlotPosition, i.DurationSeconds, i.WasFullPlay
            })
            .ToListAsync();

        var sb = new System.Text.StringBuilder();
        foreach (var r in records)
        {
            var canonical =
                $"{r.ImpressionId ?? r.Id.ToString()}|{r.SlotPlayKey}|{r.PlayedAt.Ticks}|{r.BookingId}|" +
                $"{r.CampaignId}|{r.OwnerContentId}|{r.SlotPosition}|{r.DurationSeconds}|{r.WasFullPlay}";
            sb.Append(Sha256Hex(canonical));
        }
        return (Sha256Hex(sb.ToString()), records.Count);
    }

    private static string ComputeSealHash(Guid screenId, DateTime day, int count, string root, string prev) =>
        Sha256Hex($"{screenId:D}|{day:yyyy-MM-dd}|{count}|{root}|{prev}");

    private static string Sha256Hex(string input)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    /// <summary>Seal one closed day (idempotent — the unique (ScreenId, Day) index guards races).</summary>
    private async Task SealDayAsync(Guid screenId, DateTime dayUtc)
    {
        if (await _context.PlayLogSeals.AnyAsync(s => s.ScreenId == screenId && s.Day == dayUtc)) return;

        var prev = await _context.PlayLogSeals
            .Where(s => s.ScreenId == screenId && s.Day < dayUtc)
            .OrderByDescending(s => s.Day)
            .Select(s => s.SealHash)
            .FirstOrDefaultAsync() ?? "GENESIS";

        var (root, count) = await ComputeDayRootAsync(screenId, dayUtc);
        var seal = new PlayLogSeal
        {
            ScreenId = screenId,
            Day = dayUtc,
            RecordCount = count,
            RecordsRoot = root,
            PrevSealHash = prev,
            SealHash = ComputeSealHash(screenId, dayUtc, count, root, prev),
            SealedAt = DateTime.UtcNow,
        };
        _context.PlayLogSeals.Add(seal);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // A concurrent request sealed the same day first — theirs stands.
            _context.Entry(seal).State = EntityState.Detached;
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
            BookingPeriod = new DateRange { StartDate = booking.StartDate.ToDateTime(TimeOnly.MinValue), EndDate = booking.EndDate.ToDateTime(TimeOnly.MaxValue) },
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
            CampaignPeriod = new DateRange { StartDate = campaign.StartDate.ToDateTime(TimeOnly.MinValue), EndDate = campaign.EndDate?.ToDateTime(TimeOnly.MaxValue) ?? DateTime.UtcNow },
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

            var from = startDate ?? booking.StartDate.ToDateTime(TimeOnly.MinValue);
            var to = endDate ?? booking.EndDate.ToDateTime(TimeOnly.MaxValue);
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

            var from = startDate ?? campaign.StartDate.ToDateTime(TimeOnly.MinValue);
            var to = endDate ?? campaign.EndDate?.ToDateTime(TimeOnly.MaxValue) ?? DateTime.UtcNow;
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

            var from = startDate ?? booking.StartDate.ToDateTime(TimeOnly.MinValue);
            var to = endDate ?? booking.EndDate.ToDateTime(TimeOnly.MaxValue);
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

    /// <summary>
    /// Get delivery summary for admin review before final payout release.
    /// Shows impression delivery stats, advance paid, remaining amount.
    /// </summary>
    [HttpGet("bookings/{bookingId}/delivery-summary")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<DeliverySummaryDto>>> GetDeliverySummary(Guid bookingId)
    {
        try
        {
            var booking = await _context.Bookings
                .Include(b => b.Screen)
                .Include(b => b.Campaign)
                .Include(b => b.Payouts)
                .FirstOrDefaultAsync(b => b.Id == bookingId);

            if (booking == null)
                return NotFound(ApiResponse<DeliverySummaryDto>.ErrorResponse("Booking not found"));

            var from = DateTime.SpecifyKind(booking.StartDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            var to = DateTime.SpecifyKind(booking.EndDate.ToDateTime(TimeOnly.MaxValue), DateTimeKind.Utc);

            // Get daily impression counts
            var dailyData = await _context.Impressions
                .Where(i => i.BookingId == bookingId && i.PlayedAt >= from && i.PlayedAt <= to)
                .GroupBy(i => i.PlayedAt.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Count = g.Count(),
                    Verified = g.Count(i => i.IsVerified)
                })
                .ToListAsync();

            var totalImpressions = dailyData.Sum(d => d.Count);
            var verifiedImpressions = dailyData.Sum(d => d.Verified);

            var totalDays = (booking.EndDate.ToDateTime(TimeOnly.MinValue) - booking.StartDate.ToDateTime(TimeOnly.MinValue)).Days + 1;
            var activeDays = dailyData.Count;

            var advancePaid = booking.Payouts?
                .Where(p => p.Type == Domain.Enums.PayoutType.Advance && p.Status == Domain.Enums.PayoutStatus.Completed)
                .Sum(p => p.NetAmount) ?? 0m;

            // Build daily breakdown for the full booking period
            var dailyBreakdown = new List<DailyDeliveryEntry>();
            for (var date = booking.StartDate; date <= booking.EndDate; date = date.AddDays(1))
            {
                var dayData = dailyData.FirstOrDefault(d => DateOnly.FromDateTime(d.Date) == date);
                dailyBreakdown.Add(new DailyDeliveryEntry
                {
                    Date = date.ToString("yyyy-MM-dd"),
                    Impressions = dayData?.Count ?? 0,
                    VerifiedImpressions = dayData?.Verified ?? 0,
                    HasData = dayData != null
                });
            }

            var summary = new DeliverySummaryDto
            {
                BookingId = bookingId,
                ScreenName = booking.Screen?.Name ?? "Unknown",
                CampaignName = booking.Campaign?.Name,
                StartDate = booking.StartDate.ToString("yyyy-MM-dd"),
                EndDate = booking.EndDate.ToString("yyyy-MM-dd"),
                ExpectedImpressions = booking.ExpectedImpressions,
                DeliveredImpressions = totalImpressions,
                VerifiedImpressions = verifiedImpressions,
                DeliveryRate = booking.ExpectedImpressions > 0
                    ? Math.Round((decimal)totalImpressions / booking.ExpectedImpressions * 100, 2)
                    : 0,
                TotalDays = totalDays,
                ActiveDays = activeDays,
                TotalPrice = booking.TotalPrice,
                Currency = booking.Currency,
                AdvancePaid = advancePaid,
                RemainingAmount = booking.TotalPrice - advancePaid,
                DailyBreakdown = dailyBreakdown
            };

            return Ok(ApiResponse<DeliverySummaryDto>.SuccessResponse(summary));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating delivery summary for {BookingId}", bookingId);
            return StatusCode(500, ApiResponse<DeliverySummaryDto>.ErrorResponse("Error generating delivery summary"));
        }
    }

    #endregion
}

/// <summary>Request body for proposal estimate + PDF.</summary>
public class ProposalRequest
{
    public List<Guid> ScreenIds { get; set; } = new();
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public string? PreparedFor { get; set; }
}

public class ProposalScreenItem
{
    public Guid ScreenId { get; set; }
    public string Name { get; set; } = "";
    public string City { get; set; } = "";
    public string State { get; set; } = "";
    public string ScreenType { get; set; } = "";
    public string VenueType { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> Tags { get; set; } = new();
    /// <summary>Stored image URLs (screen photo first, then surrounding) — resolved to bytes only for the PDF.</summary>
    public List<string> ImageUrls { get; set; } = new();
    public string Environment { get; set; } = "";
    public string Orientation { get; set; } = "";
    public int ResolutionWidth { get; set; }
    public int ResolutionHeight { get; set; }
    public string PhysicalSize { get; set; } = "";
    public int SlotSeconds { get; set; }
    public decimal Aqs { get; set; }
    public int DailyFootfall { get; set; }
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "INR";
    public int AvailableDays { get; set; }
    public int TotalDays { get; set; }
    public int EstPlays { get; set; }
    public decimal EstCost { get; set; }
}

public class ProposalPlan
{
    public string? PreparedFor { get; set; }
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public int Days { get; set; }
    public string Currency { get; set; } = "INR";
    public List<ProposalScreenItem> Screens { get; set; } = new();
    public long TotalFootfallPerDay { get; set; }
    public long TotalEstPlays { get; set; }
    public decimal TotalEstCost { get; set; }
    public DateTime GeneratedAt { get; set; }
}
