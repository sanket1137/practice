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
using CCMS.Infrastructure.Services;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Screens;
using CCMS.Shared.DTOs.OwnerContent;

namespace CCMS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class ScreensController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ScreenTaggingService _taggingService;
    private readonly ApplicationDbContext _context;

    public ScreensController(
        IMediator mediator,
        ScreenTaggingService taggingService,
        ApplicationDbContext context)
    {
        _mediator = mediator;
        _taggingService = taggingService;
        _context = context;
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
            
            var result = await _mediator.Send(query);
            return Ok(ApiResponse<IEnumerable<ScreenDto>>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<IEnumerable<ScreenDto>>.ErrorResponse($"Error retrieving screens: {ex.Message}"));
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ScreenDto>>> GetById(Guid id)
    {
        try
        {
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
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse($"Error retrieving screen: {ex.Message}"));
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
            var errorMessage = $"Error creating screen: {ex.Message}";
            if (ex.InnerException != null)
            {
                errorMessage += $" Inner: {ex.InnerException.Message}";
            }
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse(errorMessage));
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
            return StatusCode(500, ApiResponse<ScreenAvailabilityDto>.ErrorResponse($"Error checking availability: {ex.Message}"));
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
            var query = new GetSlotCalendarQuery
            {
                ScreenId = id,
                StartDate = startDate.Date,
                EndDate = endDate.Date
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
            return StatusCode(500, ApiResponse<SlotCalendarDto>.ErrorResponse($"Error retrieving calendar: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<ScreenDto>.ErrorResponse($"Error updating screen: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<object>.ErrorResponse($"Error deleting screen: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<List<SlotStatusDto>>.ErrorResponse($"Error: {ex.Message}"));
        }
    }
    
    [HttpPost("{id}/slots/{slotNumber}/content")]
    [Authorize(Roles = "ScreenOwner,Admin")]
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
        catch (Exception ex) { return StatusCode(500, ApiResponse<OwnerContentDto>.ErrorResponse($"Error: {ex.Message}")); }
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
        catch (Exception ex) { return StatusCode(500, ApiResponse<object>.ErrorResponse($"Error: {ex.Message}")); }
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
            return StatusCode(500, ApiResponse<GenerateApiKeyResponse>.ErrorResponse($"Error: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<DeviceOverrideResponse>.ErrorResponse($"Error: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<DeviceBindingStatusResponse>.ErrorResponse($"Error: {ex.Message}"));
        }
    }
    
    // ==========================================
    // TAG MANAGEMENT ENDPOINTS
    // ==========================================
    
    /// <summary>
    /// Get all available tags (master tag list)
    /// </summary>
    [HttpGet("tags")]
    public async Task<ActionResult<ApiResponse<IEnumerable<MasterTagDto>>>> GetAllTags(
        [FromQuery] string? category = null)
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
            
            return Ok(ApiResponse<IEnumerable<MasterTagDto>>.SuccessResponse(tags));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<IEnumerable<MasterTagDto>>.ErrorResponse($"Error: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<IEnumerable<ScreenTagDetailDto>>.ErrorResponse($"Error: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<GenerateTagsResult>.ErrorResponse($"Error: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<bool>.ErrorResponse($"Error: {ex.Message}"));
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
            return StatusCode(500, ApiResponse<bool>.ErrorResponse($"Error: {ex.Message}"));
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
                .Where(s => !s.IsDeleted && s.Status == ScreenStatus.Active);
            
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
            
            // Sorting
            query = request.SortBy?.ToLower() switch
            {
                "name" => request.SortDirection?.ToLower() == "desc" 
                    ? query.OrderByDescending(s => s.Name) 
                    : query.OrderBy(s => s.Name),
                "price" => request.SortDirection?.ToLower() == "desc"
                    ? query.OrderByDescending(s => s.PricePerSlot)
                    : query.OrderBy(s => s.PricePerSlot),
                "created" => request.SortDirection?.ToLower() == "desc"
                    ? query.OrderByDescending(s => s.CreatedAt)
                    : query.OrderBy(s => s.CreatedAt),
                _ => query.OrderByDescending(s => s.CreatedAt)
            };
            
            // Pagination
            var pageSize = Math.Min(request.PageSize, 100);
            var skip = (request.Page - 1) * pageSize;
            
            // Use split query to avoid Cartesian explosion with tags
            // First get screen IDs and total count in a single efficient query
            var screenIds = await query
                .Skip(skip)
                .Take(pageSize)
                .Select(s => s.Id)
                .ToListAsync();
            
            var totalCount = await query.CountAsync();
            
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
                        }).ToList()
                })
                .ToListAsync();
            
            // Maintain original sort order
            var orderedScreens = screenIds
                .Select(id => screens.FirstOrDefault(s => s.Id == id))
                .Where(s => s != null)
                .Cast<ScreenDto>()
                .ToList();
            
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
            return StatusCode(500, ApiResponse<SearchScreensResult>.ErrorResponse($"Error: {ex.Message}"));
        }
    }
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
