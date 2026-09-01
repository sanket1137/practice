using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CCMS.Api.Extensions;
using CCMS.Api.Services;
using CCMS.Application.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Verification;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/screens/{screenId}/verification")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class ScreenVerificationController : ControllerBase
{
    private readonly ScreenVerificationService _verificationService;
    private readonly ApplicationDbContext _context;
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger<ScreenVerificationController> _logger;

    private const long MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
    private static readonly HashSet<string> AllowedVideoTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "video/mp4", "video/webm", "video/quicktime"
    };

    public ScreenVerificationController(
        ScreenVerificationService verificationService,
        ApplicationDbContext context,
        IFileStorageService fileStorage,
        ILogger<ScreenVerificationController> logger)
    {
        _verificationService = verificationService;
        _context = context;
        _fileStorage = fileStorage;
        _logger = logger;
    }

    // ── Player endpoints (API key auth via PlayerController pattern) ──

    /// <summary>
    /// Player requests a new QR challenge code.
    /// Called every 5 minutes by the player application.
    /// Authenticated via API key in request body.
    /// </summary>
    [HttpPost("qr-challenge")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.PlayerPolicy)]
    public async Task<ActionResult<ApiResponse<QrChallengeResponse>>> GenerateQrChallenge(
        Guid screenId,
        [FromBody] PlayerQrChallengeRequest request)
    {
        // Validate API key (same pattern as PlayerController, rotation-grace aware)
        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId && !s.IsDeleted)
            .Select(s => new { s.ApiKeyHash, s.ApiKeyHashPrevious, s.ApiKeyRotatedAt })
            .FirstOrDefaultAsync();

        if (screen == null)
            return NotFound(ApiResponse<QrChallengeResponse>.ErrorResponse("Screen not found"));

        if (!string.IsNullOrEmpty(screen.ApiKeyHash))
        {
            if (!CCMS.Api.Security.ScreenApiKeys.Verify(request.ApiKey, screen.ApiKeyHash, screen.ApiKeyHashPrevious, screen.ApiKeyRotatedAt))
            {
                return Unauthorized(ApiResponse<QrChallengeResponse>.ErrorResponse("Invalid API key"));
            }
        }

        var (code, expiresAt) = await _verificationService.GenerateQrChallengeAsync(screenId);

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var qrContent = $"{baseUrl}/verify/{screenId}?code={code}";

        var response = new QrChallengeResponse
        {
            Code = code,
            ExpiresAt = expiresAt,
            QrContent = qrContent
        };

        return Ok(ApiResponse<QrChallengeResponse>.SuccessResponse(response));
    }

    /// <summary>
    /// Player polls for current verification status.
    /// </summary>
    [HttpGet("status")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.PlayerPolicy)]
    public async Task<ActionResult<ApiResponse<ScreenVerificationStatusResponse>>> GetVerificationStatus(Guid screenId)
    {
        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId && !s.IsDeleted)
            .Select(s => new { s.VerificationStatus })
            .FirstOrDefaultAsync();

        if (screen == null)
            return NotFound(ApiResponse<ScreenVerificationStatusResponse>.ErrorResponse("Screen not found"));

        var response = new ScreenVerificationStatusResponse
        {
            Status = screen.VerificationStatus.ToString(),
            CanPlay = screen.VerificationStatus == ScreenVerificationStatus.Verified
        };

        return Ok(ApiResponse<ScreenVerificationStatusResponse>.SuccessResponse(response));
    }

    // ── Owner endpoints (Bearer token auth) ──

    /// <summary>
    /// Owner scans the QR code from their phone.
    /// Validates the challenge code, GPS proximity, and ownership.
    /// </summary>
    [HttpPost("scan")]
    [Authorize(Roles = "ScreenOwner")]
    public async Task<ActionResult<ApiResponse<ScanQrResponse>>> ScanQr(
        Guid screenId,
        [FromBody] ScanQrRequest request)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<ScanQrResponse>.ErrorResponse("User not authenticated"));

        if (string.IsNullOrWhiteSpace(request.ChallengeCode))
            return BadRequest(ApiResponse<ScanQrResponse>.ErrorResponse("Challenge code is required"));

        var (success, error, verification) = await _verificationService.ValidateScanAsync(
            screenId, userId.Value, request.ChallengeCode, request.GpsLatitude, request.GpsLongitude);

        if (!success)
            return BadRequest(ApiResponse<ScanQrResponse>.ErrorResponse(error!));

        return Ok(ApiResponse<ScanQrResponse>.SuccessResponse(new ScanQrResponse
        {
            VerificationId = verification!.Id,
            Message = "QR scan validated. Please record and upload a verification video."
        }));
    }

    /// <summary>
    /// Owner uploads a 30-60 second verification video.
    /// Must show the QR on screen + 360° pan of surroundings.
    /// </summary>
    [HttpPost("{verificationId}/upload-video")]
    [Authorize(Roles = "ScreenOwner")]
    [RequestSizeLimit(MAX_VIDEO_SIZE_BYTES)]
    public async Task<ActionResult<ApiResponse<string>>> UploadVerificationVideo(
        Guid screenId,
        Guid verificationId,
        IFormFile video)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<string>.ErrorResponse("User not authenticated"));

        // Validate file
        if (video == null || video.Length == 0)
            return BadRequest(ApiResponse<string>.ErrorResponse("Video file is required"));

        if (video.Length > MAX_VIDEO_SIZE_BYTES)
            return BadRequest(ApiResponse<string>.ErrorResponse("Video must be under 100MB"));

        if (!AllowedVideoTypes.Contains(video.ContentType))
            return BadRequest(ApiResponse<string>.ErrorResponse("Only MP4, WebM, and QuickTime video formats are accepted"));

        // Verify the verification record exists and belongs to this user/screen
        var verification = await _context.ScreenVerifications
            .Where(v => v.Id == verificationId && v.ScreenId == screenId && v.RequestedByUserId == userId)
            .FirstOrDefaultAsync();

        if (verification == null)
            return NotFound(ApiResponse<string>.ErrorResponse("Verification not found"));

        if (verification.VideoUrl != null)
            return BadRequest(ApiResponse<string>.ErrorResponse("Video has already been uploaded for this verification"));

        // Upload to R2
        var fileName = $"verification-videos/{screenId}/{verificationId}{GetExtension(video.ContentType)}";
        using var stream = video.OpenReadStream();
        var videoUrl = await _fileStorage.UploadFileAsync(stream, fileName, video.ContentType);

        // Update verification record
        verification.VideoUrl = videoUrl;
        verification.UpdatedAt = DateTime.UtcNow;

        // Update screen status to PendingReview
        var screen = await _context.Screens.FindAsync(screenId);
        if (screen != null)
        {
            screen.VerificationStatus = ScreenVerificationStatus.PendingReview;
            screen.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Verification video uploaded for screen {ScreenId}, verification {VerificationId}",
            screenId, verificationId);

        return Ok(ApiResponse<string>.SuccessResponse("Video uploaded successfully. Admin will review shortly."));
    }

    /// <summary>
    /// Get verification history for a screen (owner view).
    /// </summary>
    [HttpGet("history")]
    [Authorize(Roles = "ScreenOwner,Admin")]
    public async Task<ActionResult<ApiResponse<List<VerificationHistoryItemDto>>>> GetVerificationHistory(Guid screenId)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<List<VerificationHistoryItemDto>>.ErrorResponse("User not authenticated"));

        // Verify ownership
        var screen = await _context.Screens
            .AsNoTracking()
            .Where(s => s.Id == screenId && !s.IsDeleted)
            .Select(s => new { s.OwnerId })
            .FirstOrDefaultAsync();

        if (screen == null)
            return NotFound(ApiResponse<List<VerificationHistoryItemDto>>.ErrorResponse("Screen not found"));

        var isAdmin = User.IsInRole("Admin");
        if (screen.OwnerId != userId && !isAdmin)
            return Forbid();

        var history = await _context.ScreenVerifications
            .AsNoTracking()
            .Where(v => v.ScreenId == screenId)
            .OrderByDescending(v => v.CreatedAt)
            .Take(20)
            .Select(v => new VerificationHistoryItemDto
            {
                Id = v.Id,
                Status = v.Status.ToString(),
                DeviceType = v.DeviceType,
                RejectionReason = v.RejectionReason,
                CreatedAt = v.CreatedAt,
                AdminReviewedAt = v.AdminReviewedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<VerificationHistoryItemDto>>.SuccessResponse(history));
    }

    #region Helpers

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return claim != null ? Guid.Parse(claim) : null;
    }

    private static string GetExtension(string contentType) => contentType switch
    {
        "video/mp4" => ".mp4",
        "video/webm" => ".webm",
        "video/quicktime" => ".mov",
        _ => ".mp4"
    };

    #endregion
}

/// <summary>
/// Request body for player QR challenge generation (API key auth).
/// </summary>
public class PlayerQrChallengeRequest
{
    public string ApiKey { get; set; } = string.Empty;
}
