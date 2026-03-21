using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Extensions;
using CCMS.Api.Services;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Verification;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/admin/verifications")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class AdminVerificationsController : ControllerBase
{
    private readonly ScreenVerificationService _verificationService;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminVerificationsController> _logger;

    public AdminVerificationsController(
        ScreenVerificationService verificationService,
        ApplicationDbContext context,
        ILogger<AdminVerificationsController> logger)
    {
        _verificationService = verificationService;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get paginated list of screen verifications for admin review.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<AdminVerificationListItemDto>>>> GetVerifications(
        [FromQuery] string? status = null,
        [FromQuery] string? deviceType = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(page, 1);

        var query = _context.ScreenVerifications
            .AsNoTracking()
            .Include(v => v.Screen)
            .Include(v => v.RequestedByUser)
            .AsQueryable();

        // Filter by status
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ScreenVerificationStatus>(status, true, out var statusEnum))
        {
            query = query.Where(v => v.Status == statusEnum);
        }

        // Filter by device type
        if (!string.IsNullOrEmpty(deviceType))
        {
            query = query.Where(v => v.DeviceType == deviceType);
        }

        // Search by screen name or owner name/email
        if (!string.IsNullOrEmpty(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(v =>
                v.Screen.Name.ToLower().Contains(searchLower) ||
                v.RequestedByUser.FirstName.ToLower().Contains(searchLower) ||
                v.RequestedByUser.LastName.ToLower().Contains(searchLower) ||
                v.RequestedByUser.Email.ToLower().Contains(searchLower));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new AdminVerificationListItemDto
            {
                Id = v.Id,
                ScreenId = v.ScreenId,
                ScreenName = v.Screen.Name,
                OwnerName = v.RequestedByUser.FirstName + " " + v.RequestedByUser.LastName,
                OwnerEmail = v.RequestedByUser.Email,
                DeviceType = v.DeviceType,
                Status = v.Status.ToString(),
                ScanGpsLatitude = v.ScanGpsLatitude,
                ScanGpsLongitude = v.ScanGpsLongitude,
                ScreenLatitude = v.Screen.Latitude,
                ScreenLongitude = v.Screen.Longitude,
                CreatedAt = v.CreatedAt,
                HasVideo = v.VideoUrl != null
            })
            .ToListAsync();

        var result = new PagedResult<AdminVerificationListItemDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = page,
            PageSize = pageSize
        };

        return Ok(ApiResponse<PagedResult<AdminVerificationListItemDto>>.SuccessResponse(result));
    }

    /// <summary>
    /// Get detailed verification info for admin review.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<AdminVerificationDetailDto>>> GetVerificationDetail(Guid id)
    {
        var verification = await _context.ScreenVerifications
            .AsNoTracking()
            .Include(v => v.Screen)
            .Include(v => v.RequestedByUser)
            .Include(v => v.AdminReviewedByUser)
            .Where(v => v.Id == id)
            .FirstOrDefaultAsync();

        if (verification == null)
            return NotFound(ApiResponse<AdminVerificationDetailDto>.ErrorResponse("Verification not found"));

        double? gpsDistance = null;
        if (verification.ScanGpsLatitude.HasValue && verification.ScanGpsLongitude.HasValue)
        {
            gpsDistance = ScreenVerificationService.CalculateHaversineDistance(
                (double)verification.Screen.Latitude, (double)verification.Screen.Longitude,
                (double)verification.ScanGpsLatitude.Value, (double)verification.ScanGpsLongitude.Value);
        }

        var detail = new AdminVerificationDetailDto
        {
            Id = verification.Id,
            ScreenId = verification.ScreenId,
            ScreenName = verification.Screen.Name,
            ScreenAddress = verification.Screen.Location?.ToString() ?? "",
            OwnerName = $"{verification.RequestedByUser.FirstName} {verification.RequestedByUser.LastName}",
            OwnerEmail = verification.RequestedByUser.Email,
            VideoUrl = verification.VideoUrl,
            DeviceType = verification.DeviceType,
            DeviceFingerprintPrefix = verification.DeviceFingerprintHash != null
                ? verification.DeviceFingerprintHash[..Math.Min(8, verification.DeviceFingerprintHash.Length)] + "..."
                : null,
            QrChallengeCode = verification.QrChallengeCode,
            ScanGpsLatitude = verification.ScanGpsLatitude,
            ScanGpsLongitude = verification.ScanGpsLongitude,
            ScreenLatitude = verification.Screen.Latitude,
            ScreenLongitude = verification.Screen.Longitude,
            GpsDistanceMeters = gpsDistance,
            PlayerIpAddress = verification.PlayerIpAddress,
            Status = verification.Status.ToString(),
            RejectionReason = verification.RejectionReason,
            CreatedAt = verification.CreatedAt,
            AdminReviewedAt = verification.AdminReviewedAt,
            AdminReviewedByName = verification.AdminReviewedByUser != null
                ? $"{verification.AdminReviewedByUser.FirstName} {verification.AdminReviewedByUser.LastName}"
                : null
        };

        return Ok(ApiResponse<AdminVerificationDetailDto>.SuccessResponse(detail));
    }

    /// <summary>
    /// Approve a screen verification. Screen transitions to Verified.
    /// </summary>
    [HttpPost("{id}/approve")]
    public async Task<ActionResult<ApiResponse<string>>> ApproveVerification(Guid id)
    {
        var adminId = GetUserId();
        if (adminId == null)
            return Unauthorized(ApiResponse<string>.ErrorResponse("Admin not authenticated"));

        var (success, error) = await _verificationService.ApproveVerificationAsync(id, adminId.Value);

        if (!success)
            return BadRequest(ApiResponse<string>.ErrorResponse(error!));

        return Ok(ApiResponse<string>.SuccessResponse("Verification approved. Screen is now verified."));
    }

    /// <summary>
    /// Reject a screen verification with reason.
    /// </summary>
    [HttpPost("{id}/reject")]
    public async Task<ActionResult<ApiResponse<string>>> RejectVerification(
        Guid id,
        [FromBody] AdminRejectVerificationRequest request)
    {
        var adminId = GetUserId();
        if (adminId == null)
            return Unauthorized(ApiResponse<string>.ErrorResponse("Admin not authenticated"));

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(ApiResponse<string>.ErrorResponse("Rejection reason is required"));

        var (success, error) = await _verificationService.RejectVerificationAsync(id, adminId.Value, request.Reason);

        if (!success)
            return BadRequest(ApiResponse<string>.ErrorResponse(error!));

        return Ok(ApiResponse<string>.SuccessResponse("Verification rejected."));
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return claim != null ? Guid.Parse(claim) : null;
    }
}
