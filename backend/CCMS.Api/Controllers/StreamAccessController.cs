using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CCMS.Application.Services;
using CCMS.Shared.Common;
using System.Security.Claims;

namespace CCMS.Api.Controllers;

public class StreamAccessDto
{
    public bool HasAccess { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime? ValidUntil { get; set; }
}

[Authorize]
[ApiController]
[Route("api/screens/{screenId}/streaming")]
public class StreamAccessController : ControllerBase
{
    private readonly IStreamAccessService _streamAccessService;
    private readonly ILogger<StreamAccessController> _logger;

    public StreamAccessController(
        IStreamAccessService streamAccessService,
        ILogger<StreamAccessController> logger)
    {
        _streamAccessService = streamAccessService;
        _logger = logger;
    }

    /// <summary>
    /// Check if current user has access to view stream for this screen
    /// </summary>
    [HttpGet("access")]
    public async Task<ActionResult<ApiResponse<StreamAccessDto>>> CheckAccess(Guid screenId)
    {
        try
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role);

            _logger.LogInformation(
                "CheckAccess called. ScreenId={ScreenId}, UserIdClaim={UserIdClaim}, Role={Role}",
                screenId, userIdClaim, role);

            if (string.IsNullOrEmpty(userIdClaim))
            {
                _logger.LogWarning("No user ID claim found in token");
                return Unauthorized(ApiResponse<StreamAccessDto>.ErrorResponse("Invalid token"));
            }

            var userId = Guid.Parse(userIdClaim);

            _logger.LogInformation(
                "Checking stream access for user {UserId} (role: {Role}) on screen {ScreenId}",
                userId, role, screenId);

            StreamAccessDto result;

            if (role == "Advertiser")
            {
                var accessResult = await _streamAccessService
                    .CheckAdvertiserAccessAsync(userId, screenId);

                result = new StreamAccessDto
                {
                    HasAccess = accessResult.HasAccess,
                    Reason = accessResult.Reason,
                    ValidUntil = accessResult.AccessValidUntil
                };
            }
            else if (role == "ScreenOwner" || role == "Admin")
            {
                result = new StreamAccessDto
                {
                    HasAccess = true,
                    Reason = "Screen owner/admin access",
                    ValidUntil = null // Never expires
                };
            }
            else
            {
                result = new StreamAccessDto
                {
                    HasAccess = false,
                    Reason = "Insufficient permissions"
                };
            }

            return Ok(ApiResponse<StreamAccessDto>.SuccessResponse(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking stream access for screen {ScreenId}", screenId);
            return StatusCode(500, ApiResponse<StreamAccessDto>.ErrorResponse("Error checking stream access"));
        }
    }
}
