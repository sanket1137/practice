using System.Security.Claims;
using Asp.Versioning;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Player;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CCMS.Api.Extensions;

namespace CCMS.Api.Controllers;

/// <summary>
/// Player-initiated QR pairing.
/// Players call /request to get a token + QR URL, then poll /status.
/// Dashboard users (authenticated) POST to /claim/cms or /claim/ccms after scanning.
/// </summary>
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/player/pairing")]
[EnableRateLimiting(RateLimitingExtensions.ApiPolicy)]
public class PlayerPairingController : ControllerBase
{
    private readonly IPlayerPairingService _service;

    public PlayerPairingController(IPlayerPairingService service)
    {
        _service = service;
    }

    /// <summary>
    /// Player calls this on first launch to receive a unique QR pairing token.
    /// No authentication required — unauthenticated player device.
    /// </summary>
    [HttpPost("request")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.PlayerPolicy)]
    public async Task<ActionResult<ApiResponse<RequestPlayerPairingTokenResponse>>> RequestToken(
        [FromBody] RequestPlayerPairingTokenRequest body,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.DeviceFingerprint))
            return BadRequest(ApiResponse<RequestPlayerPairingTokenResponse>
                .ErrorResponse("DeviceFingerprint is required"));

        var baseUrl = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}";
        var result = await _service.RequestTokenAsync(body, baseUrl, ct);
        return Ok(ApiResponse<RequestPlayerPairingTokenResponse>.SuccessResponse(result));
    }

    /// <summary>
    /// Player polls this (every 5 s) until IsClaimed is true, then reads ApiKey + ScreenId.
    /// </summary>
    [HttpGet("{token}/status")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.PlayerPolicy)]
    public async Task<ActionResult<ApiResponse<PlayerPairingStatusResponse>>> Status(
        string token,
        CancellationToken ct)
    {
        var result = await _service.GetStatusAsync(token, ct);
        return Ok(ApiResponse<PlayerPairingStatusResponse>.SuccessResponse(result));
    }

    /// <summary>
    /// CMS owner scans player QR in the dashboard and fills minimal screen details.
    /// </summary>
    [HttpPost("claim/cms")]
    [Authorize(Roles = "ScreenOwner")]
    public async Task<ActionResult<ApiResponse<ClaimPlayerQrResponse>>> ClaimCms(
        [FromBody] ClaimPlayerQrCmsRequest body,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<ClaimPlayerQrResponse>.ErrorResponse("Not authenticated"));

        try
        {
            var result = await _service.ClaimAsCmsAsync(userId.Value, body, ct);
            return Ok(ApiResponse<ClaimPlayerQrResponse>.SuccessResponse(result, "Screen paired"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<ClaimPlayerQrResponse>.ErrorResponse(ex.Message));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ClaimPlayerQrResponse>.ErrorResponse(ex.Message));
        }
    }

    /// <summary>
    /// CCMS / MediaOwner scans player QR and fills full screen details (pricing, schedule, location).
    /// </summary>
    [HttpPost("claim/ccms")]
    [Authorize(Roles = "ScreenOwner")]
    public async Task<ActionResult<ApiResponse<ClaimPlayerQrResponse>>> ClaimCcms(
        [FromBody] ClaimPlayerQrCcmsRequest body,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<ClaimPlayerQrResponse>.ErrorResponse("Not authenticated"));

        try
        {
            var result = await _service.ClaimAsCcmsAsync(userId.Value, body, ct);
            return Ok(ApiResponse<ClaimPlayerQrResponse>.SuccessResponse(result, "Screen paired"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<ClaimPlayerQrResponse>.ErrorResponse(ex.Message));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ClaimPlayerQrResponse>.ErrorResponse(ex.Message));
        }
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return claim != null ? Guid.Parse(claim) : null;
    }
}
