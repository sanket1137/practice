using System.Security.Claims;
using Asp.Versioning;
using CCMS.Api.Extensions;
using CCMS.Application.Interfaces;
using CCMS.Shared.Common;
using CCMS.Shared.DTOs.Cms;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CCMS.Api.Controllers;

/// <summary>
/// Pairing endpoints for CMS-mode screens. The CmsOwner generates a 6-digit
/// code in the dashboard; the player (anonymous) claims it.
/// </summary>
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/cms/pairing")]
public class CmsPairingController : ControllerBase
{
    private readonly ICmsPairingService _pairingService;

    public CmsPairingController(ICmsPairingService pairingService)
    {
        _pairingService = pairingService;
    }

    /// <summary>CmsOwner generates a new code (valid 10 minutes).</summary>
    [HttpPost("generate")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PairingCodeResponse>>> Generate(CancellationToken ct)
    {
        var userId = GetUserId();
        try
        {
            var result = await _pairingService.GenerateAsync(userId, ct);
            return Ok(ApiResponse<PairingCodeResponse>.SuccessResponse(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<PairingCodeResponse>.ErrorResponse(ex.Message));
        }
    }

    /// <summary>Dashboard polls this to detect when a player has claimed the code.</summary>
    [HttpGet("status/{code}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PairingStatusResponse>>> Status(string code, CancellationToken ct)
    {
        var userId = GetUserId();
        var result = await _pairingService.GetStatusAsync(code, userId, ct);
        if (result is null)
        {
            return NotFound(ApiResponse<PairingStatusResponse>.ErrorResponse("Pairing code not found"));
        }
        return Ok(ApiResponse<PairingStatusResponse>.SuccessResponse(result));
    }

    /// <summary>
    /// Anonymous endpoint called by the player device once the owner types the
    /// code on screen. Rate-limited to prevent brute-force enumeration.
    /// </summary>
    [HttpPost("claim")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
    public async Task<ActionResult<ApiResponse<ClaimPairingCodeResponse>>> Claim(
        [FromBody] ClaimPairingCodeRequest request,
        CancellationToken ct)
    {
        try
        {
            var result = await _pairingService.ClaimAsync(request, ct);
            return Ok(ApiResponse<ClaimPairingCodeResponse>.SuccessResponse(result, "Device paired"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<ClaimPairingCodeResponse>.ErrorResponse(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<ClaimPairingCodeResponse>.ErrorResponse(ex.Message));
        }
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var id))
        {
            throw new UnauthorizedAccessException("Invalid user claim");
        }
        return id;
    }
}
