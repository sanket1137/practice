using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Extensions;
using CCMS.Api.Services;
using CCMS.Infrastructure.Data;
using CCMS.Domain.Enums;
using CCMS.Shared.Common;
using Asp.Versioning;


namespace CCMS.Api.Controllers;

/// <summary>
/// Manages device binding lifecycle for player screens.
/// Exposes PlayerDeviceManager functionality via REST API.
/// Owners can view binding status and request overrides.
/// Admins can additionally clear bindings entirely.
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/devices")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class DeviceManagementController : ControllerBase
{
    private readonly PlayerDeviceManager _deviceManager;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DeviceManagementController> _logger;

    public DeviceManagementController(
        PlayerDeviceManager deviceManager,
        ApplicationDbContext context,
        ILogger<DeviceManagementController> logger)
    {
        _deviceManager = deviceManager;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get device binding status for a screen.
    /// Accessible by screen owner and admins.
    /// </summary>
    [HttpGet("{screenId}/binding")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<DeviceBindingStatusDto>>> GetBindingStatus(Guid screenId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(ApiResponse<DeviceBindingStatusDto>.ErrorResponse("User not authenticated"));

        // Verify ownership or admin
        if (!await CanAccessScreen(screenId, userId.Value))
            return Forbid();

        var status = await _deviceManager.GetDeviceBindingStatusAsync(screenId);
        if (status == null)
            return NotFound(ApiResponse<DeviceBindingStatusDto>.ErrorResponse("Screen not found"));

        // Get screen name for display
        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId)
            .Select(s => new { s.Name, s.DeviceOverrideReason, s.DeviceOverrideAt, s.DeviceOverrideByUserId })
            .FirstOrDefaultAsync();

        var dto = new DeviceBindingStatusDto
        {
            ScreenId = status.ScreenId,
            ScreenName = screen?.Name ?? "",
            IsBound = status.IsBound,
            BoundAt = status.BoundAt,
            LastVerification = status.LastVerification,
            HasPendingOverride = status.HasPendingOverride,
            PendingOverrideExpiresAt = status.PendingOverrideExpiresAt,
            LastOverrideReason = screen?.DeviceOverrideReason,
            LastOverrideAt = screen?.DeviceOverrideAt,
            LastOverrideByUserId = screen?.DeviceOverrideByUserId
        };

        return Ok(ApiResponse<DeviceBindingStatusDto>.SuccessResponse(dto));
    }

    /// <summary>
    /// Request a device override for a screen.
    /// Opens a 30-minute window for a new device to bind.
    /// Accessible by screen owner and admins.
    /// </summary>
    [HttpPost("{screenId}/override")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<DeviceOverrideResultDto>>> RequestOverride(
        Guid screenId,
        [FromBody] DeviceOverrideRequestDto request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(ApiResponse<DeviceOverrideResultDto>.ErrorResponse("User not authenticated"));

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(ApiResponse<DeviceOverrideResultDto>.ErrorResponse("Override reason is required"));

        // Verify ownership or admin
        if (!await CanAccessScreen(screenId, userId.Value))
            return Forbid();

        var result = await _deviceManager.RequestDeviceOverrideAsync(screenId, userId.Value, request.Reason);

        var dto = new DeviceOverrideResultDto
        {
            Success = result.Success,
            Reason = result.Reason,
            ExpiresAt = result.ExpiresAt
        };

        if (!result.Success)
            return BadRequest(ApiResponse<DeviceOverrideResultDto>.ErrorResponse(result.Reason));

        return Ok(ApiResponse<DeviceOverrideResultDto>.SuccessResponse(dto, result.Reason));
    }

    /// <summary>
    /// Clear device binding entirely.
    /// Removes the fingerprint hash so any new device can register.
    /// Admin-only operation.
    /// </summary>
    [HttpPost("{screenId}/clear")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<string>>> ClearBinding(Guid screenId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(ApiResponse<string>.ErrorResponse("User not authenticated"));

        var success = await _deviceManager.ClearDeviceBindingAsync(screenId, userId.Value);

        if (!success)
            return BadRequest(ApiResponse<string>.ErrorResponse("Failed to clear device binding. Screen not found or access denied."));

        return Ok(ApiResponse<string>.SuccessResponse("Device binding cleared successfully"));
    }

    /// <summary>
    /// Get device binding history for a screen.
    /// Returns audit trail of binding changes from the DeviceOverrideHistory table.
    /// Accessible by screen owner and admins.
    /// </summary>
    [HttpGet("{screenId}/history")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<IEnumerable<DeviceOverrideHistoryDto>>>> GetHistory(Guid screenId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(ApiResponse<IEnumerable<DeviceOverrideHistoryDto>>.ErrorResponse("User not authenticated"));

        if (!await CanAccessScreen(screenId, userId.Value))
            return Forbid();

        var history = await _context.DeviceOverrideHistories
            .AsNoTracking()
            .Where(h => h.ScreenId == screenId)
            .OrderByDescending(h => h.CreatedAt)
            .Take(50)
            .Select(h => new DeviceOverrideHistoryDto
            {
                Id = h.Id,
                ScreenId = h.ScreenId,
                Action = h.Action,
                Reason = h.Reason,
                OldFingerprintPrefix = h.OldFingerprintHash != null ? h.OldFingerprintHash.Substring(0, 8) + "..." : null,
                NewFingerprintPrefix = h.NewFingerprintHash != null ? h.NewFingerprintHash.Substring(0, 8) + "..." : null,
                RequestedByUserId = h.RequestedByUserId,
                PerformedAt = h.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<DeviceOverrideHistoryDto>>.SuccessResponse(history));
    }

    #region Helpers

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return claim != null ? Guid.Parse(claim) : null;
    }

    /// <summary>
    /// Check if user is the screen owner or an admin.
    /// </summary>
    private async Task<bool> CanAccessScreen(Guid screenId, Guid userId)
    {
        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId && !s.IsDeleted)
            .Select(s => new { s.OwnerId })
            .FirstOrDefaultAsync();

        if (screen == null) return false;

        // Owner can access their own screen
        if (screen.OwnerId == userId) return true;

        // Admin can access any screen
        var user = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Role })
            .FirstOrDefaultAsync();

        return user?.Role == UserRole.Admin;
    }

    #endregion
}

#region DTOs

public class DeviceBindingStatusDto
{
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public bool IsBound { get; set; }
    public DateTime? BoundAt { get; set; }
    public DateTime? LastVerification { get; set; }
    public bool HasPendingOverride { get; set; }
    public DateTime? PendingOverrideExpiresAt { get; set; }
    public string? LastOverrideReason { get; set; }
    public DateTime? LastOverrideAt { get; set; }
    public Guid? LastOverrideByUserId { get; set; }
}

public class DeviceOverrideRequestDto
{
    public string Reason { get; set; } = string.Empty;
}

public class DeviceOverrideResultDto
{
    public bool Success { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime? ExpiresAt { get; set; }
}

public class DeviceOverrideHistoryDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? OldFingerprintPrefix { get; set; }
    public string? NewFingerprintPrefix { get; set; }
    public Guid RequestedByUserId { get; set; }
    public DateTime PerformedAt { get; set; }
}

#endregion
