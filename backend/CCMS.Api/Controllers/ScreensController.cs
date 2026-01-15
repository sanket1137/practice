using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CCMS.Api.Extensions;
using CCMS.Application.Features.Screens.Commands;
using CCMS.Application.Features.Screens.Queries;
using CCMS.Application.Features.OwnerContent.Commands;
using CCMS.Application.Features.OwnerContent.Queries;
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

    public ScreensController(IMediator mediator)
    {
        _mediator = mediator;
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
