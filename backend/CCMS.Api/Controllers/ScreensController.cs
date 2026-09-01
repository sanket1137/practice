using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Extensions;
using CCMS.Application.Features.Screens.Commands;
using CCMS.Application.Features.Screens.Queries;
using CCMS.Application.Features.OwnerContent.Commands;
using CCMS.Application.Features.OwnerContent.Queries;
using CCMS.Application.Interfaces;
using CCMS.Infrastructure.Services;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Screens;
using CCMS.Shared.DTOs.OwnerContent;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class ScreensController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ScreenTaggingService _taggingService;
    private readonly ApplicationDbContext _context;
    private readonly IScreenImageService _imageService;
    private readonly CCMS.Api.Services.ScreenLifecycleService _lifecycleService;
    private readonly ILogger<ScreensController> _logger;

    public ScreensController(
        IMediator mediator,
        ScreenTaggingService taggingService,
        ApplicationDbContext context,
        IScreenImageService imageService,
        CCMS.Api.Services.ScreenLifecycleService lifecycleService,
        ILogger<ScreensController> logger)
    {
        _mediator = mediator;
        _taggingService = taggingService;
        _context = context;
        _imageService = imageService;
        _lifecycleService = lifecycleService;
        _logger = logger;
    }

    // ==========================================
    // LIFECYCLE — the only way status changes
    // ==========================================

    /// <summary>
    /// Current lifecycle state + the actions available from it. The UI renders
    /// its lifecycle buttons from this response — never from client-side rules.
    /// </summary>
    [HttpGet("{id}/lifecycle")]
    public async Task<ActionResult<ApiResponse<object>>> GetLifecycle(Guid id)
    {
        var screen = await _context.Screens.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (screen == null)
            return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        if (screen.OwnerId != userId && !User.IsInRole("Admin"))
            return StatusCode(403, ApiResponse<object>.ErrorResponse("You can only view your own screens"));

        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            status = screen.Status.ToString(),
            verificationStatus = screen.VerificationStatus.ToString(),
            isOnline = screen.IsOnline,
            allowedActions = CCMS.Api.Services.ScreenLifecycleService.AllowedActions(screen)
                .Select(a => a.ToString()).ToList(),
        }));
    }

    public class LifecycleActionRequest
    {
        public string? Reason { get; set; }
    }

    /// <summary>
    /// Perform a lifecycle transition. Action names match ScreenLifecycleAction:
    /// SubmitForVerification | Activate | Pause | Resume | StartMaintenance |
    /// EndMaintenance | Archive. Guards (verification, device pairing, active
    /// bookings) are enforced server-side and returned as plain-language errors.
    /// </summary>
    [HttpPost("{id}/lifecycle/{action}")]
    public async Task<ActionResult<ApiResponse<object>>> Transition(
        Guid id, string action, [FromBody] LifecycleActionRequest? request)
    {
        if (!Enum.TryParse<CCMS.Api.Services.ScreenLifecycleAction>(action, ignoreCase: true, out var parsed))
            return BadRequest(ApiResponse<object>.ErrorResponse($"Unknown lifecycle action '{action}'."));

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _lifecycleService.TransitionAsync(
            id, parsed, userId, User.IsInRole("Admin"), request?.Reason);

        if (!result.Success)
            return BadRequest(ApiResponse<object>.ErrorResponse(result.Error ?? "Transition not allowed"));

        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            status = result.Status.ToString(),
            allowedActions = result.AllowedActions,
        }));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<ScreenDto>>>> GetAll()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse<IEnumerable<ScreenDto>>.ErrorResponse("User not authenticated"));

            var userGuid = Guid.Parse(userId);
            var isScreenOwner = User.IsInRole("ScreenOwner");
            
            var query = new GetScreensQuery();
            
            // Screen owners see ONLY their own screens
            // Advertisers and Admins see ALL screens (for browsing/booking)
            if (isScreenOwner)
            {
                query.OwnerId = userGuid;
            }

            // Pass caller role for visibility filtering (Advertisers can't see Private screens)
            if (User.IsInRole("Advertiser"))
                query.CallerRole = "Advertiser";
            
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<IEnumerable<ScreenDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving screens list");
            return StatusCode(500, ApiResponse<IEnumerable<ScreenDto>>.ErrorResponse("Failed to retrieve screens."));
        }
    }

    /// <summary>
    /// Gets a paginated list of screens with optional filtering and sorting.
    /// </summary>
    /// <param name="page">Page number (1-based). Defaults to 1.</param>
    /// <param name="pageSize">Number of items per page. Defaults to 10, max 100.</param>
    /// <param name="search">Optional search term to filter by name, address, or description.</param>
    /// <param name="status">Optional status filter (Online, Offline, Maintenance).</param>
    /// <param name="sortBy">Sort field (Name, Location, CreatedAt). Defaults to CreatedAt.</param>
    /// <param name="sortDirection">Sort direction (asc or desc). Defaults to desc.</param>
    [HttpGet("paged")]
    public async Task<ActionResult<ApiResponse<PagedResult<ScreenDto>>>> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string sortBy = "CreatedAt",
        [FromQuery] string sortDirection = "desc")
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse<PagedResult<ScreenDto>>.ErrorResponse("User not authenticated"));

            var userGuid = Guid.Parse(userId);
            var isScreenOwner = User.IsInRole("ScreenOwner");
            
            var query = new GetScreensPagedQuery
            {
                PageNumber = page,
                PageSize = pageSize,
                SearchTerm = search,
                Status = status,
                SortBy = sortBy,
                SortDirection = sortDirection
            };
            
            // Screen owners see ONLY their own screens
            if (isScreenOwner)
            {
                query.OwnerId = userGuid;
            }

            // Pass caller role for visibility filtering (Advertisers can't see Private screens)
            if (User.IsInRole("Advertiser"))
                query.CallerRole = "Advertiser";
            
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<PagedResult<ScreenDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving paged screens list");
            return StatusCode(500, ApiResponse<PagedResult<ScreenDto>>.ErrorResponse("Failed to retrieve screens."));
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> GetById(Guid id)
    {
        try
        {
            // Visibility check: Advertisers cannot view screens owned by Private accounts
            if (User.IsInRole("Advertiser"))
            {
                if (await IsScreenPrivateAsync(id))
                    return NotFound(ApiResponse<ScreenDto>.ErrorResponse("Screen not found"));
            }

            var query = new GetScreenByIdQuery { ScreenId = id };
            var result = await _mediator.Send(query);

            if (result == null)
            {
                return NotFound(ApiResponse<ScreenDto>.ErrorResponse("Screen not found"));
            }

            return Ok(ApiResponse<ScreenDto>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse("Failed to retrieve screen."));
        }
    }

    [HttpPost]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> Create([FromBody] CreateScreenRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new CreateScreenCommand
            {
                UserId = userId,
                Request = request
            };

            var result = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, 
                ApiResponse<ScreenDto>.SuccessResponse(result, "Screen created successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating screen");
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse("Failed to create screen."));
        }
    }

    [HttpGet("{id}/availability")]
    public async Task<ActionResult<ApiResponse<ScreenAvailabilityDto>>> GetAvailability(
        Guid id,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate)
    {
        try
        {
            // Visibility check: Advertisers cannot access availability of Private screens
            if (User.IsInRole("Advertiser"))
            {
                if (await IsScreenPrivateAsync(id))
                    return NotFound(ApiResponse<ScreenAvailabilityDto>.ErrorResponse("Screen not found"));
            }

            var query = new GetScreenAvailabilityQuery
            {
                ScreenId = id,
                StartDate = startDate,
                EndDate = endDate
            };

            var result = await _mediator.Send(query);
            return Ok(ApiResponse<ScreenAvailabilityDto>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ScreenAvailabilityDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking availability for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<ScreenAvailabilityDto>.ErrorResponse("Failed to check screen availability."));
        }
    }

    [HttpGet("{id}/calendar")]
    public async Task<ActionResult<ApiResponse<SlotCalendarDto>>> GetSlotCalendar(
        Guid id,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate)
    {
        try
        {
            // Visibility check: Advertisers cannot access calendar of Private screens
            if (User.IsInRole("Advertiser"))
            {
                if (await IsScreenPrivateAsync(id))
                    return NotFound(ApiResponse<SlotCalendarDto>.ErrorResponse("Screen not found"));
            }

            var query = new GetSlotCalendarQuery
            {
                ScreenId = id,
                StartDate = DateOnly.FromDateTime(startDate),
                EndDate = DateOnly.FromDateTime(endDate)
            };

            var result = await _mediator.Send(query);
            return Ok(ApiResponse<SlotCalendarDto>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<SlotCalendarDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving slot calendar for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<SlotCalendarDto>.ErrorResponse("Failed to retrieve slot calendar."));
        }
    }

    /// <summary>
    /// Per-day demand for the next N days (default 90, max 180), read from the
    /// same SlotAvailability rows the booking flow maintains — so the heatmap
    /// can never disagree with what bookings actually reserved. Days with no
    /// row are fully available.
    /// </summary>
    [HttpGet("{id}/demand")]
    public async Task<ActionResult<ApiResponse<List<DayDemandDto>>>> GetDemand(
        Guid id,
        [FromQuery] int days = 90)
    {
        try
        {
            days = Math.Clamp(days, 1, 180);

            var screen = await _context.Screens
                .AsNoTracking()
                .Where(s => s.Id == id && !s.IsDeleted)
                .Select(s => new { s.SlotsPerFrame })
                .FirstOrDefaultAsync();

            if (screen == null)
                return NotFound(ApiResponse<List<DayDemandDto>>.ErrorResponse("Screen not found"));

            // Same visibility rule as availability/calendar: advertisers can't
            // probe private screens.
            if (User.IsInRole("Advertiser") && await IsScreenPrivateAsync(id))
                return NotFound(ApiResponse<List<DayDemandDto>>.ErrorResponse("Screen not found"));

            var start = DateTime.UtcNow.Date;
            var end = start.AddDays(days);

            var rows = await _context.SlotAvailabilities
                .AsNoTracking()
                .Where(a => a.ScreenId == id && a.Date >= start && a.Date < end)
                .Select(a => new { a.Date, a.TotalSlots, a.BookedSlots })
                .ToDictionaryAsync(a => a.Date.Date, a => a);

            var result = new List<DayDemandDto>(days);
            for (var d = start; d < end; d = d.AddDays(1))
            {
                rows.TryGetValue(d, out var row);
                var total = row?.TotalSlots > 0 ? row.TotalSlots : screen.SlotsPerFrame;
                var booked = Math.Min(row?.BookedSlots ?? 0, total);
                result.Add(new DayDemandDto
                {
                    Date = d.ToString("yyyy-MM-dd"),
                    TotalSlots = total,
                    BookedSlots = booked
                });
            }

            return Ok(ApiResponse<List<DayDemandDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving demand for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<List<DayDemandDto>>.ErrorResponse("Failed to retrieve demand."));
        }
    }

    /// <summary>
    /// Sync health for the owner's device tab: the impression backlog the
    /// player self-reports with each heartbeat. Owner/Admin only.
    /// </summary>
    [HttpGet("{id}/sync-health")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> GetSyncHealth(Guid id)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var isAdmin = User.IsInRole("Admin");

        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == id && !s.IsDeleted)
            .Select(s => new { s.OwnerId, s.IsOnline, s.LastSeenAt, s.PendingImpressionsCount, s.PendingImpressionsAt })
            .FirstOrDefaultAsync();

        if (screen == null)
            return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
        if (!isAdmin && screen.OwnerId != userId)
            return Forbid();

        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            isOnline = screen.IsOnline,
            lastSeenAt = screen.LastSeenAt,
            pendingImpressions = screen.PendingImpressionsCount,
            reportedAt = screen.PendingImpressionsAt
        }));
    }

    /// <summary>
    /// Price benchmark: what comparable active screens charge per slot.
    /// Comparable = same city (fallback: same state, then platform-wide),
    /// preferring the same screen type when enough samples exist. Only
    /// aggregates are returned, never individual screens' prices, and only
    /// when at least 3 screens contribute.
    /// </summary>
    [HttpGet("{id}/price-benchmark")]
    public async Task<ActionResult<ApiResponse<PriceBenchmarkDto>>> GetPriceBenchmark(Guid id)
    {
        try
        {
            var me = await _context.Screens
                .AsNoTracking()
                .Where(s => s.Id == id && !s.IsDeleted)
                .Select(s => new { s.PricePerSlot, s.Currency, City = s.Location.City, State = s.Location.State, s.ScreenType })
                .FirstOrDefaultAsync();

            if (me == null)
                return NotFound(ApiResponse<PriceBenchmarkDto>.ErrorResponse("Screen not found"));

            var candidates = await _context.Screens
                .AsNoTracking()
                .Where(s => !s.IsDeleted && s.Id != id
                    && s.Status == ScreenStatus.Active
                    && s.PricePerSlot > 0
                    && s.Currency == me.Currency)
                .Select(s => new { s.PricePerSlot, City = s.Location.City, State = s.Location.State, s.ScreenType })
                .ToListAsync();

            // Narrowest comparable pool with at least 3 screens.
            var pools = new[]
            {
                (label: $"{me.City} · {me.ScreenType}", items: candidates.Where(c => c.City == me.City && c.ScreenType == me.ScreenType)),
                (label: me.City ?? "your city", items: candidates.Where(c => c.City == me.City)),
                (label: me.State ?? "your state", items: candidates.Where(c => c.State == me.State)),
                (label: "the platform", items: candidates.AsEnumerable()),
            };

            foreach (var (label, items) in pools)
            {
                var prices = items.Select(c => c.PricePerSlot).OrderBy(p => p).ToList();
                if (prices.Count < 3) continue;

                decimal Percentile(double p)
                {
                    var rank = p * (prices.Count - 1);
                    var lo = (int)Math.Floor(rank);
                    var hi = (int)Math.Ceiling(rank);
                    return Math.Round(prices[lo] + (prices[hi] - prices[lo]) * (decimal)(rank - lo), 0);
                }

                return Ok(ApiResponse<PriceBenchmarkDto>.SuccessResponse(new PriceBenchmarkDto
                {
                    Scope = label,
                    SampleSize = prices.Count,
                    Currency = me.Currency,
                    YourPrice = me.PricePerSlot,
                    P25 = Percentile(0.25),
                    Median = Percentile(0.5),
                    P75 = Percentile(0.75)
                }));
            }

            // Not enough comparable screens anywhere — say so rather than fake it.
            return Ok(ApiResponse<PriceBenchmarkDto>.SuccessResponse(new PriceBenchmarkDto
            {
                Scope = null,
                SampleSize = 0,
                Currency = me.Currency,
                YourPrice = me.PricePerSlot
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error computing price benchmark for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<PriceBenchmarkDto>.ErrorResponse("Failed to compute benchmark."));
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> Update(Guid id, [FromBody] UpdateScreenRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new UpdateScreenCommand
            {
                ScreenId = id,
                UserId = userId,
                Request = request
            };

            var result = await _mediator.Send(command);
            return Ok(ApiResponse<ScreenDto>.SuccessResponse(result, "Screen updated successfully"));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<ScreenDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<ScreenDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse("Failed to update screen."));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var command = new DeleteScreenCommand
            {
                ScreenId = id,
                UserId = userId
            };

            var result = await _mediator.Send(command);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to delete screen."));
        }
    }
    
    // ==========================================
    // SCREEN IMAGE ENDPOINTS
    // ==========================================
    
    /// <summary>
    /// Get all images for a screen
    /// </summary>
    [HttpGet("{id}/images")]
    public async Task<ActionResult<ApiResponse<List<ScreenImageDto>>>> GetImages(Guid id)
    {
        try
        {
            var images = await _imageService.GetImagesAsync(id);
            return Ok(ApiResponse<List<ScreenImageDto>>.SuccessResponse(images));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving images for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<List<ScreenImageDto>>.ErrorResponse("Failed to retrieve screen images."));
        }
    }
    
    /// <summary>
    /// Upload images for a screen
    /// </summary>
    /// <param name="id">Screen ID</param>
    /// <param name="imageType">Image type: "Screen" or "Surrounding"</param>
    [HttpPost("{id}/images")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    [RequestSizeLimit(52_428_800)] // 50 MB limit for multiple images
    public async Task<ActionResult<ApiResponse<UploadScreenImagesResponse>>> UploadImages(
        Guid id, 
        [FromQuery] string imageType)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<UploadScreenImagesResponse>.ErrorResponse("Screen not found"));
            }
            
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<UploadScreenImagesResponse>.ErrorResponse(
                    "Only the screen owner can upload images"));
            }
            
            if (Request.Form.Files.Count == 0)
            {
                return BadRequest(ApiResponse<UploadScreenImagesResponse>.ErrorResponse("No files provided"));
            }
            
            // Convert IFormFiles to ImageUploadFile objects
            var uploadFiles = Request.Form.Files.Select(f => new ImageUploadFile
            {
                Stream = f.OpenReadStream(),
                FileName = f.FileName,
                ContentType = f.ContentType,
                Length = f.Length
            }).ToList();
            
            var result = await _imageService.UploadImagesAsync(id, uploadFiles, imageType);
            
            // Dispose streams after upload
            foreach (var uf in uploadFiles)
            {
                uf.Stream.Dispose();
            }
            
            if (!result.Success && !result.UploadedImages.Any())
            {
                return BadRequest(ApiResponse<UploadScreenImagesResponse>.ErrorResponse(
                    string.Join("; ", result.Errors)));
            }
            
            return Ok(ApiResponse<UploadScreenImagesResponse>.SuccessResponse(result, result.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<UploadScreenImagesResponse>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading images for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<UploadScreenImagesResponse>.ErrorResponse("Failed to upload screen images."));
        }
    }
    
    /// <summary>
    /// Delete an image from a screen
    /// </summary>
    [HttpDelete("{id}/images/{imageId}")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteImage(Guid id, Guid imageId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            }
            
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<object>.ErrorResponse(
                    "Only the screen owner can delete images"));
            }
            
            var result = await _imageService.DeleteImageAsync(id, imageId);
            
            if (!result)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(
                    "Cannot delete image. Either image not found or screen must have at least 1 image."));
            }
            
            return Ok(ApiResponse<object>.SuccessResponse(null, "Image deleted successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting image {ImageId} for screen {ScreenId}", imageId, id);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to delete screen image."));
        }
    }
    
    /// <summary>
    /// Set an image as the primary image for a screen
    /// </summary>
    [HttpPost("{id}/images/{imageId}/set-primary")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> SetPrimaryImage(Guid id, Guid imageId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            }
            
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<object>.ErrorResponse(
                    "Only the screen owner can set primary image"));
            }
            
            var result = await _imageService.SetPrimaryImageAsync(id, imageId);
            
            if (!result)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Image not found"));
            }
            
            return Ok(ApiResponse<object>.SuccessResponse(null, "Primary image set successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting primary image {ImageId} for screen {ScreenId}", imageId, id);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to set primary image."));
        }
    }
    
    /// <summary>
    /// Reorder images for a screen
    /// </summary>
    [HttpPost("{id}/images/reorder")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> ReorderImages(
        Guid id, 
        [FromBody] ReorderScreenImagesRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            }
            
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<object>.ErrorResponse(
                    "Only the screen owner can reorder images"));
            }
            
            var result = await _imageService.ReorderImagesAsync(id, request.ImageIds);
            
            if (!result)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse("Invalid image IDs provided"));
            }
            
            return Ok(ApiResponse<object>.SuccessResponse(null, "Images reordered successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering images for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to reorder screen images."));
        }
    }
    
    // Owner Slot Management Endpoints
    
    [HttpGet("{id}/slots/status")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<List<SlotStatusDto>>>> GetSlotStatus(Guid id)
    {
        try
        {
            var query = new GetSlotStatusQuery { ScreenId = id };
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<List<SlotStatusDto>>.SuccessResponse(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<List<SlotStatusDto>>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving slot status for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<List<SlotStatusDto>>.ErrorResponse("Failed to retrieve slot status."));
        }
    }
    
    [HttpPost("{id}/slots/{slotNumber}/content")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    [RequestSizeLimit(52_428_800)] // 50 MB limit for video uploads
    public async Task<ActionResult<ApiResponse<OwnerContentDto>>> UploadSlotContent(
        Guid id, int slotNumber, [FromForm] string name, 
        [FromForm] decimal pricePerPlay, [FromForm] string currency, [FromForm] IFormFile file)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var command = new CreateOwnerContentCommand
            {
                ScreenId = id, OwnerId = userId, SlotNumber = slotNumber, Name = name,
                FileStream = file.OpenReadStream(), FileName = file.FileName,
                ContentType = file.ContentType, PricePerPlay = pricePerPlay,
                Currency = currency ?? "INR" // Default to INR
            };
            var result = await _mediator.Send(command);
            return Ok(ApiResponse<OwnerContentDto>.SuccessResponse(result, "Content uploaded"));
        }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, ApiResponse<OwnerContentDto>.ErrorResponse(ex.Message)); }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<OwnerContentDto>.ErrorResponse(ex.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(ApiResponse<OwnerContentDto>.ErrorResponse(ex.Message)); }
        catch (Exception ex) { _logger.LogError(ex, "Error uploading slot content for screen {ScreenId}, slot {SlotNumber}", id, slotNumber); return StatusCode(500, ApiResponse<OwnerContentDto>.ErrorResponse("Failed to upload slot content.")); }
    }
    
    [HttpDelete("{id}/slots/{slotNumber}/content")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteSlotContent(Guid id, int slotNumber)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var command = new DeleteOwnerContentCommand { ScreenId = id, OwnerId = userId, SlotNumber = slotNumber };
            await _mediator.Send(command);
            return Ok(ApiResponse<object>.SuccessResponse(null, "Content removed"));
        }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, ApiResponse<object>.ErrorResponse(ex.Message)); }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.ErrorResponse(ex.Message)); }
        catch (Exception ex) { _logger.LogError(ex, "Error deleting slot content for screen {ScreenId}, slot {SlotNumber}", id, slotNumber); return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to delete slot content.")); }
    }
    
    /// <summary>
    /// Generate or regenerate API key for player authentication
    /// Only screen owner or admin can generate keys
    /// </summary>
    [HttpPost("{id}/generate-api-key")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<GenerateApiKeyResponse>>> GenerateApiKey(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var isAdmin = User.IsInRole("Admin");
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<GenerateApiKeyResponse>.ErrorResponse("Screen not found"));
            }
            
            // Only owner or admin can generate API key
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<GenerateApiKeyResponse>.ErrorResponse(
                    "Only the screen owner can generate API keys"));
            }
            
            // Generate a secure random API key
            var apiKey = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            
            // Hash it with BCrypt for storage
            var apiKeyHash = BCrypt.Net.BCrypt.HashPassword(apiKey, workFactor: 12);
            
            // Update the screen with the new hash
            var updateCommand = new UpdateScreenApiKeyCommand
            {
                ScreenId = id,
                ApiKeyHash = apiKeyHash
            };
            await _mediator.Send(updateCommand);
            
            return Ok(ApiResponse<GenerateApiKeyResponse>.SuccessResponse(
                new GenerateApiKeyResponse
                {
                    ScreenId = id,
                    ApiKey = apiKey,
                    Message = "API key generated. Store this securely - it cannot be retrieved again!"
                },
                "API key generated successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating API key for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<GenerateApiKeyResponse>.ErrorResponse("Failed to generate API key."));
        }
    }

    /// <summary>
    /// Rotate the API key with a 24-hour grace window: the new key takes effect
    /// immediately, and the outgoing key keeps authenticating until the window
    /// closes — so the player can be reconfigured without the screen ever going
    /// offline. Unlike generate-api-key (a hard cutover for first-time setup or
    /// emergencies), rotation is the safe periodic-hygiene path.
    /// </summary>
    [HttpPost("{id}/rotate-api-key")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<GenerateApiKeyResponse>>> RotateApiKey(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var isAdmin = User.IsInRole("Admin");

            var screen = await _context.Screens.FirstOrDefaultAsync(s => s.Id == id);
            if (screen == null)
                return NotFound(ApiResponse<GenerateApiKeyResponse>.ErrorResponse("Screen not found"));

            if (!isAdmin && screen.OwnerId != userId)
                return StatusCode(403, ApiResponse<GenerateApiKeyResponse>.ErrorResponse(
                    "Only the screen owner can rotate API keys"));

            if (string.IsNullOrEmpty(screen.ApiKeyHash))
                return BadRequest(ApiResponse<GenerateApiKeyResponse>.ErrorResponse(
                    "No API key exists yet — generate one first."));

            var apiKey = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            var apiKeyHash = BCrypt.Net.BCrypt.HashPassword(apiKey, workFactor: 12);

            screen.ApiKeyHashPrevious = screen.ApiKeyHash;
            screen.ApiKeyRotatedAt = DateTime.UtcNow;
            screen.ApiKeyHash = apiKeyHash;
            screen.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var graceUntil = screen.ApiKeyRotatedAt.Value.Add(CCMS.Api.Security.ScreenApiKeys.RotationGrace);
            _logger.LogInformation("API key rotated for screen {ScreenId}; previous key valid until {GraceUntil:u}", id, graceUntil);

            return Ok(ApiResponse<GenerateApiKeyResponse>.SuccessResponse(
                new GenerateApiKeyResponse
                {
                    ScreenId = id,
                    ApiKey = apiKey,
                    Message = $"Key rotated. The old key keeps working until {graceUntil:u} — update the player's config before then. Store the new key securely; it cannot be retrieved again."
                },
                "API key rotated with 24h grace window"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rotating API key for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<GenerateApiKeyResponse>.ErrorResponse("Failed to rotate API key."));
        }
    }

    /// <summary>
    /// Revoke API key for player authentication
    /// The player device will no longer be able to authenticate
    /// </summary>
    [HttpDelete("{id}/api-key")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> RevokeApiKey(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var isAdmin = User.IsInRole("Admin");

            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);

            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));
            }

            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<object>.ErrorResponse(
                    "Only the screen owner can revoke API keys"));
            }

            var revokeCommand = new RevokeScreenApiKeyCommand { ScreenId = id };
            await _mediator.Send(revokeCommand);

            return Ok(ApiResponse<object>.SuccessResponse(
                new { ScreenId = id },
                "API key revoked. Player will no longer be able to authenticate."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking API key for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to revoke API key."));
        }
    }

    /// <summary>
    /// Request device override to allow a new player device to connect
    /// Creates a 30-minute window for the new device to connect
    /// </summary>
    [HttpPost("{id}/request-device-override")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<DeviceOverrideResponse>>> RequestDeviceOverride(
        Guid id, 
        [FromBody] DeviceOverrideRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            
            var deviceManager = HttpContext.RequestServices.GetRequiredService<Services.PlayerDeviceManager>();
            
            var result = await deviceManager.RequestDeviceOverrideAsync(id, userId, request.Reason);
            
            if (!result.Success)
            {
                return StatusCode(403, ApiResponse<DeviceOverrideResponse>.ErrorResponse(result.Reason));
            }
            
            return Ok(ApiResponse<DeviceOverrideResponse>.SuccessResponse(
                new DeviceOverrideResponse
                {
                    ScreenId = id,
                    ExpiresAt = result.ExpiresAt,
                    Message = result.Reason
                },
                "Device override requested"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting device override for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<DeviceOverrideResponse>.ErrorResponse("Failed to request device override."));
        }
    }
    
    /// <summary>
    /// Get device binding status for a screen
    /// </summary>
    [HttpGet("{id}/device-status")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<DeviceBindingStatusResponse>>> GetDeviceStatus(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var isAdmin = User.IsInRole("Admin");
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<DeviceBindingStatusResponse>.ErrorResponse("Screen not found"));
            }
            
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<DeviceBindingStatusResponse>.ErrorResponse(
                    "Only the screen owner can view device status"));
            }
            
            var deviceManager = HttpContext.RequestServices.GetRequiredService<Services.PlayerDeviceManager>();
            var status = await deviceManager.GetDeviceBindingStatusAsync(id);
            
            if (status == null)
            {
                return NotFound(ApiResponse<DeviceBindingStatusResponse>.ErrorResponse("Screen not found"));
            }
            
            return Ok(ApiResponse<DeviceBindingStatusResponse>.SuccessResponse(
                new DeviceBindingStatusResponse
                {
                    ScreenId = status.ScreenId,
                    IsBound = status.IsBound,
                    BoundAt = status.BoundAt,
                    LastVerification = status.LastVerification,
                    HasPendingOverride = status.HasPendingOverride,
                    PendingOverrideExpiresAt = status.PendingOverrideExpiresAt
                }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving device status for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<DeviceBindingStatusResponse>.ErrorResponse("Failed to retrieve device status."));
        }
    }
    
    // ==========================================
    // TAG MANAGEMENT ENDPOINTS
    // ==========================================
    
    /// <summary>
    /// Get all available tags (master tag list), optionally grouped/counted for advertiser filter UIs.
    /// </summary>
    /// <param name="category">Optional category filter (Demographic, Context, Traffic, etc.). Case-insensitive.</param>
    /// <param name="includeScreenCounts">When true, each tag includes ScreenCount = number of active+verified+public screens carrying that tag. Adds one aggregate query.</param>
    [AllowAnonymous]
    [HttpGet("tags")]
    public async Task<ActionResult<ApiResponse<IEnumerable<MasterTagDto>>>> GetAllTags(
        [FromQuery] string? category = null,
        [FromQuery] bool includeScreenCounts = false)
    {
        try
        {
            var query = _context.ScreenTags.Where(t => !t.IsDeleted);
            
            if (!string.IsNullOrEmpty(category) && 
                Enum.TryParse<TagCategory>(category, true, out var tagCategory))
            {
                query = query.Where(t => t.Category == tagCategory);
            }
            
            var tags = await query
                .OrderBy(t => t.Category)
                .ThenBy(t => t.Priority)
                .Select(t => new MasterTagDto
                {
                    Id = t.Id,
                    Slug = t.Slug,
                    DisplayName = t.DisplayName,
                    Category = t.Category.ToString(),
                    Description = t.Description,
                    IconName = t.IconName,
                    ColorCode = t.ColorCode,
                    Priority = t.Priority
                })
                .ToListAsync();

            if (includeScreenCounts && tags.Count > 0)
            {
                var tagIds = tags.Select(t => t.Id).ToList();
                var counts = await _context.ScreenTagAssignments
                    .AsNoTracking()
                    .Where(ta => tagIds.Contains(ta.TagId))
                    .Where(ta => !ta.Screen.IsDeleted
                        && ta.Screen.Status == ScreenStatus.Active
                        && ta.Screen.VerificationStatus == ScreenVerificationStatus.Verified
                        && ta.Screen.Owner.AccountVisibility == ScreenVisibility.Public)
                    .GroupBy(ta => ta.TagId)
                    .Select(g => new { TagId = g.Key, Count = g.Select(x => x.ScreenId).Distinct().Count() })
                    .ToDictionaryAsync(x => x.TagId, x => x.Count);
                foreach (var tag in tags)
                {
                    tag.ScreenCount = counts.TryGetValue(tag.Id, out var c) ? c : 0;
                }
            }
            
            return Ok(ApiResponse<IEnumerable<MasterTagDto>>.SuccessResponse(tags));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving master tag list");
            return StatusCode(500, ApiResponse<IEnumerable<MasterTagDto>>.ErrorResponse("Failed to retrieve tags."));
        }
    }
    
    /// <summary>
    /// Get tags for a specific screen
    /// </summary>
    [HttpGet("{id}/tags")]
    public async Task<ActionResult<ApiResponse<IEnumerable<ScreenTagDetailDto>>>> GetScreenTags(Guid id)
    {
        try
        {
            var screenExists = await _context.Screens.AnyAsync(s => s.Id == id && !s.IsDeleted);
            if (!screenExists)
            {
                return NotFound(ApiResponse<IEnumerable<ScreenTagDetailDto>>.ErrorResponse("Screen not found"));
            }
            
            var tags = await _taggingService.GetScreenTagsAsync(id);
            
            var result = tags.Select(t => new ScreenTagDetailDto
            {
                TagId = t.TagId,
                Slug = t.Slug,
                DisplayName = t.DisplayName,
                Category = t.Category,
                Description = t.Description,
                IconName = t.IconName,
                ColorCode = t.ColorCode,
                IsPrimary = t.IsPrimary,
                Score = t.Score,
                Source = t.Source,
                DistanceMeters = t.DistanceMeters,
                PoiCount = t.PoiCount,
                AssignedAt = t.AssignedAt
            });
            
            return Ok(ApiResponse<IEnumerable<ScreenTagDetailDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tags for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<IEnumerable<ScreenTagDetailDto>>.ErrorResponse("Failed to retrieve screen tags."));
        }
    }
    
    /// <summary>
    /// Generate/regenerate tags for a screen based on location
    /// </summary>
    [HttpPost("{id}/generate-tags")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<GenerateTagsResult>>> GenerateTags(
        Guid id, 
        [FromQuery] bool forceRefresh = false)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var isAdmin = User.IsInRole("Admin");
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<GenerateTagsResult>.ErrorResponse("Screen not found"));
            }
            
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<GenerateTagsResult>.ErrorResponse(
                    "Only the screen owner can generate tags"));
            }
            
            var result = await _taggingService.GenerateTagsAsync(id, forceRefresh);
            
            if (!result.Success)
            {
                return BadRequest(ApiResponse<GenerateTagsResult>.ErrorResponse(result.Error ?? "Tag generation failed"));
            }
            
            return Ok(ApiResponse<GenerateTagsResult>.SuccessResponse(new GenerateTagsResult
            {
                Success = result.Success,
                Message = result.Message,
                TagsGenerated = result.TagsGenerated,
                PrimaryTags = result.PrimaryTags,
                FromCache = result.FromCache,
                TotalPoisFound = result.TotalPoisFound
            }, "Tags generated successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating tags for screen {ScreenId}", id);
            return StatusCode(500, ApiResponse<GenerateTagsResult>.ErrorResponse("Failed to generate tags."));
        }
    }
    
    /// <summary>
    /// Add a manual tag to a screen
    /// </summary>
    [HttpPost("{id}/tags")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> AddTag(Guid id, [FromBody] AddTagRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var isAdmin = User.IsInRole("Admin");
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<bool>.ErrorResponse("Screen not found"));
            }
            
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<bool>.ErrorResponse(
                    "Only the screen owner can add tags"));
            }
            
            var success = await _taggingService.AddManualTagAsync(id, request.TagId, userId);
            
            if (!success)
            {
                return BadRequest(ApiResponse<bool>.ErrorResponse("Tag already exists or tag not found"));
            }
            
            return Ok(ApiResponse<bool>.SuccessResponse(true, "Tag added successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding tag {TagId} to screen {ScreenId}", request.TagId, id);
            return StatusCode(500, ApiResponse<bool>.ErrorResponse("Failed to add tag."));
        }
    }

    /// <summary>
    /// Remove a tag from a screen
    /// </summary>
    [HttpDelete("{id}/tags/{tagId}")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveTag(Guid id, Guid tagId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? throw new UnauthorizedAccessException("User not authenticated"));
            var isAdmin = User.IsInRole("Admin");
            
            // Check ownership
            var ownershipQuery = new CheckScreenOwnershipQuery { ScreenId = id };
            var ownership = await _mediator.Send(ownershipQuery);
            
            if (!ownership.Exists)
            {
                return NotFound(ApiResponse<bool>.ErrorResponse("Screen not found"));
            }
            
            if (!isAdmin && ownership.OwnerId != userId)
            {
                return StatusCode(403, ApiResponse<bool>.ErrorResponse(
                    "Only the screen owner can remove tags"));
            }
            
            var success = await _taggingService.RemoveTagAsync(id, tagId, userId, isAdmin);
            
            if (!success)
            {
                return BadRequest(ApiResponse<bool>.ErrorResponse(
                    isAdmin ? "Tag not found" : "Only manual tags can be removed. Use generate-tags to refresh auto tags."));
            }
            
            return Ok(ApiResponse<bool>.SuccessResponse(true, "Tag removed successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing tag {TagId} from screen {ScreenId}", tagId, id);
            return StatusCode(500, ApiResponse<bool>.ErrorResponse("Failed to remove tag."));
        }
    }

    // ==========================================
    // PUBLIC SCREEN DISCOVERY (No Auth Required)
    // ==========================================
    
    /// <summary>
    /// Public endpoint to explore screens on map view (no authentication required)
    /// Returns limited data - no owner info, no revenue data
    /// </summary>
    [AllowAnonymous]
    [HttpPost("explore")]
    public async Task<ActionResult<ApiResponse<PublicSearchScreensResult>>> ExploreScreens(
        [FromBody] PublicSearchScreensRequest request)
    {
        try
        {
            // Build base query - only active screens for public view, filtered by owner visibility
            var query = _context.Screens
                .AsNoTracking()
                .Where(s => !s.IsDeleted && s.Status == ScreenStatus.Active)
                .Where(s => s.Owner.AccountVisibility == ScreenVisibility.Public)
                .Where(s => s.VerificationStatus == ScreenVerificationStatus.Verified);
            
            // Text search
            if (!string.IsNullOrEmpty(request.SearchText))
            {
                var searchPattern = $"%{request.SearchText}%";
                query = query.Where(s => 
                    EF.Functions.ILike(s.Name, searchPattern) ||
                    EF.Functions.ILike(s.Location.City, searchPattern));
            }
            
            // Location filters
            if (!string.IsNullOrEmpty(request.City))
            {
                query = query.Where(s => EF.Functions.ILike(s.Location.City, request.City));
            }
            
            if (!string.IsNullOrEmpty(request.State))
            {
                query = query.Where(s => EF.Functions.ILike(s.Location.State, request.State));
            }
            
            if (!string.IsNullOrEmpty(request.Country))
            {
                query = query.Where(s => EF.Functions.ILike(s.Location.Country, request.Country));
            }
            
            // Bounding box search for map viewport
            if (request.BoundingBox != null)
            {
                query = query.Where(s =>
                    s.Latitude >= request.BoundingBox.South &&
                    s.Latitude <= request.BoundingBox.North &&
                    s.Longitude >= request.BoundingBox.West &&
                    s.Longitude <= request.BoundingBox.East);
            }
            
            // Radius search
            if (request.Latitude.HasValue && request.Longitude.HasValue && request.RadiusKm.HasValue)
            {
                var radiusKm = request.RadiusKm.Value;
                var latDelta = (decimal)(radiusKm / 111.0);
                var lngDelta = (decimal)(radiusKm / (111.0 * Math.Cos((double)request.Latitude.Value * Math.PI / 180)));
                
                query = query.Where(s =>
                    s.Latitude >= request.Latitude.Value - latDelta &&
                    s.Latitude <= request.Latitude.Value + latDelta &&
                    s.Longitude >= request.Longitude.Value - lngDelta &&
                    s.Longitude <= request.Longitude.Value + lngDelta);
            }
            
            // Tag category filter (basic)
            if (!string.IsNullOrEmpty(request.TagCategory) &&
                Enum.TryParse<TagCategory>(request.TagCategory, true, out var tagCategory))
            {
                query = query.Where(s => s.TagAssignments.Any(ta => ta.Tag.Category == tagCategory));
            }
            
            // Price filters (show range indicator)
            if (request.MinPrice.HasValue)
            {
                query = query.Where(s => s.PricePerSlot >= request.MinPrice.Value);
            }
            
            if (request.MaxPrice.HasValue)
            {
                query = query.Where(s => s.PricePerSlot <= request.MaxPrice.Value);
            }
            
            // Sorting
            query = request.SortBy?.ToLower() switch
            {
                "name" => request.SortDirection?.ToLower() == "desc" 
                    ? query.OrderByDescending(s => s.Name) 
                    : query.OrderBy(s => s.Name),
                "price" => request.SortDirection?.ToLower() == "desc"
                    ? query.OrderByDescending(s => s.PricePerSlot)
                    : query.OrderBy(s => s.PricePerSlot),
                _ => query.OrderByDescending(s => s.CreatedAt)
            };
            
            // Pagination - limit to 500 for map view performance
            var pageSize = Math.Min(request.PageSize, 500);
            var skip = (request.Page - 1) * pageSize;
            
            var totalCount = await query.CountAsync();
            
            // Fetch screens with LIMITED public data
            var screens = await query
                .Skip(skip)
                .Take(pageSize)
                .Select(s => new PublicScreenDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    City = s.Location.City,
                    State = s.Location.State,
                    Country = s.Location.Country,
                    Latitude = s.Latitude,
                    Longitude = s.Longitude,
                    // Show price range indicator instead of exact price
                    PriceRange = s.PricePerSlot < 10 ? "Budget" 
                        : s.PricePerSlot < 50 ? "Standard" 
                        : s.PricePerSlot < 200 ? "Premium" 
                        : "Enterprise",
                    StartingPrice = s.PricePerSlot,
                    Currency = s.Currency,
                    IsOnline = s.IsOnline,
                    // Only show primary tag category, not full details
                    PrimaryTagCategory = s.TagAssignments
                        .Where(ta => ta.IsPrimary)
                        .Select(ta => ta.Tag.Category.ToString())
                        .FirstOrDefault(),
                    PrimaryTagName = s.TagAssignments
                        .Where(ta => ta.IsPrimary)
                        .Select(ta => ta.Tag.DisplayName)
                        .FirstOrDefault(),
                    // Primary image URL for display
                    PrimaryImageUrl = s.Images
                        .Where(img => img.IsPrimary)
                        .Select(img => img.ImageUrl)
                        .FirstOrDefault()
                })
                .ToListAsync();
            
            var result = new PublicSearchScreensResult
            {
                Screens = screens,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            };
            
            return Ok(ApiResponse<PublicSearchScreensResult>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exploring screens");
            return StatusCode(500, ApiResponse<PublicSearchScreensResult>.ErrorResponse("Failed to explore screens."));
        }
    }
    
    // ==========================================
    // SCREEN SEARCH/DISCOVERY (For Advertisers)
    // ==========================================
    
    /// <summary>
    /// Search screens with filters (for advertisers)
    /// </summary>
    [HttpPost("search")]
    public async Task<ActionResult<ApiResponse<SearchScreensResult>>> SearchScreens(
        [FromBody] SearchScreensRequest request)
    {
        try
        {
            // Build base query WITHOUT Include - use projection instead for performance
            var query = _context.Screens
                .AsNoTracking()
                .Where(s => !s.IsDeleted && s.Status == ScreenStatus.Active)
                .Where(s => s.Owner.AccountVisibility == ScreenVisibility.Public)
                .Where(s => s.VerificationStatus == ScreenVerificationStatus.Verified);
            
            // Text search - use EF.Functions.ILike for case-insensitive search on PostgreSQL
            if (!string.IsNullOrEmpty(request.SearchText))
            {
                var searchPattern = $"%{request.SearchText}%";
                query = query.Where(s => 
                    EF.Functions.ILike(s.Name, searchPattern) ||
                    EF.Functions.ILike(s.Description, searchPattern) ||
                    EF.Functions.ILike(s.Location.City, searchPattern));
            }
            
            // Location filters
            if (!string.IsNullOrEmpty(request.City))
            {
                query = query.Where(s => EF.Functions.ILike(s.Location.City, request.City));
            }
            
            if (!string.IsNullOrEmpty(request.State))
            {
                query = query.Where(s => EF.Functions.ILike(s.Location.State, request.State));
            }
            
            if (!string.IsNullOrEmpty(request.Country))
            {
                query = query.Where(s => EF.Functions.ILike(s.Location.Country, request.Country));
            }
            
            // Radius search (approximate using lat/lng box for performance)
            if (request.Latitude.HasValue && request.Longitude.HasValue && request.RadiusKm.HasValue)
            {
                var radiusKm = request.RadiusKm.Value;
                var latDelta = (decimal)(radiusKm / 111.0);
                var lngDelta = (decimal)(radiusKm / (111.0 * Math.Cos((double)request.Latitude.Value * Math.PI / 180)));
                
                query = query.Where(s =>
                    s.Latitude >= request.Latitude.Value - latDelta &&
                    s.Latitude <= request.Latitude.Value + latDelta &&
                    s.Longitude >= request.Longitude.Value - lngDelta &&
                    s.Longitude <= request.Longitude.Value + lngDelta);
            }

            // Bounding-box (map viewport)
            if (request.BoundingBox != null)
            {
                var bbox = request.BoundingBox;
                query = query.Where(s =>
                    s.Latitude >= bbox.South && s.Latitude <= bbox.North &&
                    s.Longitude >= bbox.West && s.Longitude <= bbox.East);
            }

            // Display environment (Indoor / Outdoor / SemiIndoor)
            if (!string.IsNullOrWhiteSpace(request.DisplayType) &&
                Enum.TryParse<ScreenDisplayType>(request.DisplayType, true, out var displayType))
            {
                query = query.Where(s => s.DisplayType == displayType);
            }

            // Orientation (Landscape / Portrait)
            if (!string.IsNullOrWhiteSpace(request.Orientation) &&
                Enum.TryParse<ScreenOrientation>(request.Orientation, true, out var orientation))
            {
                query = query.Where(s => s.Orientation == orientation);
            }

            // Minimum resolution
            if (request.MinResolutionWidth.HasValue)
            {
                query = query.Where(s => s.ResolutionWidth >= request.MinResolutionWidth.Value);
            }
            if (request.MinResolutionHeight.HasValue)
            {
                query = query.Where(s => s.ResolutionHeight >= request.MinResolutionHeight.Value);
            }

            // Daily-impressions and CPM filters/sorts are deliberately NOT applied here.
            // Both derive from Screen.ImpressionsPerSlot, which is an unmapped computed
            // property backed by a C# method (CalculateImpressionsPerSlot -> Schedule
            // .GetAverageOperatingHoursPerDay()). EF Core cannot translate it to SQL, so
            // referencing it in Where/OrderBy threw InvalidOperationException at query
            // compile time and made this whole endpoint 500 — which is what left the
            // marketplace/map empty. They are evaluated in memory further down instead,
            // so the computed property stays the single source of truth for the maths.
            // Requests that don't use them keep the fully SQL-side path (filter, sort and
            // paginate in the database) unchanged.
            var sortBy = request.SortBy?.ToLower();
            var sortDescending = request.SortDirection?.ToLower() == "desc";
            var needsInMemoryEvaluation =
                request.MinDailyImpressions.HasValue || request.MaxDailyImpressions.HasValue ||
                request.MinCpm.HasValue || request.MaxCpm.HasValue ||
                sortBy == "impressions" || sortBy == "cpm";

            // Online-only filter
            if (request.OnlineOnly == true)
            {
                query = query.Where(s => s.IsOnline);
            }

            // Operating-at-hour filter (must be open at the given hour on at least one day of the week)
            if (request.OperatingAtHour.HasValue && request.OperatingAtHour.Value >= 0 && request.OperatingAtHour.Value <= 23)
            {
                var hourTs = TimeSpan.FromHours(request.OperatingAtHour.Value);
                query = query.Where(s =>
                    (s.Schedule.Monday.IsOperating    && s.Schedule.Monday.StartTime    <= hourTs && s.Schedule.Monday.EndTime    > hourTs) ||
                    (s.Schedule.Tuesday.IsOperating   && s.Schedule.Tuesday.StartTime   <= hourTs && s.Schedule.Tuesday.EndTime   > hourTs) ||
                    (s.Schedule.Wednesday.IsOperating && s.Schedule.Wednesday.StartTime <= hourTs && s.Schedule.Wednesday.EndTime > hourTs) ||
                    (s.Schedule.Thursday.IsOperating  && s.Schedule.Thursday.StartTime  <= hourTs && s.Schedule.Thursday.EndTime  > hourTs) ||
                    (s.Schedule.Friday.IsOperating    && s.Schedule.Friday.StartTime    <= hourTs && s.Schedule.Friday.EndTime    > hourTs) ||
                    (s.Schedule.Saturday.IsOperating  && s.Schedule.Saturday.StartTime  <= hourTs && s.Schedule.Saturday.EndTime  > hourTs) ||
                    (s.Schedule.Sunday.IsOperating    && s.Schedule.Sunday.StartTime    <= hourTs && s.Schedule.Sunday.EndTime    > hourTs));
            }

            // Availability date range — exclude screens fully blocked out by an existing booking that covers the entire requested range.
            // Slot-level availability for partial overlap is computed on the screen-detail / calendar endpoint.
            if (request.AvailableFrom.HasValue && request.AvailableTo.HasValue
                && request.AvailableTo.Value >= request.AvailableFrom.Value)
            {
                var from = request.AvailableFrom.Value;
                var to = request.AvailableTo.Value;
                query = query.Where(s => !s.Bookings.Any(b =>
                    b.Status != BookingStatus.Cancelled &&
                    b.Status != BookingStatus.Rejected &&
                    b.StartDate <= from &&
                    b.EndDate >= to));
            }
            
            // Tag filters - Required tags (AND logic)
            if (request.RequiredTagIds?.Any() == true)
            {
                foreach (var tagId in request.RequiredTagIds)
                {
                    query = query.Where(s => s.TagAssignments.Any(ta => ta.TagId == tagId));
                }
            }
            
            // Tag filters - Any tags (OR logic)
            if (request.AnyTagIds?.Any() == true)
            {
                query = query.Where(s => s.TagAssignments.Any(ta => request.AnyTagIds.Contains(ta.TagId)));
            }
            
            // Tag category filter
            if (!string.IsNullOrEmpty(request.TagCategory) &&
                Enum.TryParse<TagCategory>(request.TagCategory, true, out var tagCategory))
            {
                query = query.Where(s => s.TagAssignments.Any(ta => ta.Tag.Category == tagCategory));
            }
            
            // Price filters
            if (request.MinPrice.HasValue)
            {
                query = query.Where(s => s.PricePerSlot >= request.MinPrice.Value);
            }
            
            if (request.MaxPrice.HasValue)
            {
                query = query.Where(s => s.PricePerSlot <= request.MaxPrice.Value);
            }
            
            // Status filter
            if (!string.IsNullOrEmpty(request.Status) && 
                Enum.TryParse<ScreenStatus>(request.Status, true, out var status))
            {
                query = query.Where(s => s.Status == status);
            }
            
            // Sorting. "impressions" and "cpm" fall through to the default ordering here
            // and are re-sorted in memory below — see needsInMemoryEvaluation above.
            query = sortBy switch
            {
                "name" => sortDescending
                    ? query.OrderByDescending(s => s.Name)
                    : query.OrderBy(s => s.Name),
                "price" => sortDescending
                    ? query.OrderByDescending(s => s.PricePerSlot)
                    : query.OrderBy(s => s.PricePerSlot),
                "distance" => (request.Latitude.HasValue && request.Longitude.HasValue)
                    ? (sortDescending
                        ? query.OrderByDescending(s => (s.Latitude - request.Latitude.Value) * (s.Latitude - request.Latitude.Value) + (s.Longitude - request.Longitude.Value) * (s.Longitude - request.Longitude.Value))
                        : query.OrderBy(s => (s.Latitude - request.Latitude.Value) * (s.Latitude - request.Latitude.Value) + (s.Longitude - request.Longitude.Value) * (s.Longitude - request.Longitude.Value)))
                    : query.OrderByDescending(s => s.CreatedAt),
                "created" => sortDescending
                    ? query.OrderByDescending(s => s.CreatedAt)
                    : query.OrderBy(s => s.CreatedAt),
                _ => query.OrderByDescending(s => s.CreatedAt)
            };
            
            // Pagination
            var pageSize = Math.Min(request.PageSize, 100);
            var skip = (request.Page - 1) * pageSize;
            
            // Use split query to avoid Cartesian explosion with tags
            // First get screen IDs and total count in a single efficient query
            List<Guid> screenIds;
            int totalCount;

            if (needsInMemoryEvaluation)
            {
                // Materialise the SQL-filtered set so the computed (unmapped) properties
                // become available, then filter/sort/paginate over it in memory. Only
                // requests that actually ask for an impressions/CPM filter or sort pay
                // this cost; everything else stays fully SQL-side in the branch below.
                var candidates = await query.ToListAsync();

                if (request.MinDailyImpressions.HasValue)
                    candidates = candidates.Where(s => s.DailyTotalImpressions >= request.MinDailyImpressions.Value).ToList();
                if (request.MaxDailyImpressions.HasValue)
                    candidates = candidates.Where(s => s.DailyTotalImpressions <= request.MaxDailyImpressions.Value).ToList();
                if (request.MinCpm.HasValue)
                    candidates = candidates.Where(s => s.ImpressionsPerSlot > 0 && (s.PricePerSlot * 1000m / s.ImpressionsPerSlot) >= request.MinCpm.Value).ToList();
                if (request.MaxCpm.HasValue)
                    candidates = candidates.Where(s => s.ImpressionsPerSlot > 0 && (s.PricePerSlot * 1000m / s.ImpressionsPerSlot) <= request.MaxCpm.Value).ToList();

                // Leaves the SQL ordering intact when the sort itself is translatable.
                var ordered = candidates.AsEnumerable();
                if (sortBy == "impressions")
                {
                    ordered = sortDescending
                        ? candidates.OrderByDescending(s => s.DailyTotalImpressions)
                        : candidates.OrderBy(s => s.DailyTotalImpressions);
                }
                else if (sortBy == "cpm")
                {
                    ordered = sortDescending
                        ? candidates.OrderByDescending(s => s.ImpressionsPerSlot > 0 ? s.PricePerSlot * 1000m / s.ImpressionsPerSlot : decimal.MaxValue)
                        : candidates.OrderBy(s => s.ImpressionsPerSlot > 0 ? s.PricePerSlot * 1000m / s.ImpressionsPerSlot : decimal.MaxValue);
                }

                var matched = ordered.ToList();
                totalCount = matched.Count;
                screenIds = matched.Skip(skip).Take(pageSize).Select(s => s.Id).ToList();
            }
            else
            {
                screenIds = await query
                    .Skip(skip)
                    .Take(pageSize)
                    .Select(s => s.Id)
                    .ToListAsync();

                totalCount = await query.CountAsync();
            }
            
            // If no screens, return empty result fast
            if (!screenIds.Any())
            {
                return Ok(ApiResponse<SearchScreensResult>.SuccessResponse(new SearchScreensResult
                {
                    Screens = new List<ScreenDto>(),
                    TotalCount = 0,
                    Page = request.Page,
                    PageSize = pageSize,
                    TotalPages = 0
                }));
            }
            
            // Fetch screens with their data using projection (efficient single query)
            var screens = await _context.Screens
                .AsNoTracking()
                .Where(s => screenIds.Contains(s.Id))
                .Select(s => new ScreenDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    Description = s.Description,
                    PhysicalWidth = s.PhysicalWidth,
                    PhysicalHeight = s.PhysicalHeight,
                    DimensionUnit = s.DimensionUnit,
                    ResolutionWidth = s.ResolutionWidth,
                    ResolutionHeight = s.ResolutionHeight,
                    Location = new AddressDto
                    {
                        Street = s.Location.Street,
                        City = s.Location.City,
                        State = s.Location.State,
                        Country = s.Location.Country,
                        PostalCode = s.Location.PostalCode
                    },
                    Latitude = s.Latitude,
                    Longitude = s.Longitude,
                    Timezone = s.Timezone,
                    TimeFrameMinutes = s.TimeFrameMinutes,
                    SlotsPerFrame = s.SlotsPerFrame,
                    DeviceId = s.DeviceId,
                    Status = s.Status.ToString(),
                    PricePerSlot = s.PricePerSlot,
                    Currency = s.Currency,
                    ImpressionsPerSlot = s.ImpressionsPerSlot,
                    DailyTotalImpressions = s.DailyTotalImpressions,
                    IsOnline = s.IsOnline,
                    LastSeenAt = s.LastSeenAt,
                    CreatedAt = s.CreatedAt,
                    LastTaggedAt = s.LastTaggedAt,
                    // Phase 2 fields
                    DisplayType = s.DisplayType.ToString(),
                    Orientation = s.Orientation.ToString(),
                    VerificationStatus = s.VerificationStatus.ToString(),
                    Cpm = s.ImpressionsPerSlot > 0 ? (decimal?)(s.PricePerSlot * 1000m / s.ImpressionsPerSlot) : null,
                    OwnerDisplayName = s.Owner != null
                        ? (string.IsNullOrEmpty(s.Owner.CompanyName)
                            ? (s.Owner.FirstName + " " + s.Owner.LastName).Trim()
                            : s.Owner.CompanyName)
                        : null,
                    OwnerIsVerified = s.Owner != null && s.Owner.IsEmailVerified,
                    Tags = s.TagAssignments.Select(ta => new ScreenTagSummaryDto
                    {
                        TagId = ta.TagId,
                        Slug = ta.Tag.Slug,
                        DisplayName = ta.Tag.DisplayName,
                        Category = ta.Tag.Category.ToString(),
                        IconName = ta.Tag.IconName,
                        ColorCode = ta.Tag.ColorCode,
                        IsPrimary = ta.IsPrimary,
                        Source = ta.Source.ToString()
                    }).ToList(),
                    PrimaryTags = s.TagAssignments
                        .Where(ta => ta.IsPrimary)
                        .Select(ta => new ScreenTagSummaryDto
                        {
                            TagId = ta.TagId,
                            Slug = ta.Tag.Slug,
                            DisplayName = ta.Tag.DisplayName,
                            Category = ta.Tag.Category.ToString(),
                            IconName = ta.Tag.IconName,
                            ColorCode = ta.Tag.ColorCode,
                            IsPrimary = true,
                            Source = ta.Source.ToString()
                        }).ToList(),
                    // Images
                    Images = s.Images
                        .OrderBy(img => img.DisplayOrder)
                        .Select(img => new ScreenImageDto
                        {
                            Id = img.Id,
                            ImageUrl = img.ImageUrl,
                            ImageType = img.ImageType.ToString(),
                            DisplayOrder = img.DisplayOrder,
                            IsPrimary = img.IsPrimary,
                            OriginalFileName = img.OriginalFileName,
                            SizeBytes = img.SizeBytes,
                            ContentType = img.ContentType,
                            Width = img.Width,
                            Height = img.Height,
                            UploadedAt = img.UploadedAt
                        }).ToList(),
                    PrimaryImage = s.Images
                        .Where(img => img.IsPrimary)
                        .Select(img => new ScreenImageDto
                        {
                            Id = img.Id,
                            ImageUrl = img.ImageUrl,
                            ImageType = img.ImageType.ToString(),
                            DisplayOrder = img.DisplayOrder,
                            IsPrimary = img.IsPrimary,
                            OriginalFileName = img.OriginalFileName,
                            SizeBytes = img.SizeBytes,
                            ContentType = img.ContentType,
                            Width = img.Width,
                            Height = img.Height,
                            UploadedAt = img.UploadedAt
                        }).FirstOrDefault()
                })
                .ToListAsync();
            
            // Maintain original sort order
            var orderedScreens = screenIds
                .Select(id => screens.FirstOrDefault(s => s.Id == id))
                .Where(s => s != null)
                .Cast<ScreenDto>()
                .ToList();

            // Compute DistanceKm (Haversine) when the request supplied a reference lat/lng.
            if (request.Latitude.HasValue && request.Longitude.HasValue)
            {
                var refLat = (double)request.Latitude.Value;
                var refLng = (double)request.Longitude.Value;
                foreach (var screen in orderedScreens)
                {
                    screen.DistanceKm = ComputeHaversineKm(refLat, refLng, (double)screen.Latitude, (double)screen.Longitude);
                }
            }

            // Fetch operating schedules in one batch to compute AverageOperatingHoursPerDay (avoids EF translating value-object aggregation).
            var schedules = await _context.Screens
                .AsNoTracking()
                .Where(s => screenIds.Contains(s.Id))
                .Select(s => new { s.Id, s.Schedule })
                .ToDictionaryAsync(x => x.Id, x => x.Schedule);
            foreach (var screen in orderedScreens)
            {
                if (schedules.TryGetValue(screen.Id, out var sch) && sch != null)
                {
                    screen.AverageOperatingHoursPerDay = sch.GetAverageOperatingHoursPerDay();
                }
            }
            
            var result = new SearchScreensResult
            {
                Screens = orderedScreens,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            };
            
            return Ok(ApiResponse<SearchScreensResult>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching screens");
            return StatusCode(500, ApiResponse<SearchScreensResult>.ErrorResponse("Failed to search screens."));
        }
    }

    /// <summary>
    /// Returns distinct city / state values from active, verified, public screens
    /// for advertiser location-autocomplete inputs.
    /// </summary>
    /// <param name="q">Case-insensitive prefix/substring filter.</param>
    /// <param name="kind">"city" (default) or "state".</param>
    /// <param name="limit">Max results (default 20, max 50).</param>
    [HttpGet("locations")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<IEnumerable<LocationSuggestionDto>>>> GetLocationSuggestions(
        [FromQuery] string? q = null,
        [FromQuery] string kind = "city",
        [FromQuery] int limit = 20)
    {
        try
        {
            limit = Math.Clamp(limit, 1, 50);
            var kindLower = (kind ?? "city").Trim().ToLowerInvariant();
            var query = _context.Screens.AsNoTracking()
                .Where(s => !s.IsDeleted
                    && s.Status == CCMS.Domain.Enums.ScreenStatus.Active
                    && s.VerificationStatus == CCMS.Domain.Enums.ScreenVerificationStatus.Verified
                    && s.Owner.AccountVisibility == CCMS.Domain.Enums.ScreenVisibility.Public);

            if (kindLower == "state")
            {
                var states = await query
                    .Where(s => s.Location.State != null && (q == null || EF.Functions.ILike(s.Location.State!, $"%{q}%")))
                    .GroupBy(s => s.Location.State!)
                    .Select(g => new LocationSuggestionDto
                    {
                        Label = g.Key,
                        Kind = "state",
                        State = g.Key,
                        ScreenCount = g.Count(),
                        CenterLatitude = g.Average(x => x.Latitude),
                        CenterLongitude = g.Average(x => x.Longitude)
                    })
                    .OrderByDescending(x => x.ScreenCount)
                    .Take(limit)
                    .ToListAsync();
                return Ok(ApiResponse<IEnumerable<LocationSuggestionDto>>.SuccessResponse(states));
            }
            else
            {
                var cities = await query
                    .Where(s => s.Location.City != null && (q == null || EF.Functions.ILike(s.Location.City!, $"%{q}%")))
                    .GroupBy(s => new { s.Location.City, s.Location.State })
                    .Select(g => new LocationSuggestionDto
                    {
                        Label = g.Key.State != null ? g.Key.City + ", " + g.Key.State : g.Key.City!,
                        Kind = "city",
                        City = g.Key.City,
                        State = g.Key.State,
                        ScreenCount = g.Count(),
                        CenterLatitude = g.Average(x => x.Latitude),
                        CenterLongitude = g.Average(x => x.Longitude)
                    })
                    .OrderByDescending(x => x.ScreenCount)
                    .Take(limit)
                    .ToListAsync();
                return Ok(ApiResponse<IEnumerable<LocationSuggestionDto>>.SuccessResponse(cities));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving location suggestions");
            return StatusCode(500, ApiResponse<IEnumerable<LocationSuggestionDto>>.ErrorResponse("Failed to retrieve location suggestions."));
        }
    }

    /// <summary>
    /// Upgrades a CMS screen to marketplace (MediaOwner) mode by supplying
    /// the missing marketplace-required fields: pricing, address, schedule.
    /// Only the owning ScreenOwner may call this.
    /// </summary>
    [HttpPut("{id}/upgrade-to-marketplace")]
    [Authorize(Roles = "ScreenOwner")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> UpgradeToMarketplace(
        Guid id, [FromBody] UpgradeScreenToMarketplaceRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Validate slot configuration
            if (request.TimeFrameMinutes <= 0)
                return BadRequest(ApiResponse<ScreenDto>.ErrorResponse("TimeFrameMinutes must be positive"));
            if (request.SlotsPerFrame <= 0)
                return BadRequest(ApiResponse<ScreenDto>.ErrorResponse("SlotsPerFrame must be positive"));
            var totalSeconds = request.TimeFrameMinutes * 60;
            if (totalSeconds % request.SlotsPerFrame != 0)
                return BadRequest(ApiResponse<ScreenDto>.ErrorResponse(
                    $"Frame time ({request.TimeFrameMinutes} min) must divide evenly by {request.SlotsPerFrame} slots."));
            if (request.PricePerSlot <= 0)
                return BadRequest(ApiResponse<ScreenDto>.ErrorResponse("PricePerSlot must be positive"));

            var updateRequest = new UpdateScreenRequest
            {
                PricePerSlot = request.PricePerSlot,
                Location = request.Location,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                Timezone = request.Timezone,
                Schedule = request.Schedule,
                TimeFrameMinutes = request.TimeFrameMinutes,
                SlotsPerFrame = request.SlotsPerFrame,
            };

            var command = new UpdateScreenCommand
            {
                ScreenId = id,
                UserId = userId,
                Request = updateRequest
            };

            var result = await _mediator.Send(command);
            return Ok(ApiResponse<ScreenDto>.SuccessResponse(result, "Screen upgraded to marketplace"));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, ApiResponse<ScreenDto>.ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<ScreenDto>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upgrading screen {ScreenId} to marketplace", id);
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse("Failed to upgrade screen to marketplace."));
        }
    }

    private async Task<bool> IsScreenPrivateAsync(Guid screenId)
    {
        var ownerVisibility = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId && !s.IsDeleted)
            .Join(_context.Users, s => s.OwnerId, u => u.Id, (s, u) => (ScreenVisibility?)u.AccountVisibility)
            .FirstOrDefaultAsync();

        return ownerVisibility == null || ownerVisibility == ScreenVisibility.Private;
    }

    /// <summary>
    /// Update screen settings (auto-approval, etc.).
    /// </summary>
    [HttpPut("{id}/settings")]
    [Authorize(Roles = "ScreenOwner")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateSettings(
        Guid id, [FromBody] UpdateScreenSettingsRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var screen = await _context.Screens
            .FirstOrDefaultAsync(s => s.Id == id && s.OwnerId == userId && !s.IsDeleted);

        if (screen == null)
            return NotFound(ApiResponse<bool>.ErrorResponse("Screen not found"));

        screen.AutoApprovalEnabled = request.AutoApprovalEnabled;
        screen.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Settings updated"));
    }

    /// <summary>Get AQS breakdown details for a screen</summary>
    [HttpGet("{id}/aqs-details")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAqsDetails(Guid id)
    {
        var screen = await _context.Screens.AsNoTracking()
            .Where(s => s.Id == id && !s.IsDeleted)
            .Select(s => new { s.Id, s.Name, s.AudienceQualityScore, s.LastSeenAt, s.UpdatedAt })
            .FirstOrDefaultAsync();

        if (screen == null) return NotFound(ApiResponse<object>.ErrorResponse("Screen not found"));

        // Compute component scores from bookings/impressions data
        var totalBookings = await _context.Bookings.AsNoTracking()
            .CountAsync(b => b.ScreenId == id && !b.IsDeleted);
        var completedBookings = await _context.Bookings.AsNoTracking()
            .CountAsync(b => b.ScreenId == id && b.Status == BookingStatus.Completed && !b.IsDeleted);

        var fillRate = totalBookings > 0 ? Math.Round((decimal)completedBookings / totalBookings * 100, 1) : 0m;
        var uptime = screen.LastSeenAt.HasValue && screen.LastSeenAt > DateTime.UtcNow.AddMinutes(-10) ? 95m : 60m;
        var footfall = screen.AudienceQualityScore > 0 ? Math.Round(screen.AudienceQualityScore * 1.1m, 1) : 0m;

        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            screenId = id,
            score = screen.AudienceQualityScore,
            components = new
            {
                footfall = Math.Min(footfall, 100m),
                uptime,
                fillRate,
                review = (decimal?)null
            },
            calculatedAt = screen.UpdatedAt
        }));
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /// <summary>
    /// Great-circle distance in km between two WGS84 coordinates (Haversine).
    /// </summary>
    private static double ComputeHaversineKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double earthRadiusKm = 6371.0;
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return Math.Round(earthRadiusKm * c, 2);
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}

public class GenerateApiKeyResponse
{
    public Guid ScreenId { get; set; }
    public string ApiKey { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class DeviceOverrideRequest
{
    public string Reason { get; set; } = "Device replacement";
}

public class DeviceOverrideResponse
{
    public Guid ScreenId { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class DeviceBindingStatusResponse
{
    public Guid ScreenId { get; set; }
    public bool IsBound { get; set; }
    public DateTime? BoundAt { get; set; }
    public DateTime? LastVerification { get; set; }
    public bool HasPendingOverride { get; set; }
    public DateTime? PendingOverrideExpiresAt { get; set; }
}
